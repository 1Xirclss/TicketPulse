import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, CalendarDays, ChartNoAxesCombined, ChevronDown, Clock3, DoorOpen, LogOut, Radio, Settings2, ShieldCheck, Ticket } from 'lucide-react';
import Brand from '../Brand';
import { useAuth } from '../../hooks/useAuth';
import { EventProvider, useEvent } from '../../context/EventContext';
import { timeLabel } from '../../utils/format';

function Shell() {
  const { user, logout } = useAuth();
  const { eventos, selectedId, selectEvent, evento, loading, error } = useEvent();
  const [now, setNow] = useState(Date.now());
  const [exitError, setExitError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function exit() { setBusy(true); try { await logout(); } catch (e) { setExitError(e.message); } finally { setBusy(false); } }
  return <div className="os-shell">
    <aside className="os-sidebar"><Brand/><div className="workspace-label"><span className="workspace-symbol"><Ticket size={19}/></span><span>Event workspace<small>Centro de operaciones</small></span></div><p className="nav-caption">PRINCIPAL</p>
      <nav aria-label="Navegación principal">
        <NavLink to="/" end><ChartNoAxesCombined size={18}/><span>Dashboard</span><span className="nav-dot"/></NavLink>
        {user.rol !== 'Portero' && <NavLink to="/ventas"><Ticket size={18}/><span>Ventas y asistentes</span></NavLink>}
        <NavLink to="/puerta"><DoorOpen size={18}/><span>Control en puerta</span></NavLink>
        <NavLink to="/evento"><CalendarDays size={18}/><span>Datos del evento</span></NavLink>
      </nav>
      <div className="sidebar-note"><Activity size={20}/><strong>Todo conectado.</strong><p>La información de tu evento, en un mismo lugar.</p><span>NEXO / EVENT OS</span></div>
      <div className="sidebar-bottom"><ShieldCheck size={16}/><span>Acceso de {user.rol}</span></div>
    </aside>
    <div className="os-main"><header className="os-header"><div className="mobile-os-brand"><Brand/></div><div className="event-selector"><CalendarDays size={17}/><label className="sr-only" htmlFor="active-event">Evento seleccionado</label><select id="active-event" value={selectedId} disabled={loading || !eventos.length} onChange={e => selectEvent(e.target.value)}>{!eventos.length && <option value="">{loading ? 'Cargando eventos…' : 'Sin eventos disponibles'}</option>}{eventos.map(item => <option key={item._id} value={item._id}>{item.nombre}{item.activo ? '' : ' · Inactivo'}</option>)}</select><ChevronDown size={14}/></div><div className="header-tools"><div className="live-clock"><Clock3 size={14}/><time>{timeLabel(now, evento?.zonaHoraria)}</time></div><div className="header-user"><span className="user-avatar">{user.nombre.slice(0, 1).toUpperCase()}</span><span>{user.nombre}<small>{user.rol}</small></span></div><button className="icon-button" onClick={exit} disabled={busy} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18}/></button></div></header>
      <nav className="mobile-os-nav" aria-label="Navegación móvil">
        <NavLink to="/" end><ChartNoAxesCombined size={16}/> Dashboard</NavLink>
        {user.rol !== 'Portero' && <NavLink to="/ventas"><Ticket size={16}/> Ventas</NavLink>}
        <NavLink to="/puerta"><DoorOpen size={16}/> Puerta</NavLink>
        <NavLink to="/evento"><Settings2 size={16}/> Evento</NavLink>
      </nav>
      <main className="os-content">{exitError && <div className="alert error" role="alert">{exitError}</div>}{error && <div className="alert error" role="alert">No se pudo actualizar la lista de eventos: {error}</div>}<Outlet/></main>
      <footer className="os-footer"><span>NEXOADMIN <span className="footer-slash">/</span> EVENT OPERATING SYSTEM</span><span><Radio size={12}/> {error ? 'Conexión pendiente' : 'Datos consultados desde tu organización'}</span></footer>
    </div>
  </div>;
}
export default function MainLayout() { return <EventProvider><Shell/></EventProvider>; }
