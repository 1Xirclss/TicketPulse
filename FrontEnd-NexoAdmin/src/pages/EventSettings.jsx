import { useState } from 'react';
import { CalendarDays, Clock3, Image, MapPin, Plus, Save, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useEvent } from '../context/EventContext';
import { api } from '../utils/api';
import { dateLabel, number } from '../utils/format';

function toForm(evento) {
  return {
    nombre: evento?.nombre || '', fecha: evento?.fecha?.slice(0, 10) || '', horario: evento?.horario || '',
    zonaHoraria: evento?.zonaHoraria || Intl.DateTimeFormat().resolvedOptions().timeZone,
    venue: evento?.venue || '', direccion: evento?.direccion || '', aforoMaximo: evento?.aforoMaximo ?? '',
    activo: evento?.activo ?? false, marca: { nombre: evento?.marca?.nombre || '', logoUrl: evento?.marca?.logoUrl || '' }
  };
}
export default function EventSettings() {
  const { user } = useAuth();
  const { evento, loading, refresh, selectEvent } = useEvent();
  const [creating, setCreating] = useState(false);
  if (loading) return <div className="empty-panel" role="status"><span className="spinner"/> Cargando configuración…</div>;
  return <div className="event-settings"><div className="page-heading"><div><div className="page-eyebrow">WORKSPACE <span>/</span> EVENTO</div><h1>El escenario, a tu medida<span>.</span></h1><p>Los detalles que conectan toda tu operación.</p></div>{user.rol === 'Admin' && <button className="secondary-button" onClick={() => setCreating(!creating)}>{creating ? <X size={16}/> : <Plus size={16}/>} {creating ? 'Cancelar nuevo evento' : 'Nuevo evento'}</button>}</div>
    {user.rol === 'Admin' ? (evento || creating ? <EventForm key={creating ? 'new' : evento._id} evento={creating ? null : evento} onSaved={async saved => { await refresh(); selectEvent(saved._id); setCreating(false); }}/>
      : <section className="empty-panel"><CalendarDays size={32}/><h2>Configura tu primer evento</h2><p>Nombre, fecha y aforo son el punto de partida.</p><button className="primary-button compact" onClick={() => setCreating(true)}><Plus size={16}/> Crear evento</button></section>)
      : evento ? <ReadOnlyEvent evento={evento}/> : <section className="empty-panel"><h2>No hay eventos disponibles</h2><p>Tu organización debe activar un evento para que puedas consultarlo.</p></section>}
  </div>;
}
function EventForm({ evento, onSaved }) {
  const [form, setForm] = useState(() => toForm(evento));
  const [version, setVersion] = useState(evento?.__v ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const change = (field, value) => { setForm(previous => ({ ...previous, [field]: value })); setDirty(true); setNotice(''); };
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setConflict(false);
    try {
      const data = { ...form, aforoMaximo: Number(form.aforoMaximo), ...(evento ? { version } : {}) };
      const result = await api(evento ? `/configuracion/${evento._id}` : '/configuracion', { method: evento ? 'PUT' : 'POST', body: data });
      setForm(toForm(result.evento)); setVersion(result.evento.__v); setDirty(false);
      await onSaved(result.evento); setNotice('Los datos del evento se guardaron correctamente.');
    } catch (e) { setError(e.message); setConflict(e.status === 409); }
    finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true); setError('');
    try { const result = await api(`/configuracion/${evento._id}`); setForm(toForm(result.evento)); setVersion(result.evento.__v); setDirty(false); setConflict(false); setNotice('Datos actualizados. Puedes volver a editar.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="settings-layout">
    <div className="settings-fields">{error && <div className="alert error" role="alert">{error}{conflict && <button type="button" className="text-button" disabled={busy} onClick={reload}>Descartar mis cambios y recargar</button>}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
      <fieldset disabled={busy}>
        <section className="os-panel form-panel"><div className="panel-heading"><div><span className="panel-icon"><CalendarDays size={19}/></span><h2>Información del evento</h2></div><span className="subtle-tag">{evento ? 'Editar evento' : 'Nuevo evento'}</span></div><p className="panel-subtitle">Define dónde y cuándo sucede la experiencia.</p>
          <SettingsField label="Nombre del evento" value={form.nombre} onChange={value => change('nombre', value)} placeholder="Nombre oficial de tu evento" maxLength={120} required/>
          <div className="form-grid"><SettingsField label="Fecha" type="date" value={form.fecha} onChange={value => change('fecha', value)} required/><SettingsField label="Hora de inicio" type="time" value={form.horario} onChange={value => change('horario', value)} required/></div>
          <SettingsField label="Zona horaria" value={form.zonaHoraria} onChange={value => change('zonaHoraria', value)} placeholder="America/El_Salvador" maxLength={80} required help="Usa el identificador de la zona horaria del evento."/>
          <SettingsField label="Lugar / venue" value={form.venue} onChange={value => change('venue', value)} placeholder="Nombre del recinto" maxLength={120} required/>
          <SettingsField label="Dirección" value={form.direccion} onChange={value => change('direccion', value)} placeholder="Dirección completa del evento" maxLength={250} required/>
        </section>
        <section className="os-panel form-panel"><div className="panel-heading"><div><span className="panel-icon"><Users size={19}/></span><h2>Aforo y disponibilidad</h2></div></div><p className="panel-subtitle">Establece el límite de entradas para la operación.</p><SettingsField label="Aforo máximo" type="number" value={form.aforoMaximo} onChange={value => change('aforoMaximo', value)} min={1} max={1000000} step={1} required help="No puede ser menor que las entradas reservadas o los ingresos registrados."/><label className="switch-row"><span><strong>Evento activo</strong><small>Visible para Taquilla y Portero.</small></span><input type="checkbox" checked={form.activo} onChange={event => change('activo', event.target.checked)}/><span className="switch-track" aria-hidden="true"/></label></section>
        <section className="os-panel form-panel"><div className="panel-heading"><div><span className="panel-icon"><Image size={19}/></span><h2>Identidad del evento</h2></div><span className="subtle-tag">Opcional</span></div><p className="panel-subtitle">Personaliza los datos de la organización del evento.</p><SettingsField label="Nombre de la organización" value={form.marca.nombre} onChange={value => change('marca', { ...form.marca, nombre: value })} maxLength={80}/><SettingsField label="URL del logo" type="url" value={form.marca.logoUrl} onChange={value => change('marca', { ...form.marca, logoUrl: value })} placeholder="https://…" help="Imagen pública mediante HTTPS."/></section>
      </fieldset>
      <div className="settings-save"><span>{dirty ? 'Hay cambios sin guardar' : 'Datos sincronizados'}</span><button type="submit" className="primary-button compact" disabled={busy || (!dirty && !!evento)}>{busy ? <span className="spinner"/> : <Save size={17}/>} {busy ? 'Guardando…' : 'Guardar evento'}</button></div>
    </div>
    <aside className="settings-preview"><section className="preview-card"><div className="preview-art"><span className="preview-orbit"/><TicketMark/></div><span className="page-eyebrow">VISTA PREVIA DEL EVENTO</span><h2>{form.nombre || 'Tu próximo evento'}</h2><dl><div><CalendarDays size={16}/><dd>{form.fecha && !Number.isNaN(new Date(form.fecha).valueOf()) ? dateLabel(form.fecha) : 'Fecha por definir'}</dd></div><div><Clock3 size={16}/><dd>{form.horario || 'Horario por definir'}</dd></div><div><MapPin size={16}/><dd>{form.venue || 'Lugar por definir'}</dd></div><div><Users size={16}/><dd>{form.aforoMaximo ? `${number(Number(form.aforoMaximo))} personas` : 'Aforo por definir'}</dd></div></dl><span className={`status-badge ${form.activo ? 'active' : 'inactive'}`}><span/>{form.activo ? 'Activo' : 'Inactivo'}</span></section><div className="settings-tip"><ShieldCheck size={20}/><div><strong>Una sola fuente de información</strong><p>Los cambios guardados se reflejan en el dashboard y en la operación de tu equipo.</p></div></div><div className="settings-tip"><Settings2 size={20}/><div><strong>Enfocado en tu evento</strong><p>Los precios de entradas, rentas y demás costos se administran externamente.</p></div></div></aside>
  </form>;
}
function SettingsField({ label, value, onChange, help, ...props }) {
  return <label className="settings-field"><span>{label}{props.required && <b aria-hidden="true"> *</b>}</span><input {...props} value={value} onChange={event => onChange(event.target.value)}/>{help && <small>{help}</small>}</label>;
}
function ReadOnlyEvent({ evento }) {
  return <section className="os-panel readonly-event"><div className="panel-heading"><div><CalendarDays size={20}/><h2>{evento.nombre}</h2></div><span className="subtle-tag">Solo consulta</span></div><dl><div><dt>Fecha</dt><dd>{dateLabel(evento.fecha)}</dd></div><div><dt>Hora de inicio</dt><dd>{evento.horario} · {evento.zonaHoraria}</dd></div><div><dt>Lugar</dt><dd>{evento.venue}</dd></div><div><dt>Dirección</dt><dd>{evento.direccion}</dd></div><div><dt>Aforo máximo</dt><dd>{number(evento.aforoMaximo)}</dd></div></dl><p className="panel-footnote">La edición de los datos del evento corresponde al administrador.</p></section>;
}
function TicketMark() { return <span className="preview-mark">N<span>↗</span></span>; }
