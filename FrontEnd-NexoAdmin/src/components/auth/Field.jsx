import { useState, useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Field({ label, icon: Icon, type = 'text', ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="field"><label htmlFor={id}>{label}</label><div className="input-wrap">{Icon && <Icon size={18} aria-hidden="true"/>}<input id={id} type={type === 'password' && visible ? 'text' : type} {...props}/>{type === 'password' && <button type="button" className="reveal" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button>}</div></div>;
}
