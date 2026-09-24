import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../utils/api';
export default function useSales(query) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const request = useRef(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    if (!query) { setState({ data: null, loading: false, error: '' }); return; }
    const controller = new AbortController(); request.current = controller;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try { const data = await api('/ventas?' + query, { signal: controller.signal }); if (!controller.signal.aborted) setState({ data, loading: false, error: '' }); }
    catch (e) { if (!controller.signal.aborted) setState({ data: null, loading: false, error: e.message }); }
  }, [query]);
  useEffect(() => { refresh(); return () => request.current?.abort(); }, [refresh]);
  return { ...state, refresh };
}
