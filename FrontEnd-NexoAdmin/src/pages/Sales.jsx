import { lazy, Suspense, useEffect, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, Download, Edit3, FileDown, Plus, RefreshCw, Search, SlidersHorizontal, Ticket, Users } from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../hooks/useAuth';
import useSales from '../hooks/useSales';
import { api } from '../utils/api';
import { downloadReport } from '../utils/download';
import { money, number } from '../utils/format';
import SaleForm from '../components/sales/SaleForm';
import CancelSale from '../components/sales/CancelSale';
const TicketModal = lazy(() => import('../components/sales/TicketModal'));
export default function Sales() {
  const { user } = useAuth(); const { selectedId, evento } = useEvent();
  if (user.rol === 'Portero') return <section className="empty-panel"><h1>Acceso reservado a ventas</h1><p>Este módulo está disponible para Admin y Taquilla.</p></section>;
  return <SalesWorkspace key={selectedId || 'empty'} evento={evento} user={user}/>;
}
function SalesWorkspace({ evento, user }) {
  const [options,setOptions] = useState(null); const [tarifas,setTarifas] = useState([]); const [setupError,setSetupError] = useState('');
  const [search,setSearch] = useState(''); const [q,setQ] = useState('');
  const [filters,setFilters] = useState({ estado:'',metodo:'',categoria:'',puerta:'' }); const [page,setPage] = useState(1);
  const [modal,setModal] = useState(null); const [notice,setNotice] = useState(''); const [error,setError] = useState(''); const [exporting,setExporting] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setQ(search.trim()); setPage(1); },300); return () => clearTimeout(timer); },[search]);
  async function loadOptions(signal) {
    if (!evento) return;
    try {
      const [metadata, prices] = await Promise.all([api('/ventas/opciones', { signal }),api('/tarifas?evento=' + evento._id, { signal })]);
      setOptions(metadata); setTarifas(prices.tarifas); setSetupError('');
    } catch (e) { if (e.name !== 'AbortError') setSetupError(e.message); }
  }
  useEffect(() => { const controller = new AbortController(); loadOptions(controller.signal); return () => controller.abort(); },[evento?._id]);
  const params = new URLSearchParams({ evento:evento?._id || '',page:String(page),limit:'20', ...(q ? {q} : {}) });
  for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value);
  const query = evento ? params.toString() : '';
  const { data,loading,error:listError,refresh } = useSales(query);
  function choose(key,value) { setFilters(previous => ({ ...previous,[key]:value })); setPage(1); }
  async function saved() { setModal(null); setNotice('La venta se guardó correctamente.'); if (page !== 1) setPage(1); else refresh(); await loadOptions(); }
  async function report(format) {
    setExporting(format); setError('');
    try { await downloadReport(query,format); } catch (e) { setError(e.message); } finally { setExporting(''); }
  }
  if (!evento) return <section className="empty-panel"><Ticket size={30}/><h1>Selecciona un evento para consultar sus ventas.</h1><p>Los eventos disponibles se muestran en el selector superior.</p></section>;
  const canCreate = evento.activo && !!options && tarifas.length > 0;
  return <div className="sales-page">
    <div className="page-heading"><div><div className="page-eyebrow">WORKSPACE <span>/</span> VENTAS & ASISTENTES</div><h1>Cada entrada cuenta<span>.</span></h1><p>Emite, consulta y administra las ventas de {evento.nombre}.</p></div><div className="sales-heading-icon"><Ticket size={26}/></div></div>
    {notice && <div className="alert success" role="status">{notice}</div>}
    {(error || setupError) && <div className="alert error" role="alert">{error || setupError}{setupError && <button className="text-button" onClick={() => loadOptions()}>Reintentar</button>}</div>}
    <section className="sales-toolbar"><div className="sales-search"><Search size={18}/><label className="sr-only" htmlFor="sales-search">Buscar ventas</label><input id="sales-search" placeholder="Nombre, colegio, teléfono o ticket…" value={search} onChange={event => setSearch(event.target.value)}/><span>⌕</span></div><div className="sales-toolbar-actions"><button className="secondary-button" onClick={() => report('csv')} disabled={!!exporting} title="Descargar CSV filtrado"><Download size={16}/><span>CSV</span></button><button className="secondary-button" onClick={() => report('pdf')} disabled={!!exporting}><FileDown size={16}/>{exporting === 'pdf' ? 'Generando…' : 'Exportar PDF'}</button><button className="primary-button compact" disabled={!canCreate} onClick={() => {setNotice('');setModal({ type:'create' });}}><Plus size={17}/> Registrar Venta</button></div></section>
    {!evento.activo && <p className="sales-context-note">El evento está inactivo. Puedes consultar sus ventas, pero no emitir entradas nuevas.</p>}
    {evento.activo && options && !tarifas.length && <p className="sales-context-note">No hay tarifas activas para emitir entradas. Los precios se administran externamente.</p>}
    {options && <section className="sales-filters" aria-label="Filtros de ventas"><div className="filters-caption"><SlidersHorizontal size={15}/><span>FILTRAR VENTAS</span><button onClick={() => {setFilters({ estado:'',metodo:'',categoria:'',puerta:'' });setSearch('');setPage(1);}}>Limpiar filtros</button></div><FilterChips label="Categoría" values={options.categorias.map(value => ({value,label:value}))} selected={filters.categoria} onChange={value => choose('categoria',value)}/><FilterChips label="Estado" values={options.estadosFiltro} selected={filters.estado} onChange={value => choose('estado',value)}/><FilterChips label="Método" values={options.metodos.map(value => ({value,label:value}))} selected={filters.metodo} onChange={value => choose('metodo',value)}/><FilterChips label="Puerta" values={options.puerta.map(value => ({value,label:value === 'Ingresado' ? 'Ingresados' : 'Pendientes de ingreso'}))} selected={filters.puerta} onChange={value => choose('puerta',value)}/></section>}
    <section className="os-panel sales-table-panel"><div className="panel-heading"><div><Users size={18}/><h2>Registro de asistentes</h2><span className="subtle-tag">{data ? number(data.total) + ' ventas' : 'Consultando…'}</span></div><button className="icon-button" onClick={refresh} disabled={loading} aria-label="Actualizar ventas"><RefreshCw size={16}/></button></div>
      {listError ? <p className="alert error" role="alert">{listError}</p> : loading ? <p className="sales-loading" role="status"><span className="spinner"/> Consultando ventas…</p> : !data?.ventas.length ? <div className="inline-empty"><Ticket size={32}/><strong>No hay ventas para esta selección.</strong><p>Registra una entrada o cambia los filtros para consultar otros asistentes.</p></div> : <div className="table-scroll"><table className="sales-table"><thead><tr><th># Ticket</th><th>Asistente</th><th>Colegio / Senior</th><th>Categoría</th><th>Método</th><th>Monto ($)</th><th>Estado pago</th><th>Puerta</th><th>Acciones</th></tr></thead><tbody>{data.ventas.map(venta => <tr key={venta.id} className={venta.anulada ? 'sale-cancelled-row' : ''}><td><code title={venta.ticketCode}>{venta.ticketCode}</code><small>{venta.numero ? '#' + venta.numero : 'Registro anterior'}</small></td><td><strong>{venta.nombreAsistente}</strong><small>{venta.telefono || 'Sin teléfono'} · {venta.cantidad} entrada(s)</small></td><td>{venta.colegio || '—'}</td><td><span className={'category-badge ' + (venta.categoria === 'Promo' ? 'promo' : '')}>{venta.categoria}</span></td><td>{venta.metodoPago}</td><td className="mono">{money(venta.montoCentavos)}</td><td><span className={'payment-badge ' + (venta.anulada ? 'cancelled' : venta.estadoPago === 'PENDIENTE' ? 'pending' : '')}>{venta.anulada ? 'Anulada' : venta.estadoPago === 'CANCELADO' ? 'Pagado' : 'Pendiente'}</span></td><td><span className={'gate-badge ' + (venta.puerta === 'Ingresado' ? 'entered' : '')}>{venta.puerta === 'Ingresado' ? 'Ingresado' : 'Pendiente'}</span><small>{venta.ingresados}/{venta.cantidad} ingresos</small></td><td><div className="row-actions"><button className="icon-button" disabled={venta.anulada || !options} title="Editar venta" aria-label={'Editar venta de ' + venta.nombreAsistente} onClick={() => setModal({type:'edit',venta})}><Edit3 size={15}/></button><button className="icon-button" title="Ver boleto 3D" aria-label={'Ver boleto de ' + venta.nombreAsistente} onClick={() => setModal({type:'ticket',venta})}><Ticket size={15}/></button>{user.rol === 'Admin' && <button className="icon-button cancel-action" disabled={venta.anulada || venta.ingresados > 0} title="Anular venta" aria-label={'Anular venta de ' + venta.nombreAsistente} onClick={() => setModal({type:'cancel',venta})}><Ban size={15}/></button>}</div></td></tr>)}</tbody></table></div>}
      <footer className="sales-pagination"><span>{data ? number(data.total) : '—'} resultados · 20 por página</span><div><button className="icon-button" disabled={loading || page === 1} onClick={() => setPage(page-1)} aria-label="Página anterior"><ChevronLeft size={17}/></button><span>Página {page} de {Math.max(1,data?.pages || 0)}</span><button className="icon-button" disabled={loading || !data || page >= data.pages} onClick={() => setPage(page+1)} aria-label="Página siguiente"><ChevronRight size={17}/></button></div></footer>
    </section>
    {(modal?.type === 'create' || modal?.type === 'edit') && <SaleForm evento={evento} tarifas={tarifas} options={options} venta={modal.venta} onClose={() => setModal(null)} onSaved={saved}/>}
    {modal?.type === 'cancel' && <CancelSale venta={modal.venta} onClose={() => setModal(null)} onSaved={saved}/>}
    {modal?.type === 'ticket' && <Suspense fallback={<div className="ticket-preparing" role="status">Preparando boleto…</div>}><TicketModal saleId={modal.venta.id} onClose={() => setModal(null)}/></Suspense>}
  </div>;
}
function FilterChips({ label, values, selected, onChange }) {
  return <div className="filter-row"><span>{label}</span><div role="group" aria-label={'Filtrar por ' + label.toLowerCase()}><button aria-pressed={!selected} onClick={() => onChange('')}>Todos</button>{values.map(item => <button key={item.value} aria-pressed={selected === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div></div>;
}
