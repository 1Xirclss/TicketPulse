import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

export default function useDashboard(eventId) {
  const [state, setState] = useState({ data: null, error: '', loading: false, updating: false });
  const request = useRef(null);
  const load = useCallback(async () => {
    request.current?.abort();
    if (!eventId) { setState({ data: null, error: '', loading: false, updating: false }); return; }
    const controller = new AbortController(); request.current = controller;
    setState(previous => ({ ...previous, loading: !previous.data || previous.data.evento._id !== eventId, updating: true }));
    try {
      const data = await api(`/dashboard/stats?evento=${encodeURIComponent(eventId)}`, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ data, error: '', loading: false, updating: false });
    } catch (e) {
      if (e.name !== 'AbortError') setState(previous => ({ ...previous, ...([401, 403, 404].includes(e.status) ? { data: null } : {}), error: e.message, loading: false, updating: false }));
    }
  }, [eventId]);
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000);
    const visible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { request.current?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [load]);
  return { ...state, data: state.data?.evento._id === eventId ? state.data : null, refresh: load };
}
