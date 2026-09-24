import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const databaseName = 'nexoadmin_test_' + randomBytes(8).toString('hex');
Object.assign(process.env,{NODE_ENV:'test',MONGODB_URI:'mongodb://127.0.0.1:27017/'+databaseName,FRONTEND_URL:'http://localhost:5180',JWT_SECRET:randomBytes(48).toString('hex'),ADMIN_ORGANIZATION_KEY:randomBytes(32).toString('hex'),STAFF_ORGANIZATION_KEY:randomBytes(32).toString('hex')});
let app,db,Evento,Venta,Tarifa,admin,staff,gate,adminId;
const config = {nombre:'Evento ventas',fecha:'2026-12-20',horario:'18:30',zonaHoraria:'America/El_Salvador',venue:'Recinto',direccion:'Dirección',aforoMaximo:50,activo:true,marca:{nombre:'',logoUrl:''}};
function token(user){return 'nexo_session='+jwt.sign({version:0},process.env.JWT_SECRET,{subject:user.id,issuer:'nexoadmin',audience:'nexoadmin-web',expiresIn:3600});}
const write = (method,path,body,cookie=admin,key=randomUUID()) => request(app)[method](path).set('Origin',process.env.FRONTEND_URL).set('Cookie',cookie).set('Idempotency-Key',key).send(body);
const get = (path,cookie=admin) => request(app).get(path).set('Cookie',cookie);
async function fixture(capacity=50){
  const evento=await Evento.create({...config,slug:randomUUID(),aforoMaximo:capacity});
  const tarifa=await Tarifa.create({evento:evento._id,nombre:'General externa',categoria:'General',etapa:'Preventa',precioCentavos:1550,activa:true});
  return {evento,tarifa,body:{eventoId:evento.id,tarifaId:tarifa.id,nombreAsistente:'Asistente de prueba',telefono:'7777-1234',colegio:'Colegio [A]',cantidad:1,metodoPago:'Efectivo',estadoPago:'CANCELADO',comprobanteRef:''}};
}
before(async()=>{
  ({default:app}=await import('../app.js'));db=await(await import('../database.js')).connectDatabase();
  const {default:Usuario}=await import('../src/models/Usuarios.js');
  ({default:Evento}=await import('../src/models/ConfiguracionEvento.js'));({default:Venta}=await import('../src/models/AsistentesVentas.js'));({default:Tarifa}=await import('../src/models/Tarifas.js'));
  await Promise.all([Usuario.init(),Evento.init(),Venta.init(),Tarifa.init()]);
  for(const rol of ['Admin','Taquilla','Portero']){
    const user=await Usuario.create({nombre:rol,correo:rol+'@prueba.local',rol,passwordHash:'not-used-for-login'});
    if(rol==='Admin'){admin=token(user);adminId=user._id;}else if(rol==='Taquilla')staff=token(user);else gate=token(user);
  }
});
after(async()=>{if(db){assert.match(db.name,/^nexoadmin_test_[a-f0-9]{16}$/);await db.dropDatabase();await db.close();}});
test('precio servidor, cantidad, tarifa y permisos se validan',async()=>{
  const f=await fixture();const other=await fixture();
  assert.equal((await write('post','/api/ventas',{...f.body,montoCentavos:1})).status,400);
  assert.equal((await write('post','/api/ventas',{...f.body,cantidad:0})).status,400);
  assert.equal((await write('post','/api/ventas',{...f.body,cantidad:1.5})).status,400);
  assert.equal((await write('post','/api/ventas',{...f.body,tarifaId:other.tarifa.id})).status,400);
  assert.equal((await write('post','/api/ventas',f.body,gate)).status,403);
  const r=await write('post','/api/ventas',{...f.body,cantidad:2},staff);
  assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(r.body.venta.montoCentavos,3100);assert.match(r.body.venta.ticketCode,/^NX[A-F0-9]{24}$/);
  assert.equal((await Venta.findById(r.body.venta.id)).montoCentavos,3100);
});
test('20 ventas concurrentes no superan un aforo de 7',async()=>{
  const f=await fixture(7);
  const results=await Promise.all(Array.from({length:20},(_,i)=>write('post','/api/ventas',{...f.body,nombreAsistente:'Concurrente '+i})));
  assert.equal(results.filter(r=>r.status===201).length,7,JSON.stringify(results.map(r=>r.status)));
  assert.equal(results.filter(r=>r.status===409&&r.body.message==='Aforo agotado').length,13);
  const event=await Evento.findById(f.evento._id).lean();
  assert.equal(event.entradasReservadas,7);assert.equal(event.ventasSecuencia,7);
  assert.equal(await Venta.countDocuments({evento:event._id}),7);
  const numbers=await Venta.find({evento:event._id}).distinct('numero');assert.equal(numbers.length,7);
});
test('reintentos concurrentes comparten boleto y no repiten la reserva',async()=>{
  const f=await fixture();const key=randomUUID();
  const results=await Promise.all(Array.from({length:6},()=>write('post','/api/ventas',f.body,admin,key)));
  assert.ok(results.every(r=>[200,201].includes(r.status)));
  assert.equal(new Set(results.map(r=>r.body.venta.ticketCode)).size,1);
  assert.equal((await Evento.findById(f.evento._id)).entradasReservadas,1);
  assert.equal((await write('post','/api/ventas',{...f.body,cantidad:2},admin,key)).status,409);
});
test('recupera interrupción entre reserva y materialización sin duplicar',async()=>{
  const f=await fixture();const key=randomUUID();
  const original=Venta.collection.updateOne;
  let fail=true;
  Venta.collection.updateOne=function(filter,update,...args){if(update.$setOnInsert&&fail){fail=false;throw new Error('fallo de prueba');}return original.call(this,filter,update,...args);};
  let result;
  try{result=await write('post','/api/ventas',f.body,admin,key);}finally{Venta.collection.updateOne=original;}
  assert.equal(result.status,500);
  assert.ok((await Evento.collection.findOne({_id:f.evento._id})).operacionVenta);
  const retry=await write('post','/api/ventas',f.body,admin,key);
  assert.equal(retry.status,200);
  assert.equal(await Venta.countDocuments({evento:f.evento._id}),1);
  assert.equal((await Evento.findById(f.evento._id)).entradasReservadas,1);
  assert.equal((await Evento.collection.findOne({_id:f.evento._id})).operacionVenta,undefined);
});
test('edición conserva importes, valida comprobante y control de versión',async()=>{
  const f=await fixture();
  const r=await write('post','/api/ventas',{...f.body,metodoPago:'Transferencia',estadoPago:'PENDIENTE'});
  const id=r.body.venta.id;
  assert.equal((await write('put','/api/ventas/'+id,{version:0,estadoPago:'CANCELADO'})).status,400);
  const paid=await write('put','/api/ventas/'+id,{version:0,estadoPago:'CANCELADO',comprobanteRef:'BANCO-001',nombreAsistente:'Nombre actualizado'},staff);
  assert.equal(paid.status,200);assert.equal(paid.body.venta.montoCentavos,1550);
  assert.equal((await write('put','/api/ventas/'+id,{version:0,nombreAsistente:'Otro nombre'})).status,409);
  assert.equal((await write('put','/api/ventas/'+id,{version:1,estadoPago:'PENDIENTE'})).status,409);
  assert.equal((await write('put','/api/ventas/'+id,{version:1,cantidad:3})).status,400);
});
test('anulación concurrente libera una sola vez y requiere Admin',async()=>{
  const f=await fixture(2);const r=await write('post','/api/ventas',{...f.body,cantidad:2});const id=r.body.venta.id;
  assert.equal((await write('patch','/api/ventas/'+id+'/anular',{version:0,motivo:'Solicitud de prueba'},staff)).status,403);
  const results=await Promise.all(Array.from({length:5},()=>write('patch','/api/ventas/'+id+'/anular',{version:0,motivo:'Solicitud de prueba'})));
  assert.ok(results.every(r=>r.status===200));
  assert.equal((await Evento.findById(f.evento._id)).entradasReservadas,0);
  const stats=await get('/api/dashboard/stats?evento='+f.evento.id);assert.equal(stats.body.resumen.recaudadoCentavos,0);
  assert.equal((await write('post','/api/ventas',f.body)).status,201);
});
test('cambio simultáneo de capacidad respeta las reservas',async()=>{
  const f=await fixture(5);
  const [sale,update]=await Promise.all([write('post','/api/ventas',{...f.body,cantidad:3}),write('put','/api/configuracion/'+f.evento.id,{...config,aforoMaximo:2,version:0})]);
  assert.ok((sale.status===201&&update.status===409)||(sale.status===409&&update.status===200),JSON.stringify([sale.status,update.status]));
  const event=await Evento.findById(f.evento._id);assert.ok(event.entradasReservadas<=event.aforoMaximo);
});
test('filtra, pagina, exporta selección y protege CSV contra fórmulas',async()=>{
  const f=await fixture();const r=await write('post','/api/ventas',{...f.body,nombreAsistente:'=SUM(1+1)',estadoPago:'PENDIENTE'});
  await write('post','/api/ventas',{...f.body,nombreAsistente:'Persona pagada'});
  const query='evento='+f.evento.id+'&estado=PENDIENTE&q='+encodeURIComponent('[A]');
  const page=await get('/api/ventas?'+query+'&limit=1&page=1');
  assert.equal(page.status,200);assert.equal(page.body.total,1);assert.equal(page.body.ventas[0].id,r.body.venta.id);
  const csv=await get('/api/ventas/exportar?'+query);assert.equal(csv.status,200);assert.match(csv.text,/'=SUM\(1\+1\)/);assert.doesNotMatch(csv.text,/Persona pagada/);
  const pdf=await get('/api/ventas/exportar.pdf?'+query).buffer(true).parse((res,callback)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>callback(null,Buffer.concat(chunks)));});
  assert.equal(pdf.status,200);assert.equal(pdf.body.subarray(0,5).toString(),'%PDF-');
  const ticket=await get('/api/ventas/'+r.body.venta.id);assert.equal(ticket.body.qrPayload,'NEXO:'+r.body.venta.ticketCode);
  assert.equal((await get('/api/ventas?evento='+f.evento.id+'&q='+encodeURIComponent('.*'))).body.total,0);
});
test('ventas con ingresos no se anulan y puerta reconoce grupos parciales',async()=>{
  const f=await fixture();const r=await write('post','/api/ventas',{...f.body,cantidad:2});
  await Venta.updateOne({_id:r.body.venta.id},{$push:{ingresos:{fecha:new Date(),portero:adminId}}});
  assert.equal((await write('patch','/api/ventas/'+r.body.venta.id+'/anular',{version:0,motivo:'Prueba ingreso'})).status,409);
  const pending=await get('/api/ventas?evento='+f.evento.id+'&puerta=Pendiente');assert.equal(pending.body.total,1);
  const entered=await get('/api/ventas?evento='+f.evento.id+'&puerta=Ingresado');assert.equal(entered.body.total,0);
});
