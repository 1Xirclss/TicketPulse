import { Component, lazy, Suspense, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Ticket, ScanLine } from 'lucide-react';
import Modal from './Modal';
import { api } from '../../utils/api';
import { money, dateLabel } from '../../utils/format';
const TicketScene = lazy(() => import('./TicketScene'));
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function TicketModal({ saleId, onClose }) {
  const [data,setData] = useState(null); const [qr,setQr] = useState(''); const [qrImage,setQrImage] = useState(null);
  const [error,setError] = useState(''); const [canRender,setCanRender] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await api('/ventas/' + saleId, { signal: controller.signal });
        const source = await QRCode.toDataURL(result.qrPayload, { width:400, margin:4, errorCorrectionLevel:'M' });
        const img = new Image(); img.src = source; await img.decode();
        if (!controller.signal.aborted) { setData(result); setQr(source); setQrImage(img); }
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    }
    load();
    const canvas = document.createElement('canvas'); const gl = canvas.getContext('webgl2');
    setCanRender(!!gl && !matchMedia('(prefers-reduced-motion: reduce)').matches);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return () => controller.abort();
  }, [saleId]);
  const fallback = data ? <div className="ticket-flat"><span className="page-eyebrow">TICKETPULSE / EVENT PASS</span><h3>{data.evento.nombre}</h3><p>{dateLabel(data.evento.fecha)} · {data.evento.horario}</p><strong>{data.venta.nombreAsistente}</strong><img src={qr} alt="Código QR del boleto"/><code>{data.venta.ticketCode}</code></div> : null;
  return <Modal title="Tu boleto, en otra dimensión." onClose={onClose} className="ticket-dialog">
    {error ? <p className="alert error" role="alert">{error}</p> : !data ? <p className="ticket-loading" role="status"><span className="spinner"/> Preparando boleto…</p> : <div className="ticket-layout"><div className="ticket-stage">{canRender && qrImage ? <SceneBoundary fallback={fallback}><Suspense fallback={fallback}><TicketScene data={data} qrImage={qrImage}/></Suspense></SceneBoundary> : fallback}</div><div className="ticket-information"><span className="ticket-icon"><Ticket size={25}/></span><span className={'payment-badge ' + (data.venta.anulada ? 'cancelled' : data.venta.estadoPago === 'PENDIENTE' ? 'pending' : '')}>{data.venta.anulada ? 'Anulada' : data.venta.estadoPago === 'CANCELADO' ? 'Pagado' : 'Pendiente'}</span><h3>{data.venta.nombreAsistente}</h3><p>{data.evento.nombre}</p><dl><div><dt>Entrada</dt><dd>{data.venta.tarifaNombre || data.venta.categoria}</dd></div><div><dt>Cantidad</dt><dd>{data.venta.cantidad}</dd></div><div><dt>Importe</dt><dd>{money(data.venta.montoCentavos)}</dd></div><div><dt>Ticket</dt><dd className="mono">{data.venta.ticketCode}</dd></div></dl><img className="ticket-readable-qr" src={qr} alt={'QR del ticket ' + data.venta.ticketCode}/><p className="ticket-help"><ScanLine size={15}/> {data.venta.anulada ? 'Boleto anulado. No autoriza ingreso.' : data.venta.estadoPago === 'PENDIENTE' ? 'El pago debe confirmarse antes del ingreso.' : 'Conserva este código para identificar tu entrada.'}</p><small>El control de ingreso se habilitará en la siguiente entrega.</small></div></div>}
  </Modal>;
}
