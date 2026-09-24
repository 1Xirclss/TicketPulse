import { useId } from 'react';
export default function TicketMark({ face = false }) {
  const id = useId();
  return <svg viewBox="0 0 240 160" fill="none" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="150" x2="220" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#071b70"/><stop offset=".5" stopColor="#0069f5"/><stop offset="1" stopColor="#00e0da"/></linearGradient></defs>
    <path d="M24 8H216Q232 8 232 24V51C200 51 200 109 232 109V136Q232 152 216 152H24Q8 152 8 136V109C40 109 40 51 8 51V24Q8 8 24 8Z" fill={`url(#${id})`}/>
    <path d="M24 138 146 8H200L75 152H24Z" fill="#009aff" opacity=".25"/>
    {face ? <><ellipse cx="91" cy="59" rx="8" ry="17" fill="#00213f"/><ellipse cx="151" cy="59" rx="8" ry="17" fill="#00213f"/><path d="M82 33Q90 25 99 33M142 33Q151 25 160 33" stroke="#00213f" strokeWidth="4" strokeLinecap="round"/><path d="M74 90Q120 125 169 90Q150 149 120 141Q91 137 74 90" fill="#00213f"/><path d="M99 131Q119 115 143 132Q121 146 99 131" fill="#f582a7"/></> : <path d="M26 87H76L88 67 103 109 126 30 145 126 165 76 176 92H214" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>;
}
