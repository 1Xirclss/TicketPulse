import { Component, Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

class CanvasBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
function Sculpture() {
  const group = useRef();
  const particles = useMemo(() => {
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = Math.sin(i * 127.1 + 311.7) * 7;
    return positions;
  }, []);
  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    group.current.rotation.y += (pointer.x * 0.35 - group.current.rotation.y) * 0.025;
    group.current.rotation.x += (-pointer.y * 0.2 - group.current.rotation.x) * 0.025;
    group.current.position.y = Math.sin(t * 0.6) * 0.1;
  });
  return <>
    <ambientLight intensity={0.7}/><pointLight position={[2, 4, 5]} intensity={65} color="#d0d9e2"/><pointLight position={[-4, -2, 2]} intensity={35} color="#445a71"/>
    <group ref={group} rotation={[0.1, 0, -0.28]}>
      <mesh rotation={[0.6, 0.2, 0]}><torusGeometry args={[1.65, 0.28, 32, 100]}/><meshPhysicalMaterial color="#8098af" metalness={0.92} roughness={0.22} clearcoat={1}/></mesh>
      <mesh rotation={[-0.8, 0.6, 0.5]}><torusGeometry args={[1.65, 0.075, 20, 100]}/><meshStandardMaterial color="#e3e8ed" metalness={0.75} roughness={0.2}/></mesh>
      <mesh rotation={[0.4, 0.4, 0]}><octahedronGeometry args={[0.8, 0]}/><meshPhysicalMaterial color="#b9c6d3" metalness={0.85} roughness={0.17} clearcoat={1}/></mesh>
    </group>
    <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[particles, 3]}/></bufferGeometry><pointsMaterial size={0.018} color="#bac6d3" transparent opacity={0.55}/></points>
  </>;
}
export default function Scene() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      setEnabled(!reduced.matches && !!gl);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    };
    update(); reduced.addEventListener('change', update);
    return () => reduced.removeEventListener('change', update);
  }, []);
  return <div className="scene" aria-hidden="true"><div className="orbit-fallback"/>{enabled && <CanvasBoundary><Suspense fallback={null}><Canvas camera={{ position: [0, 0, 6.5], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }}><Sculpture/></Canvas></Suspense></CanvasBoundary>}</div>;
}
