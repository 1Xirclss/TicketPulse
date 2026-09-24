import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowUpRight, Ticket, Save } from 'lucide-react';
import Modal from './Modal';
import { api } from '../../utils/api';
import { money } from '../../utils/format';
export default function SaleForm({ evento, tarifas, options, venta, onClose, onSaved }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const request = useRef(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ defaultValues: {
    nombreAsistente: venta?.nombreAsistente || '', telefono: venta?.telefono || '', colegio: venta?.colegio || '',
    tarifaId: tarifas[0]?._id || '', cantidad: 1, metodoPago: venta?.metodoPago || options.metodos[0],
    estadoPago: venta?.estadoPago || options.estadosPago[0]?.value, comprobanteRef: venta?.comprobanteRef || ''
  } });
  const tarifa = tarifas.find(item => item._id === watch('tarifaId'));
  const quantity = Number(watch('cantidad'));
  const method = watch('metodoPago'); const payment = watch('estadoPago');
  const total = venta?.montoCentavos ?? (tarifa && Number.isSafeInteger(quantity) && quantity > 0 ? tarifa.precioCentavos * quantity : null);
  async function submit(values) {
    setBusy(true); setError('');
    try {
      const body = venta ? { version: venta.version, nombreAsistente: values.nombreAsistente, telefono: values.telefono, colegio: values.colegio, comprobanteRef: values.comprobanteRef, estadoPago: venta.estadoPago === 'CANCELADO' ? 'CANCELADO' : values.estadoPago }
        : { ...values, cantidad: Number(values.cantidad), eventoId: evento._id };
      const signature = JSON.stringify(body);
      if (!request.current || request.current.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
      const result = await api(venta ? '/ventas/' + venta.id : '/ventas', { method: venta ? 'PUT' : 'POST', body, headers: venta ? {} : { 'Idempotency-Key': request.current.key } });
      onSaved(result.venta);
    } catch (e) { setError(e.message + (e.status === 503 || !e.status ? ' Reintenta sin cambiar los datos para comprobar la misma operación.' : '')); }
    finally { setBusy(false); }
  }
  return <Modal title={venta ? 'Editar venta' : 'Registrar nueva entrada'} onClose={onClose} busy={busy}>
    <form className="sale-form" onSubmit={handleSubmit(submit)}>
      <div className="modal-event"><Ticket size={17}/><span>{evento.nombre}</span><span className="subtle-tag">{venta ? venta.ticketCode : 'NUEVA VENTA'}</span></div>
      {error && <p role="alert" className="alert error">{error}</p>}
      <fieldset disabled={busy}>
        <label className="settings-field"><span>Nombre completo</span><input autoFocus maxLength={120} {...register('nombreAsistente', { required: 'Ingresa el nombre.', minLength: { value: 2, message: 'Usa al menos dos caracteres.' } })}/>{errors.nombreAsistente && <small role="alert">{errors.nombreAsistente.message}</small>}</label>
        <div className="form-grid"><label className="settings-field"><span>Teléfono</span><input type="tel" maxLength={30} {...register('telefono')}/></label><label className="settings-field"><span>Colegio / Senior</span><input maxLength={150} {...register('colegio')}/></label></div>
        {!venta && <div className="form-grid sale-tariff-fields"><label className="settings-field"><span>Tipo de entrada</span><select {...register('tarifaId', { required: 'Selecciona una tarifa.' })}>{tarifas.map(item => <option key={item._id} value={item._id}>{item.nombre} · {item.categoria} · {item.etapa} · {money(item.precioCentavos)}</option>)}</select></label><label className="settings-field"><span>Cantidad</span><input type="number" min={1} max={options.limiteCantidad} step={1} {...register('cantidad', { valueAsNumber: true, min: { value: 1, message: 'Mínimo una entrada.' }, max: { value: options.limiteCantidad, message: 'Cantidad fuera del límite.' }, validate: value => Number.isInteger(value) || 'Usa una cantidad entera.' })}/>{errors.cantidad && <small role="alert">{errors.cantidad.message}</small>}</label></div>}
        {!venta && <fieldset className="payment-toggle"><legend>Método de pago</legend>{options.metodos.map(value => <label key={value} className={method === value ? 'selected' : ''}><input type="radio" value={value} {...register('metodoPago')}/>{value}</label>)}</fieldset>}
        <label className="settings-field"><span>Estado de pago</span><select {...register('estadoPago')} disabled={venta?.estadoPago === 'CANCELADO'}>{options.estadosPago.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{venta?.estadoPago === 'CANCELADO' && <small>El pago confirmado se conserva.</small>}</label>
        {method === 'Transferencia' && <label className="settings-field"><span>Referencia de comprobante</span><input maxLength={120} {...register('comprobanteRef', { validate: value => method !== 'Transferencia' || payment !== 'CANCELADO' || value.trim().length > 0 || 'Ingresa la referencia del pago.' })}/>{errors.comprobanteRef && <small role="alert">{errors.comprobanteRef.message}</small>}</label>}
      </fieldset>
      <div className="sale-total"><div><span>{venta ? 'IMPORTE REGISTRADO' : 'TOTAL A COBRAR'}</span><small>{venta ? venta.cantidad + ' entrada(s) · ' + venta.metodoPago : 'El precio se confirma al emitir la entrada.'}</small></div><strong>{total === null ? '—' : money(total)}</strong></div>
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary-button compact" disabled={busy || (!venta && !tarifas.length)}>{busy ? <span className="spinner"/> : venta ? <Save size={16}/> : <ArrowUpRight size={17}/>} {busy ? 'Guardando…' : venta ? 'Guardar cambios' : 'Registrar venta'}</button></div>
    </form>
  </Modal>;
}
