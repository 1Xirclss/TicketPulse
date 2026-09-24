import PDFDocument from 'pdfkit';
import { once } from 'node:events';
import Venta from '../models/AsistentesVentas.js';
import { getAccessibleEvent } from '../utils/eventAccess.js';
import { recoverEvent } from '../services/ventasAtomic.js';
import { salesQuery, saleView } from '../utils/ventasQuery.js';

const dollars = cents => '$' + (cents / 100).toFixed(2);
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
async function exportSource(req) {
  const { data, match } = salesQuery(req.query);
  const evento = await getAccessibleEvent(data.evento, req.user);
  await recoverEvent(evento._id);
  return { evento, data, cursor: Venta.collection.find(match).sort({ createdAt: -1, _id: -1 }) };
}
export async function exportCsv(req, res) {
  const { evento, cursor } = await exportSource(req);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ventas-' + evento._id + '.csv"' });
  res.write('\uFEFF' + ['Ticket','Asistente','Teléfono','Colegio','Categoría','Cantidad','Método','Monto USD','Estado','Puerta','Ingresados','Referencia','Anulación'].map(csvCell).join(',') + '\r\n');
  try {
    for await (const row of cursor) {
      if (res.destroyed) break;
      const v = saleView(row);
      const line = [v.ticketCode,v.nombreAsistente,v.telefono,v.colegio,v.categoria,v.cantidad,v.metodoPago,(v.montoCentavos / 100).toFixed(2),v.anulada ? 'Anulada' : v.estadoPago === 'CANCELADO' ? 'Pagado' : 'Pendiente',v.puerta,v.ingresados,v.comprobanteRef,v.motivoAnulacion].map(csvCell).join(',') + '\r\n';
      if (!res.write(line)) await Promise.race([once(res, 'drain'), once(res, 'close')]);
    }
    res.end();
  } finally { await cursor.close(); }
}
export async function exportPdf(req, res) {
  const { evento, data, cursor } = await exportSource(req);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, info: { Title: 'Ventas - ' + evento.nombre, Author: 'TicketPulse' } });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="ventas-' + evento._id + '.pdf"' });
  doc.pipe(res);
  let page = 0, y, count = 0, total = 0;
  const widths = [120, 200, 62, 40, 80, 80, 80, 100];
  const headings = ['TICKET', 'ASISTENTE / COLEGIO', 'CATEGORÍA', 'CANT.', 'MÉTODO', 'MONTO USD', 'ESTADO', 'PUERTA'];
  const scale = (doc.page.width - 80) / widths.reduce((a,b) => a+b,0);
  const cols = widths.map(width => width * scale);
  const clean = value => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 500);
  function footer() {
    doc.font('Helvetica').fontSize(8).fillColor('#445A71').text('TicketPulse | Reporte de ventas | Página ' + page, 40, doc.page.height - 32, { lineBreak: false });
  }
  function startPage() {
    page++;
    doc.fillColor('#1A191E').font('Helvetica-Bold').fontSize(20).text('TICKETPULSE / VENTAS', 40, 35);
    doc.fontSize(11).text(clean(evento.nombre), 40, 66, { width: doc.page.width - 80 });
    const filters = Object.entries(data).filter(([key,value]) => !['evento','page','limit'].includes(key) && value).map(([key,value]) => key + ': ' + value).join(' | ') || 'Todas las ventas vigentes';
    doc.font('Helvetica').fontSize(8).fillColor('#445A71').text('Emitido: ' + new Date().toISOString() + ' | ' + clean(filters), 40, 94, { width: doc.page.width - 80, height: 28, ellipsis: true });
    y = 129; doc.rect(40, y, doc.page.width-80, 26).fill('#1E3040');
    let x = 40;
    headings.forEach((label, index) => { doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7).text(label, x+6, y+9, { width: cols[index]-12, lineBreak: false }); x += cols[index]; });
    y += 26;
  }
  startPage();
  try {
    for await (const row of cursor) {
      if (res.destroyed) break;
      const v = saleView(row);
      const cells = [v.ticketCode, v.nombreAsistente + (v.colegio ? '\n' + v.colegio : ''), v.categoria, String(v.cantidad), v.metodoPago, dollars(v.montoCentavos), v.anulada ? 'Anulada' : v.estadoPago === 'CANCELADO' ? 'Pagado' : 'Pendiente', v.puerta + ' (' + v.ingresados + '/' + v.cantidad + ')'];
      doc.font('Helvetica').fontSize(8);
      const height = Math.max(34, ...cells.map((text,index) => doc.heightOfString(clean(text), { width: cols[index]-12 }) + 16));
      if (y + height > doc.page.height - 70) { footer(); doc.addPage(); startPage(); }
      doc.rect(40, y, doc.page.width-80, height).fill(count % 2 ? '#ffffff' : '#eef2f6');
      let x = 40;
      cells.forEach((text,index) => { doc.fillColor('#1A191E').font('Helvetica').fontSize(8).text(clean(text), x+6, y+8, { width: cols[index]-12 }); x += cols[index]; });
      y += height; count++;
      if (!v.anulada && v.estadoPago === 'CANCELADO') total += v.montoCentavos;
    }
    if (y + 50 > doc.page.height - 60) { footer(); doc.addPage(); startPage(); }
    doc.fillColor('#1E3040').font('Helvetica-Bold').fontSize(10).text(count ? 'Registros: ' + count + ' | Cobrado en la selección: ' + dollars(total) : 'No hay ventas para los filtros seleccionados.', 40, y+20, { width: doc.page.width-80 });
    footer(); doc.end();
  } catch (error) { doc.destroy(error); throw error; }
  finally { await cursor.close(); }
}
