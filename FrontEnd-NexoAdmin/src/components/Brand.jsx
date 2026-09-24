import { Link } from 'react-router-dom';
import TicketMark from './TicketMark';
export default function Brand({ to = '/' }) {
  return <Link className="brand ticketpulse-brand" to={to} aria-label="TicketPulse, inicio"><TicketMark/><span>Ticket<span className="brand-light">Pulse</span><small>EVENT OPERATING SYSTEM</small></span></Link>;
}
