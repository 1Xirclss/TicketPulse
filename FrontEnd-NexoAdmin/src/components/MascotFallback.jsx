import { useId } from 'react';

export default function MascotFallback() {
  const gradient = useId();
  return <svg viewBox="0 0 320 280" fill="none" aria-hidden="true">
    <defs><linearGradient id={gradient} x1="40" y1="200" x2="270" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#0432d8"/><stop offset=".5" stopColor="#00b8ed"/><stop offset="1" stopColor="#60eee0"/></linearGradient></defs>
    <ellipse cx="160" cy="258" rx="103" ry="11" fill="#bfd9ff" opacity=".5"/>
    <g transform="rotate(-11 160 140)">
      <path d="M61 174Q29 204 23 182M257 179Q289 171 296 153M119 217Q110 238 98 243M179 213Q198 229 193 245" stroke="#008bee" strokeWidth="17" strokeLinecap="round"/>
      <ellipse cx="20" cy="182" rx="12" ry="14" fill="#008eef"/>
      <ellipse cx="298" cy="147" rx="9" ry="18" fill="#009eea"/><ellipse cx="309" cy="154" rx="8" ry="12" fill="#009eea"/>
      <ellipse cx="94" cy="248" rx="20" ry="12" fill="#0078ed"/><ellipse cx="204" cy="248" rx="22" ry="13" fill="#00a6ee"/>
      <path d="M68 35H249Q268 35 268 54V91C231 91 231 137 268 137V201Q268 221 249 221H68Q49 221 49 201V137C86 137 86 91 49 91V54Q49 35 68 35Z" fill={`url(#${gradient})`}/>
      <path d="M112 94Q121 77 134 86M184 85Q197 78 207 91" stroke="#03133e" strokeWidth="6" strokeLinecap="round"/>
      {[124,196].map(x => <g key={x}><ellipse cx={x} cy="122" rx="13" ry="21" fill="#03133e"/><ellipse cx={x-2} cy="113" rx="4.7" ry="6" fill="white"/><ellipse cx={x+5} cy="131" rx="2.2" ry="2.7" fill="white"/></g>)}
      {[108,212].map(x => <g key={x}><ellipse cx={x} cy="153" rx="12" ry="8" fill="#ff9cb9"/><path d={`M${x-5} 155l3-4m3 4 3-4`} stroke="#fff4f8" strokeWidth="2.7" strokeLinecap="round"/></g>)}
      <path d="M135 152Q160 160 184 152C188 198 145 206 135 152Z" fill="#03133e"/>
      <path d="M145 182Q159 167 180 176Q168 199 145 182Z" fill="#f795b7"/>
      <path d="M69 190l11-1 8-13 8 28" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  </svg>;
}
