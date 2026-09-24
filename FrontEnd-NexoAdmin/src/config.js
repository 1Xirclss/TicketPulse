export const API_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://ticketpulse-af28.onrender.com/api'
).replace(/\/$/, '');
