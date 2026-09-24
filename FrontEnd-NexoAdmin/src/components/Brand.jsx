import { useId } from 'react';
import { Link } from 'react-router-dom';

export default function Brand({ to = '/' }) {
  const gradient = useId();
  return <Link className="brand nexo-brand" to={to} aria-label="NexoAdmin, inicio">
    <svg className="nexo-isotype" viewBox="0 0 56 60" fill="none" aria-hidden="true">
      <defs><linearGradient id={gradient} x1="6" y1="5" x2="48" y2="52" gradientUnits="userSpaceOnUse"><stop stopColor="#9cabbb"/><stop offset=".5" stopColor="#b2c0ce"/><stop offset="1" stopColor="#445a71"/></linearGradient></defs>
      <path d="M5 17 15 11 42 27 42 49 32 55 5 39Z" fill="#2c3a47"/>
      <path d="M15 11 24 16 38 41 38 24 47 29 47 51 38 56 24 31 24 48 15 43Z" fill={`url(#${gradient})`}/>
      <path d="m15 11 9-5 9 5 14 25-9 5-14-25Z" fill="#d1dae3"/>
      <path d="m38 24 9-5 9 5-9 5Z" fill="#b5c3d0"/>
      <path d="m47 29 9-5v22l-9 5Z" fill="#506981"/>
      <path d="m25 22 12 21" stroke="#e0e6eb" strokeWidth="1.5"/>
    </svg><span>nexo<span className="brand-light">admin</span><small>EVENT OPERATING SYSTEM</small></span>
  </Link>;
}
