import { useState } from 'react';
import { Ban } from 'lucide-react';
import Modal from './Modal';
import { api } from '../../utils/api';
export default function CancelSale({ venta, onClose, onSaved }) {
  const [motivo, setMotivo] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api('/ventas/' + venta.id + '/anular', { method: 'PATCH', body: { motivo, version: venta.version } }); onSaved(result.venta); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <Modal title="Anular venta" onClose={onClose} busy={busy} className="cancel-dialog"><form className="sale-form" onSubmit={submit}><p className="cancel-description">Se anulará la venta de <strong>{venta.nombreAsistente}</strong> y se liberarán {venta.cantidad} entrada(s). El registro se conservará para consulta.</p>{error && <p className="alert error" role="alert">{error}</p>}<label className="settings-field"><span>Motivo de anulación</span><textarea autoFocus value={motivo} onChange={event => setMotivo(event.target.value)} minLength={3} maxLength={250} required disabled={busy}/></label><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Volver</button><button className="danger-button" disabled={busy}>{busy ? <span className="spinner"/> : <Ban size={16}/>} Confirmar anulación</button></div></form></Modal>;
}
