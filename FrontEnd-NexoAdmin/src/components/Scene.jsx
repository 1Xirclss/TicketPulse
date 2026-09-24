import { Component, Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Shape, Vector3, CatmullRomCurve3 } from 'three';
import TicketMark from './TicketMark';

class CanvasBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
function Stroke({ points, color = '#00213f', radius = 0.035 }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(p => new Vector3(...p))), [points]);
  return <mesh><tubeGeometry args={[curve, 32, radius, 8, false]}/><meshStandardMaterial color={color}/></mesh>;
}
function Mascot({ pulse, onReady }) {
  const frames = useRef(0);
  const group = useRef();
  const eyes = useRef();
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(-1.7, 1.05); s.lineTo(1.7, 1.05); s.quadraticCurveTo(1.9, 1.05, 1.9, .85);
    s.lineTo(1.9, .4); s.bezierCurveTo(1.35, .4, 1.35, -.4, 1.9, -.4);
    s.lineTo(1.9, -.85); s.quadraticCurveTo(1.9, -1.05, 1.7, -1.05);
    s.lineTo(-1.7, -1.05); s.quadraticCurveTo(-1.9, -1.05, -1.9, -.85);
    s.lineTo(-1.9, -.4); s.bezierCurveTo(-1.35, -.4, -1.35, .4, -1.9, .4);
    s.lineTo(-1.9, .85); s.quadraticCurveTo(-1.9, 1.05, -1.7, 1.05);
    return s;
  }, []);
  const smile = useMemo(() => {
    const s = new Shape(); s.moveTo(-.72, -.15);
    s.quadraticCurveTo(0, -.56, .72, -.15); s.quadraticCurveTo(.38, -1.02, 0, -.86);
    s.quadraticCurveTo(-.4, -.84, -.72, -.15); return s;
  }, []);
  const lastPulse = useRef(pulse);
  const bounce = useRef(0);
  useFrame(({ clock, pointer }, delta) => {
    if (++frames.current === 5) onReady();
    const t = clock.getElapsedTime();
    if (lastPulse.current !== pulse) { bounce.current = 1; lastPulse.current = pulse; }
    bounce.current = Math.max(0, bounce.current - delta * 1.4);
    const ease = 1 - Math.exp(-delta * 7);
    group.current.rotation.y += (pointer.x * .45 - group.current.rotation.y) * ease;
    group.current.rotation.x += (-pointer.y * .2 - group.current.rotation.x) * ease;
    group.current.rotation.z = -.14 + Math.sin(t * .9) * .035 + Math.sin(bounce.current * Math.PI * 2) * .15;
    group.current.position.y = Math.sin(t * 1.3) * .1 + Math.sin(bounce.current * Math.PI) * .35;
    eyes.current.scale.y = Math.sin(t * 1.1) > .995 ? .12 : 1;
  });
  return <group ref={group}>
    <mesh>
      <extrudeGeometry args={[shape, { depth: .24, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .07, bevelThickness: .07, curveSegments: 32 }]}/>
      <meshPhysicalMaterial roughness={.3} metalness={.25} clearcoat={1} onBeforeCompile={shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 ticketPosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nticketPosition = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 ticketPosition;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat blend = clamp((ticketPosition.x + ticketPosition.y + 2.5) / 5.0, 0.0, 1.0);\ndiffuseColor.rgb = mix(vec3(0.015,0.06,0.40), vec3(0.0,0.85,0.9), blend);');
      }}/>
    </mesh>
    <group ref={eyes}>
      {[-.48,.48].map(x => <mesh key={x} position={[x,.35,.34]} scale={[.115,.25,.065]}><sphereGeometry args={[1,24,24]}/><meshStandardMaterial color="#00213f"/></mesh>)}
      {[-.48,.48].map(x => <mesh key={x} position={[x-.025,.44,.405]} scale={[.027,.05,.01]}><sphereGeometry args={[1,12,12]}/><meshBasicMaterial color="white"/></mesh>)}
    </group>
    <Stroke points={[[-.65,.72,.34],[-.5,.8,.34],[-.35,.74,.34]]}/>
    <Stroke points={[[.35,.74,.34],[.5,.8,.34],[.65,.72,.34]]}/>
    <mesh position={[0,0,.34]}><shapeGeometry args={[smile]}/><meshBasicMaterial color="#00213f"/></mesh>
    <mesh position={[.02,-.72,.35]} scale={[.28,.105,.018]}><sphereGeometry args={[1,24,16]}/><meshBasicMaterial color="#f582a7"/></mesh>
    <Stroke color="#ffffff" radius={.025} points={[[-1.15,-.62,.34],[-.99,-.62,.34],[-.92,-.48,.34],[-.83,-.78,.34]]}/>
  </group>;
}
export default function Scene() {
  const [enabled, setEnabled] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [visible, setVisible] = useState(true);
  const root = useRef();
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(!reduced.matches);
    update(); reduced.addEventListener('change', update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(root.current);
    return () => { reduced.removeEventListener('change', update); observer.disconnect(); };
  }, []);
  return <div ref={root} className="scene ticketpulse-scene">
    <div className="mascot-fallback"><TicketMark face/></div>
    {enabled && visible && <CanvasBoundary><Suspense fallback={null}><Canvas onClick={() => setPulse(value => value + 1)} camera={{ position: [0,0,6.5], fov: 43 }} dpr={[1,1.5]} gl={{ alpha: true, antialias: true }} fallback={<TicketMark face/>} onCreated={({ gl }) => { gl.setClearColor('#edf2fb', 0); }}>
      <ambientLight intensity={1.6}/><pointLight position={[2,4,5]} intensity={60}/><pointLight position={[-3,-2,3]} intensity={25} color="#008cff"/>
      <Mascot pulse={pulse} onReady={() => { if (root.current) root.current.dataset.rendered = 'true'; }}/>
    </Canvas></Suspense></CanvasBoundary>}
    <button type="button" className="mascot-greet" onClick={() => setPulse(value => value + 1)} aria-label="Saludar a Pulse, la mascota de TicketPulse">¡Hola, soy Pulse! <span aria-hidden="true">↗</span></button>
  </div>;
}
