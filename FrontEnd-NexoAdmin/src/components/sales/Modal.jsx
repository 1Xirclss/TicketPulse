import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
export default function Modal({ title, onClose, busy = false, children, className = '' }) {
  const dialog = useRef(null); const titleId = useId();
  useEffect(() => {
    const node = dialog.current; node.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} className={'sales-dialog ' + className} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="dialog-header"><div><span className="page-eyebrow">NEXO / EVENT OPERATIONS</span><h2 id={titleId}>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar ventana"><X size={19}/></button></header>
    {children}
  </dialog>;
}
