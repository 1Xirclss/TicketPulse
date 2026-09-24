import { API_URL } from '../config';

export async function api(path, { method = 'GET', body, signal, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { method, credentials: 'include', signal, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No pudimos conectar con el servidor. Comprueba tu conexión.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({ message: 'El servidor no está disponible.' }));
  if (!response.ok) throw Object.assign(new Error(data.message || 'Error en la solicitud.'), { status: response.status, ...data });
  return data;
}
