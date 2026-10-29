import { useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { StudioEnvironment, useSpring } from './shared'

// Plate cross-section (radius, height), spun around the y axis.
const PROFILE = [
  [0, 0],
  [0.78, 0],
  [0.86, 0.015],
  [0.95, 0.06],
  [1.1, 0.16],
  [1.18, 0.19],
  [1.2, 0.205],
  [1.17, 0.215],
  [1.08, 0.175],
  [0.93, 0.095],
  [0.82, 0.058],
  [0, 0.058],
].map(([x, y]) => new THREE.Vector2(x, y))

/** Adjarian khachapuri: a bread boat with melted cheese, an egg yolk and butter. */
function Khachapuri(props: ThreeElements['group']) {
  return (
    <group {...props}>
      <mesh position-y={0.13} scale={[0.5, 0.15, 0.27]}>
        <sphereGeometry args={[1, 40, 24]} />
        <meshPhysicalMaterial color="#d48a3a" roughness={0.55} clearcoat={0.3} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.46, 0.17, 0]} rotation-z={side * 0.5} scale={[0.1, 0.06, 0.06]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshPhysicalMaterial color="#c47a2c" roughness={0.6} />
        </mesh>
      ))}
      <mesh position-y={0.2} scale={[0.36, 0.09, 0.16]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshPhysicalMaterial color="#ffd96e" roughness={0.35} clearcoat={0.5} />
      </mesh>
      <mesh position-y={0.27} scale={[0.09, 0.065, 0.09]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial color="#ff9a1f" roughness={0.12} clearcoat={1} />
      </mesh>
      <mesh position={[0.15, 0.285, 0.02]} rotation={[0.2, 0.6, 0.1]}>
        <boxGeometry args={[0.07, 0.04, 0.07]} />
        <meshPhysicalMaterial color="#fff2a8" roughness={0.3} />
      </mesh>
    </group>
  )
}

function Salad(props: ThreeElements['group']) {
  const leaves = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2, r: 0.12 + (i % 2) * 0.08, rot: Math.random() * Math.PI })),
    [],
  )
  return (
    <group {...props}>
      {leaves.map((l, i) => (
        <mesh key={i} position={[Math.cos(l.a) * l.r, 0.1, Math.sin(l.a) * l.r]} rotation={[0.3, l.rot, 0.4]} scale={[0.15, 0.04, 0.09]}>
          <sphereGeometry args={[1, 16, 10]} />
          <meshStandardMaterial color="#38c45c" roughness={0.5} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={`t${i}`} position={[Math.cos(i * 2.1) * 0.17, 0.16 + i * 0.01, Math.sin(i * 2.1) * 0.17]} rotation={[0.35, i, 0.2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.045, 28]} />
          <meshPhysicalMaterial color="#ff4a3d" roughness={0.3} clearcoat={0.6} />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh key={`c${i}`} position={[Math.cos(i * 2.6 + 1) * 0.1, 0.2, Math.sin(i * 2.6 + 1) * 0.1]} rotation={[0.5, i, -0.3]}>
          <cylinderGeometry args={[0.1, 0.1, 0.035, 24]} />
          <meshStandardMaterial color="#a6e88a" roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Scene({ mini, still }: { mini: boolean; still: boolean }) {
  const group = useRef<THREE.Group>(null)
  const plateGeometry = useMemo(() => new THREE.LatheGeometry(PROFILE, 96), [])
  const pop = useSpring(1, still ? 1 : 0)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const s = pop.step(delta)
    g.scale.setScalar(s)
    if (still) return
    const t = state.clock.elapsedTime
    // Mini plates spin in quickly, then settle into the same slow turn.
    g.rotation.y += delta * (mini ? 0.6 + 6 * Math.exp(-t * 2.5) : 0.35)
    g.position.y = Math.sin(t * 1.3) * 0.05
  })

  return (
    <>
      <StudioEnvironment />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <pointLight position={[-2.2, 1, -2]} intensity={8} color="#45f0a0" />
      <pointLight position={[2.2, 0.6, -1.6]} intensity={6} color="#7b5cff" />
      <group ref={group} rotation-x={0.12}>
        <mesh geometry={plateGeometry}>
          <meshPhysicalMaterial color="#dfe6e3" roughness={0.35} clearcoat={0.5} envMapIntensity={0.6} />
        </mesh>
        <Khachapuri position={[-0.28, 0.02, 0.12]} rotation-y={0.5} />
        <Salad position={[0.45, 0.02, -0.18]} />
      </group>
    </>
  )
}

/** Slowly spinning plate with khachapuri and a salad. `mini` is the small version shown when food is logged. */
export default function Plate({ mini = false }: { mini?: boolean }) {
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={still ? 'demand' : 'always'}
      camera={{ position: [0, mini ? 2.6 : 2.3, mini ? 2.6 : 3.7], fov: mini ? 40 : 36 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      style={{ touchAction: 'pan-y' }}
      aria-hidden="true"
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
    >
      <Scene mini={mini} still={still} />
    </Canvas>
  )
}
