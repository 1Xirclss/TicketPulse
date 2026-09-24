import { useState } from 'react';
import { money } from '../../utils/format';

export default function RevenueChart({ data, total }) {
  const [selected, setSelected] = useState(null);
  const selectedData = data.find(item => item.metodo === selected);
  let cumulative = 0;
  return <div className="revenue-chart"><div className="donut-wrap"><svg viewBox="0 0 220 220" role="img" aria-label={`Liquidación total ${money(total)}`}><circle cx="110" cy="110" r="82" fill="none" stroke="#34495c" strokeWidth="22"/>{data.map(item => {
    const fraction = total > 0 ? item.centavos / total : 0;
    const offset = cumulative; cumulative += fraction;
    return <circle key={item.metodo} cx="110" cy="110" r="82" fill="none" stroke={item.metodo === 'Efectivo' ? '#445a71' : '#9cabbb'} strokeWidth={selected === item.metodo ? 27 : 22} pathLength="100" strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`} strokeDashoffset={-offset * 100} transform="rotate(-90 110 110)" opacity={selected && selected !== item.metodo ? 0.35 : 1} onMouseEnter={() => setSelected(item.metodo)} onMouseLeave={() => setSelected(null)}><title>{item.metodo}: {money(item.centavos)} · {item.porcentaje}%</title></circle>;
  })}</svg><div className="donut-center"><span>{selectedData ? selectedData.metodo : 'TOTAL RECAUDADO'}</span><strong>{money(selectedData ? selectedData.centavos : total)}</strong><small>{total ? 'USD · Pagos confirmados' : 'Sin pagos registrados'}</small></div></div><div className="chart-legend">{data.map(item => <button key={item.metodo} onMouseEnter={() => setSelected(item.metodo)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(item.metodo)} onBlur={() => setSelected(null)} onClick={() => setSelected(selected === item.metodo ? null : item.metodo)} aria-pressed={selected === item.metodo}><span className={`legend-dot ${item.metodo === 'Transferencia' ? 'magenta' : ''}`}/><span>{item.metodo}</span><strong>{money(item.centavos)}</strong><small>{item.porcentaje}%</small></button>)}</div></div>;
}
