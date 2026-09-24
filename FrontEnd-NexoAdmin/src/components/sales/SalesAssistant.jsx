import { useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, Sparkles } from 'lucide-react';
import Modal from './Modal';
import { api } from '../../utils/api';
import { money } from '../../utils/format';
import { parseSalesList } from '../../utils/parseSalesList';
import '../../styles/sales-assistant.css';

export default function SalesAssistant({ evento, tarifas, onClose, onSaved }) {
  const [input, setInput] = useState('');
  const [tarifaId, setTarifaId] = useState(tarifas[0]?._id || '');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState({});
  const [message, setMessage] = useState('');
  const keys = useRef(new Map());
  const rows = useMemo(() => parseSalesList(input), [input]);
  const valid = rows.filter(row => !row.error);
  const invalid = rows.filter(row => row.error);
  const tarifa = tarifas.find(item => item._id === tarifaId);
  const completed = valid.filter(row => results[row.line]?.status === 'ok').length;

  async function registerAll() {
    if (!tarifa || !valid.length || invalid.length) return;
    setBusy(true); setMessage('');
    const next = { ...results };
    let added = 0;
    for (const row of valid) {
      if (next[row.line]?.status === 'ok') continue;
      const signature = [evento._id, tarifaId, row.line, row.name, row.method].join('|');
      if (!keys.current.has(signature)) keys.current.set(signature, crypto.randomUUID());
      try {
        await api('/ventas', {
          method: 'POST',
          headers: { 'Idempotency-Key': keys.current.get(signature) },
          body: {
            eventoId: evento._id, tarifaId, nombreAsistente: row.name,
            telefono: '', colegio: '', cantidad: 1, metodoPago: row.method,
            estadoPago: row.method === 'Efectivo' ? 'CANCELADO' : 'PENDIENTE',
            comprobanteRef: ''
          }
        });
        next[row.line] = { status: 'ok' };
        added += 1;
      } catch (error) {
        next[row.line] = { status: 'error', message: error.message };
      }
      setResults({ ...next });
    }
    setBusy(false);
    const success = Object.values(next).filter(value => value.status === 'ok').length;
    const errors = Object.values(next).filter(value => value.status === 'error').length;
    if (added) onSaved(added);
    setMessage(errors ? `${success} venta(s) registradas. ${errors} pendiente(s): revisa el error y vuelve a intentar.` : `${success} venta(s) registradas correctamente.`);
  }

  function updateInput(value) { setInput(value); setResults({}); keys.current.clear(); setMessage(''); }

  return <Modal title="Asistente de ventas" className="assistant-dialog" onClose={onClose} busy={busy}>
    <div className="assistant-body">
      <div className="assistant-intro"><span className="assistant-avatar"><Bot size={25}/></span><div><strong>Pega tu lista de asistentes</strong><p>Leo un nombre y método de pago por línea. Revisa la vista previa antes de registrarlos.</p></div></div>
      <label className="settings-field"><span>Tarifa para esta lista</span><select value={tarifaId} onChange={event => {setTarifaId(event.target.value);setResults({});}} disabled={busy || completed > 0}>{tarifas.map(item => <option key={item._id} value={item._id}>{item.nombre} · {item.categoria} · {money(item.precioCentavos)}</option>)}</select><small>Se aplicará a cada persona. Una entrada por línea.</small></label>
      <label className="settings-field"><span>Lista de ventas</span><textarea className="assistant-input" autoFocus rows={8} value={input} onChange={event => updateInput(event.target.value)} disabled={busy || completed > 0} placeholder={'Mónica Álvarez EFECTIVO\nCamila Del Cid TRANSF\nJordi Hernández EFECTICO'}/></label>
      <p className="assistant-rule"><Sparkles size={15}/> Efectivo se marca pagado. Transferencia sin referencia queda pendiente; puedes confirmarla después al editar la venta.</p>
      {rows.length > 0 && <section className="assistant-preview" aria-label="Vista previa de ventas"><div className="assistant-preview-heading"><strong>Vista previa</strong><span>{valid.length} listas · {invalid.length} por revisar · {completed} guardadas</span></div><div className="assistant-preview-list">{rows.map(row => <div key={row.line} className={'assistant-preview-row ' + (row.error || results[row.line]?.status === 'error' ? 'has-error' : '')}><span className="assistant-row-number">{row.line}</span><span className="assistant-row-name">{row.name || row.raw}</span><span className="assistant-row-method">{row.method || '—'}</span><span className="assistant-row-status">{results[row.line]?.status === 'ok' ? <CheckCircle2 size={16} aria-label="Guardada"/> : results[row.line]?.message || row.error || (row.method === 'Transferencia' ? 'Pendiente' : 'Pagado')}</span></div>)}</div></section>}
      {message && <p role="status" className={'alert ' + (Object.values(results).some(value => value.status === 'error') ? 'error' : 'success')}>{message}</p>}
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cerrar</button><button type="button" className="primary-button compact" onClick={registerAll} disabled={busy || !tarifa || !valid.length || invalid.length || completed === valid.length}><Sparkles size={16}/>{busy ? 'Registrando…' : completed ? 'Reintentar pendientes' : `Registrar ${valid.length} venta${valid.length === 1 ? '' : 's'}`}</button></div>
    </div>
  </Modal>;
}
