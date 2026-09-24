import { Component, Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Shape, Vector3, CatmullRomCurve3 } from 'three';
import MascotFallback from './MascotFallback';

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
  const hand = useRef();
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(-1.5, 1.35); s.lineTo(1.5, 1.35); s.quadraticCurveTo(1.82, 1.35, 1.82, 1.03);
    s.lineTo(1.82, .55); s.bezierCurveTo(1.23, .55, 1.23, -.23, 1.82, -.23);
    s.lineTo(1.82, -1.03); s.quadraticCurveTo(1.82, -1.35, 1.5, -1.35);
    s.lineTo(-1.5, -1.35); s.quadraticCurveTo(-1.82, -1.35, -1.82, -1.03);
    s.lineTo(-1.82, -.23); s.bezierCurveTo(-1.23, -.23, -1.23, .55, -1.82, .55);
    s.lineTo(-1.82, 1.03); s.quadraticCurveTo(-1.82, 1.35, -1.5, 1.35);
    return s;
  }, []);
  const smile = useMemo(() => {
    const s = new Shape(); s.moveTo(-.39, -.31);
    s.quadraticCurveTo(0, -.42, .36, -.28); s.quadraticCurveTo(.43, -.24, .43, -.34);
    s.bezierCurveTo(.43, -.94, -.27, -1.03, -.44, -.38); s.quadraticCurveTo(-.46, -.29, -.39, -.31); return s;
  }, []);
  const tongue = useMemo(() => {
    const s = new Shape(); s.moveTo(-.29, -.73); s.quadraticCurveTo(-.05, -.48, .31, -.61);
    s.bezierCurveTo(.19, -.89, -.12, -.96, -.29, -.73); return s;
  }, []);
  const lastPulse = useRef(pulse);
  const bounce = useRef(0);
  useFrame(({ clock, pointer }, delta) => {
    if (++frames.current === 5) onReady();
    const t = clock.getElapsedTime();
    if (lastPulse.current !== pulse) { bounce.current = 1; lastPulse.current = pulse; }
    bounce.current = Math.max(0, bounce.current - delta * 1.4);
    const ease = 1 - Math.exp(-delta * 7);
    group.current.rotation.y += (pointer.x * .18 - group.current.rotation.y) * ease;
    group.current.rotation.x += (-pointer.y * .2 - group.current.rotation.x) * ease;
    group.current.rotation.z = .19 + Math.sin(t * .9) * .025 + Math.sin(bounce.current * Math.PI * 2) * .09;
    hand.current.rotation.z = Math.sin(t * 2) * .06 + Math.sin(bounce.current * Math.PI * 4) * .3;
    group.current.position.y = Math.sin(t * 1.3) * .1 + Math.sin(bounce.current * Math.PI) * .35;
    eyes.current.scale.y = Math.sin(t * 1.1) > .995 ? .12 : 1;
  });
  return <group ref={group}>
    <Stroke color="#007de9" radius={.14} points={[[-1.65,-.82,.02],[-2,-1,.02],[-2.23,-.96,.02]]}/>
    <mesh position={[-2.25,-.91,.02]} scale={[.22,.23,.15]}><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#008dee" roughness={.45}/></mesh>
    <group ref={hand} position={[1.65,-.79,0]}>
      <Stroke color="#008bee" radius={.14} points={[[0,0,0],[.35,.13,0],[.54,.43,0]]}/>
      <mesh position={[.55,.5,0]} scale={[.17,.3,.14]} rotation={[0,0,-.1]}><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#009ce9" roughness={.45}/></mesh>
      <mesh position={[.75,.43,0]} scale={[.15,.22,.14]} rotation={[0,0,-.55]}><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#009ce9" roughness={.45}/></mesh>
    </group>
    <Stroke color="#006ae2" radius={.18} points={[[-.72,-1.19,0],[-.87,-1.61,0],[-1.13,-1.85,.08]]}/>
    <Stroke color="#0089ec" radius={.18} points={[[.35,-1.22,0],[.59,-1.55,0],[.63,-1.86,.12]]}/>
    <mesh position={[-1.14,-1.88,.16]} scale={[.33,.2,.27]}><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#007cf1" roughness={.45}/></mesh>
    <mesh position={[.8,-1.85,.18]} rotation={[0,0,.4]} scale={[.38,.23,.27]}><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#00afe9" roughness={.45}/></mesh>
    <mesh>
      <extrudeGeometry args={[shape, { depth: .24, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .07, bevelThickness: .07, curveSegments: 32 }]}/>
      <meshPhysicalMaterial roughness={.48} metalness={0} clearcoat={.3} onBeforeCompile={shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 ticketPosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nticketPosition = position;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 ticketPosition;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat blend = clamp((ticketPosition.x + ticketPosition.y + 2.5) / 5.0, 0.0, 1.0);\ndiffuseColor.rgb = mix(vec3(0.015,0.06,0.40), vec3(0.0,0.85,0.9), blend);');
      }}/>
    </mesh>
    <group ref={eyes}>
      {[-.62,.62].map(x => <group key={x} position={[x,.13,.34]}>
        <mesh scale={[.22,.34,.045]}><sphereGeometry args={[1,32,32]}/><meshBasicMaterial color="#03133e"/></mesh>
        <mesh position={[-.025,.14,.046]} scale={[.075,.1,.013]}><sphereGeometry args={[1,24,24]}/><meshBasicMaterial color="white"/></mesh>
        <mesh position={[.09,-.13,.041]} scale={[.035,.044,.01]}><sphereGeometry args={[1,16,16]}/><meshBasicMaterial color="white"/></mesh>
      </group>)}
    </group>
    <Stroke radius={.05} points={[[-.81,.6,.34],[-.65,.76,.34],[-.48,.73,.34]]}/>
    <Stroke radius={.05} points={[[.46,.72,.34],[.63,.78,.34],[.8,.66,.34]]}/>
    {[-.88,.88].map(x => <group key={x} position={[x,-.33,.35]}><mesh scale={[.2,.14,.02]}><sphereGeometry args={[1,32,24]}/><meshBasicMaterial color="#ff9cb9"/></mesh><Stroke color="#fff4f8" radius={.02} points={[[-.065,-.025,.025],[-.02,.025,.025]]}/><Stroke color="#fff4f8" radius={.02} points={[[.025,-.025,.025],[.07,.025,.025]]}/></group>)}
    <mesh position={[0,0,.34]}><shapeGeometry args={[smile]}/><meshBasicMaterial color="#00213f"/></mesh>
    <mesh position={[0,0,.355]}><shapeGeometry args={[tongue]}/><meshBasicMaterial color="#f795b7"/></mesh>
    <Stroke color="#ffffff" radius={.035} points={[[-1.48,-.88,.34],[-1.32,-.87,.34],[-1.18,-.68,.34],[-1.1,-.88,.34],[-1.04,-1.07,.34]]}/>
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
    <div className="mascot-fallback"><MascotFallback/></div>
    {enabled && visible && <CanvasBoundary><Suspense fallback={null}><Canvas onClick={() => setPulse(value => value + 1)} camera={{ position: [0,-.15,7.1], fov: 43 }} dpr={[1,1.5]} gl={{ alpha: true, antialias: true }} fallback={<MascotFallback/>} onCreated={({ gl }) => { gl.setClearColor('#edf2fb', 0); }}>
      <ambientLight intensity={1.6}/><pointLight position={[2,4,5]} intensity={60}/><pointLight position={[-3,-2,3]} intensity={25} color="#008cff"/>
      <Mascot pulse={pulse} onReady={() => { if (root.current) root.current.dataset.rendered = 'true'; }}/>
      <mesh position={[0,-2.18,-.3]} scale={[1.8,.14,1]}><circleGeometry args={[1,64]}/><meshBasicMaterial color="#9bc6ff" transparent opacity={.18} depthWrite={false}/></mesh>
    </Canvas></Suspense></CanvasBoundary>}
    <button type="button" className="mascot-greet" onClick={() => setPulse(value => value + 1)} aria-label="Saludar a Pulse, la mascota de TicketPulse">¡Hola, soy Pulse! <span aria-hidden="true">↗</span></button>
  </div>;
}
