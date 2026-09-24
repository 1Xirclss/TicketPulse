import { API_URL } from '../config';
export async function downloadReport(query, format) {
  const response = await fetch(API_URL + '/ventas/exportar' + (format === 'pdf' ? '.pdf' : '') + '?' + query, { credentials: 'include' });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || 'No se pudo generar el reporte.'); }
  const blob = await response.blob(); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'ventas-filtradas.' + format;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
