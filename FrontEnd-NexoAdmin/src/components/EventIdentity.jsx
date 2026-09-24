export default function EventIdentity({ marca }) {
  if (!marca?.nombre && !marca?.logoUrl) return null;
  return <div className="event-identity">{marca.logoUrl?.startsWith('https://') && <img key={marca.logoUrl} src={marca.logoUrl} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }}/>}<span>{marca.nombre}</span></div>;
}
