const currency = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' });
const integer = new Intl.NumberFormat('es-SV');
export const money = cents => currency.format(cents / 100);
export const number = value => integer.format(value);
export const dateLabel = value => new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
export const timeLabel = (value, zone) => new Intl.DateTimeFormat('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, ...(zone ? { timeZone: zone } : {}) }).format(new Date(value));
