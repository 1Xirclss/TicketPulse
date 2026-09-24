import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

const EventContext = createContext(null);
export const useEvent = () => useContext(EventContext);
export function EventProvider({ children }) {
  const [eventos, setEventos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const data = await api('/configuracion');
      if (current !== revision.current) return;
      setEventos(data.eventos);
      setSelectedId(previous => data.eventos.some(evento => evento._id === previous) ? previous : (data.eventos.find(evento => evento.activo)?._id || data.eventos[0]?._id || ''));
      setError('');
    } catch (e) { if (current === revision.current) setError(e.message); }
    finally { if (current === revision.current) setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { revision.current++; clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return <EventContext.Provider value={{ eventos, selectedId, selectEvent: setSelectedId, evento: eventos.find(evento => evento._id === selectedId), loading, error, refresh }}>{children}</EventContext.Provider>;
}
