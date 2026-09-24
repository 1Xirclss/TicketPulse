import { lazy, Suspense } from 'react';
import { ArrowUpRight, Fingerprint, Layers3, ScanLine, ShieldCheck } from 'lucide-react';
import Brand from '../Brand';
export { default as Brand } from '../Brand';
const Scene = lazy(() => import('../Scene'));

export default function AuthLayout({ children }) {
  return <div className="auth-shell">
    <aside className="experience">
      <Brand/>
      <div className="hero-copy"><div className="eyebrow"><span/> EL CONTROL DETRÁS DE CADA EXPERIENCIA</div><h1>Grandes eventos.<br/>Todo <span>conectado.</span></h1><p>Un solo lugar para coordinar tu evento.<br/>Desde la primera entrada hasta el último acceso.</p></div>
      <div className="visual"><Suspense fallback={<div className="scene"/>}><Scene/></Suspense><div className="visual-label"><span className="cross">+</span><span>CONEXIÓN SIN LÍMITES<small>Diseñado para lo que viene.</small></span><ArrowUpRight size={20}/></div></div>
      <div className="feature-row"><div><Layers3 size={18}/><span>Gestión centralizada</span></div><div><ScanLine size={18}/><span>Control de acceso</span></div><div><ShieldCheck size={18}/><span>Operación segura</span></div></div>
      <footer className="experience-footer"><span>TICKETPULSE / PLATAFORMA DE EVENTOS</span><span>HECHO PARA CONECTAR <ArrowUpRight size={12}/></span></footer>
    </aside>
    <section className="form-side"><div className="form-top"><span><Fingerprint size={16}/> ACCESO A LA PLATAFORMA</span><span className="private-badge"><span/> Espacio privado</span></div><div className="mobile-brand"><Brand/></div><div className="mobile-mascot"><Suspense fallback={null}><Scene/></Suspense></div><div className="form-content">{children}</div><footer className="form-footer"><ShieldCheck size={15}/><span>Tu operación empieza con un acceso seguro.</span></footer></section>
  </div>;
}
