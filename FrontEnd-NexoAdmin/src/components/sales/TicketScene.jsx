import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { money, dateLabel } from '../../utils/format';
function drawLines(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text).split(' '); let line = '', index = 0;
  for (const word of words) {
    if (ctx.measureText(line + word).width > maxWidth && line) { ctx.fillText(line.trim(), x, y + index * lineHeight); index++; line = ''; }
    if (index >= maxLines) return;
    line += word + ' ';
  }
  ctx.fillText(line.trim(), x, y + index * lineHeight);
}
function Card({ data, qr }) {
  const group = useRef();
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1500;
    const ctx = canvas.getContext('2d'); const gradient = ctx.createLinearGradient(0,0,1000,1500);
    gradient.addColorStop(0,'#445A71'); gradient.addColorStop(0.48,'#1E3040'); gradient.addColorStop(1,'#1A191E');
    ctx.fillStyle = gradient; ctx.fillRect(0,0,1000,1500);
    ctx.strokeStyle = '#9CABBB66'; ctx.lineWidth = 2; ctx.strokeRect(32,32,936,1436);
    ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('NEXOADMIN',70,120);
    ctx.fillStyle = '#b4c9dc'; ctx.font = '20px monospace'; ctx.fillText('EVENT PASS / ' + data.venta.categoria.toUpperCase(),70,167);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 56px sans-serif'; drawLines(ctx,data.evento.nombre,70,270,850,65);
    ctx.fillStyle = '#c4d4e0'; ctx.font = '24px sans-serif'; ctx.fillText(dateLabel(data.evento.fecha) + ' · ' + data.evento.horario,70,440);
    drawLines(ctx,data.evento.venue,70,485,850,30,1);
    ctx.setLineDash([8,10]); ctx.strokeStyle = '#9CABBB'; ctx.beginPath(); ctx.moveTo(65,550); ctx.lineTo(935,550); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#9CABBB'; ctx.font = '20px monospace'; ctx.fillText('ASISTENTE',70,615);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 39px sans-serif'; drawLines(ctx,data.venta.nombreAsistente,70,675,850,49);
    ctx.fillStyle = '#afc4d8'; ctx.font = '26px sans-serif'; ctx.fillText(data.venta.cantidad + ' entrada(s) · ' + money(data.venta.montoCentavos),70,800);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(310,870,380,380); ctx.imageSmoothingEnabled = false; ctx.drawImage(qr,330,890,340,340);
    ctx.textAlign = 'center'; ctx.fillStyle = '#e0eaf1'; ctx.font = '25px monospace'; ctx.fillText(data.venta.ticketCode,500,1315);
    ctx.fillStyle = data.venta.anulada ? '#ef4444' : data.venta.estadoPago === 'CANCELADO' ? '#7ce1bd' : '#f5c369';
    ctx.font = 'bold 26px sans-serif'; ctx.fillText(data.venta.anulada ? 'ANULADA - SIN VALIDEZ' : data.venta.estadoPago === 'CANCELADO' ? 'PAGADO' : 'PENDIENTE DE PAGO',500,1400);
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; return map;
  }, [data,qr]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ pointer }) => {
    if (!group.current) return;
    group.current.rotation.y += (pointer.x * 0.22 - group.current.rotation.y) * 0.08;
    group.current.rotation.x += (-pointer.y * 0.16 - group.current.rotation.x) * 0.08;
  });
  return <group ref={group}><mesh><boxGeometry args={[2.8,4.2,0.07]}/><meshStandardMaterial color="#9CABBB" metalness={0.9} roughness={0.2}/></mesh><mesh position={[0,0,0.041]}><planeGeometry args={[2.76,4.16]}/><meshBasicMaterial map={texture}/></mesh></group>;
}
export default function TicketScene({ data, qrImage }) {
  return <Canvas camera={{ position:[0,0,6.4], fov:43 }} dpr={[1,1.5]}><ambientLight intensity={1}/><pointLight position={[3,4,3]} intensity={30}/><Card data={data} qr={qrImage}/></Canvas>;
}
