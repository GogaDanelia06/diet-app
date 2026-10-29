import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { StudioEnvironment, useSpring } from './shared'

const CONFETTI = 90
const COLORS = ['#45f0a0', '#ff5fa2', '#ffc547', '#5ea8ff', '#7b5cff', '#ffffff'].map((c) => new THREE.Color(c))

function starShape(outer: number, inner: number) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

function Confetti({ still }: { still: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const parts = useMemo(
    () =>
      Array.from({ length: CONFETTI }, () => {
        const a = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 3
        return {
          p: new THREE.Vector3(0, 0, 0.3),
          v: new THREE.Vector3(Math.cos(a) * speed * 0.6, Math.sin(a) * speed * 0.5 + 2.5, (Math.random() - 0.3) * 2),
          r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
          spin: (Math.random() - 0.5) * 12,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        }
      }),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colored = useRef(false)

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    if (!colored.current) {
      parts.forEach((p, i) => m.setColorAt(i, p.color))
      m.instanceColor!.needsUpdate = true
      colored.current = true
    }
    const dt = Math.min(delta, 0.05)
    parts.forEach((p, i) => {
      if (!still) {
        p.v.y -= 4.5 * dt
        p.v.multiplyScalar(1 - 0.6 * dt)
        p.p.addScaledVector(p.v, dt)
        p.r.x += p.spin * dt
        p.r.y += p.spin * 0.7 * dt
      }
      dummy.position.copy(p.p)
      dummy.rotation.copy(p.r)
      dummy.scale.setScalar(p.p.y < -3.5 || still ? 0 : 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI]}>
      <planeGeometry args={[0.09, 0.045]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  )
}

function Coin({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null)
  const star = useMemo(
    () => new THREE.ExtrudeGeometry(starShape(0.55, 0.24), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }),
    [],
  )
  const pop = useSpring(1, still ? 1 : 0.2, 140, 10)
  const age = useRef(0)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    age.current += delta
    g.scale.setScalar(pop.step(delta))
    if (still) return
    // Spin in fast, slow down, then sway.
    const spin = Math.exp(-age.current * 1.6) * Math.PI * 6
    g.rotation.y = spin + Math.sin(state.clock.elapsedTime * 1.4) * 0.35
    g.position.y = Math.sin(state.clock.elapsedTime * 1.8) * 0.06
  })

  return (
    <group ref={group}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1, 1, 0.16, 72]} />
        <meshStandardMaterial color="#ffc93c" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh>
        <torusGeometry args={[1, 0.075, 18, 90]} />
        <meshStandardMaterial color="#f0a91c" metalness={0.95} roughness={0.2} />
      </mesh>
      <mesh geometry={star} position-z={0.06}>
        <meshStandardMaterial color="#ffe37a" metalness={0.85} roughness={0.18} />
      </mesh>
      <mesh geometry={star} position-z={-0.06} rotation-y={Math.PI}>
        <meshStandardMaterial color="#ffe37a" metalness={0.85} roughness={0.18} />
      </mesh>
    </group>
  )
}

/** Spinning gold medal with a burst of confetti, shown when an achievement unlocks. */
export default function Medal() {
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={still ? 'demand' : 'always'}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      aria-hidden="true"
    >
      <StudioEnvironment />
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 3, 4]} intensity={2.5} />
      <pointLight position={[-2, -1, 2]} intensity={10} color="#45f0a0" />
      <Coin still={still} />
      <Confetti still={still} />
    </Canvas>
  )
}
