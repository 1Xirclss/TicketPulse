const configuredApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

// En producción, todas las solicitudes pasan por el proxy de Vercel. Así la API
// comparte origen con la SPA y los navegadores móviles no bloquean la sesión.
export const API_URL = (import.meta.env.PROD ? '/api' : configuredApiUrl || '/api').replace(/\/$/, '');
