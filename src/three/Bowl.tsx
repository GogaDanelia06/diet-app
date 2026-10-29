import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FitWidth, prefersStill, StudioEnvironment, useOnScreen, useSoftShadow } from './shared'

// Bowl: outer wall radius 1, inner radius 0.92, both centred at y = 0.25 (the rim).
const RIM_Y = 0.25
const INNER_R = 0.92
const FLOOR_Y = RIM_Y - INNER_R + 0.05
const FULL_Y = RIM_Y - 0.06 // level when exactly on budget
const MOUND_Y = RIM_Y + 0.22 // highest point when well over budget

const LIME = new THREE.Color('#d4f57a')
const CORAL = new THREE.Color('#ff957b')

// Bowl cross-section (radius, height), spun around the y axis.
function bowlProfile() {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -0.82), new THREE.Vector2(0.36, -0.82), new THREE.Vector2(0.4, -0.74)]
  const outerStart = Math.asin(0.4) // where the foot meets the outer wall
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + outerStart + (i / 24) * (Math.PI / 2 - outerStart)
    pts.push(new THREE.Vector2(Math.cos(a), RIM_Y + Math.sin(a)))
  }
  pts.push(new THREE.Vector2(0.985, RIM_Y + 0.025), new THREE.Vector2(0.94, RIM_Y + 0.02))
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.cos(a) * INNER_R, RIM_Y - Math.sin(a) * INNER_R))
  }
  return pts
}

type Kind = 'leaf' | 'tomato' | 'cucumber' | 'chickpea' | 'feta' | 'corn'

interface Piece {
  kind: Kind
  base: THREE.Vector3
  rot: THREE.Euler
  size: number
  shown: number // 0 hidden … 1 settled, animates the drop-in
  hop: number // random strength for the toss animation
  color: THREE.Color
}

/** A seeded random generator so the salad looks the same on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function pickKind(r: number): Kind {
  if (r < 0.4) return 'leaf'
  if (r < 0.55) return 'tomato'
  if (r < 0.7) return 'cucumber'
  if (r < 0.82) return 'chickpea'
  if (r < 0.92) return 'feta'
  return 'corn'
}

const LEAF_COLORS = ['#8cc152', '#6fae45', '#b9dc6e', '#a3cf5c'].map((c) => new THREE.Color(c))

/** Food pieces packed in layers from the bottom of the bowl up to a small mound above the rim. */
function buildPieces(): Piece[] {
  const rand = rng(7)
  const pieces: Piece[] = []
  for (let y = FLOOR_Y; y <= MOUND_Y; y += 0.075) {
    const inside = y <= RIM_Y
    const r = inside
      ? Math.sqrt(Math.max(0, INNER_R * INNER_R - (y - RIM_Y) ** 2)) - 0.08
      : 0.82 * Math.sqrt(Math.max(0, 1 - ((y - RIM_Y) / (MOUND_Y - RIM_Y + 0.05)) ** 2))
    if (r <= 0.02) {
      if (y === FLOOR_Y) continue
      if (!inside) break
    }
    const n = Math.max(1, Math.round((Math.PI * r * r) / 0.032))
    for (let i = 0; i < n; i++) {
      // Sunflower spiral so pieces spread evenly, with a little jitter.
      const a = i * 2.39996 + rand() * 0.6
      const d = Math.sqrt((i + 0.5) / n) * r
      const kind = pickKind(rand())
      pieces.push({
        kind,
        base: new THREE.Vector3(Math.cos(a) * d, y + (rand() - 0.5) * 0.04, Math.sin(a) * d),
        rot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
        size: 0.85 + rand() * 0.35,
        shown: 0,
        hop: 0.5 + rand(),
        color: kind === 'leaf' ? LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)] : new THREE.Color(),
      })
    }
  }
  return pieces.sort((p, q) => p.base.y - q.base.y)
}

const KINDS: { kind: Kind; geometry: () => THREE.BufferGeometry; color: string; roughness: number; clearcoat?: number }[] = [
  { kind: 'leaf', geometry: () => new THREE.SphereGeometry(1, 14, 8).scale(0.13, 0.03, 0.085), color: '#ffffff', roughness: 0.55 },
  { kind: 'tomato', geometry: () => new THREE.SphereGeometry(0.068, 16, 12), color: '#e8553e', roughness: 0.25, clearcoat: 1 },
  { kind: 'cucumber', geometry: () => new THREE.CylinderGeometry(0.06, 0.06, 0.028, 18), color: '#cfe8a0', roughness: 0.4 },
  { kind: 'chickpea', geometry: () => new THREE.SphereGeometry(0.045, 12, 10), color: '#e0bf86', roughness: 0.6 },
  { kind: 'feta', geometry: () => new THREE.BoxGeometry(0.075, 0.075, 0.075), color: '#f4f0e4', roughness: 0.7 },
  { kind: 'corn', geometry: () => new THREE.SphereGeometry(0.032, 10, 8), color: '#f3c74b', roughness: 0.35 },
]

function Salad({ fill, over, still }: { fill: number; over: boolean; still: boolean }) {
  const group = useRef<THREE.Group>(null)
  const rim = useRef<THREE.MeshStandardMaterial>(null)
  const meshes = useRef<Partial<Record<Kind, THREE.InstancedMesh>>>({})
  const pieces = useMemo(buildPieces, [])
  const byKind = useMemo(() => {
    const m: Record<Kind, Piece[]> = { leaf: [], tomato: [], cucumber: [], chickpea: [], feta: [], corn: [] }
    pieces.forEach((p) => m[p.kind].push(p))
    return m
  }, [pieces])
  const geometries = useMemo(() => Object.fromEntries(KINDS.map((k) => [k.kind, k.geometry()])) as Record<Kind, THREE.BufferGeometry>, [])
  const bowlGeometry = useMemo(() => new THREE.LatheGeometry(bowlProfile(), 96), [])
  const shadowTexture = useSoftShadow()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const level = useRef(FLOOR_Y - 0.1)
  const toss = useRef(0)
  const colored = useRef(false)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    // On budget fills the bowl to the rim; over budget piles a mound above it.
    // The bowl is round, so the level rises faster at first to look as full as the share eaten.
    const f = Math.max(0, fill)
    const target = f <= 1 ? FLOOR_Y - 0.02 + Math.pow(f, 0.6) * (FULL_Y - FLOOR_Y + 0.02) : FULL_Y + Math.min(1, (f - 1) / 0.3) * (MOUND_Y - FULL_Y)
    level.current = still ? target : THREE.MathUtils.damp(level.current, target, 2.5, dt)
    toss.current = Math.max(0, toss.current - dt * 1.6)

    for (const k of KINDS) {
      const mesh = meshes.current[k.kind]
      if (!mesh) continue
      byKind[k.kind].forEach((p, i) => {
        const visible = p.base.y <= level.current
        p.shown = still ? (visible ? 1 : 0) : THREE.MathUtils.clamp(p.shown + (visible ? dt * 2.2 : -dt * 4), 0, 1)
        const ease = 1 - Math.pow(1 - p.shown, 3)
        const jump = Math.sin(Math.min(1, 1 - toss.current) * Math.PI) * toss.current * 0.35 * p.hop
        dummy.position.set(p.base.x, p.base.y + (1 - ease) * 0.6 + jump, p.base.z)
        dummy.rotation.set(p.rot.x + jump * 3, p.rot.y, p.rot.z)
        dummy.scale.setScalar(p.shown > 0.001 ? p.size * Math.min(1, p.shown * 1.6) : 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        if (!colored.current && k.kind === 'leaf') mesh.setColorAt(i, p.color)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (!colored.current && k.kind === 'leaf' && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    colored.current = true

    if (rim.current) {
      const goal = over ? CORAL : LIME
      rim.current.color.lerp(goal, 1 - Math.exp(-4 * dt))
      rim.current.emissive.copy(rim.current.color).multiplyScalar(0.35)
    }
    if (group.current && !still) {
      group.current.rotation.y += dt * 0.22
      group.current.position.y = Math.sin(t * 1.1) * 0.03
    }
  })

  return (
    <group ref={group} onPointerDown={() => (toss.current = 1)}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.86} scale={2.2}>
        <planeGeometry />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={bowlGeometry}>
        <meshPhysicalMaterial color="#3a4531" roughness={0.38} clearcoat={0.8} clearcoatRoughness={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={RIM_Y + 0.022}>
        <torusGeometry args={[0.962, 0.022, 12, 96]} />
        <meshStandardMaterial ref={rim} color={LIME} roughness={0.3} />
      </mesh>
      {KINDS.map((k) => (
        <instancedMesh
          key={k.kind}
          ref={(m) => {
            if (m) meshes.current[k.kind] = m
          }}
          args={[geometries[k.kind], undefined, Math.max(1, byKind[k.kind].length)]}
        >
          <meshPhysicalMaterial color={k.color} roughness={k.roughness} clearcoat={k.clearcoat ?? 0} />
        </instancedMesh>
      ))}
    </group>
  )
}

/** A salad bowl that fills with food as the day's calories are eaten. Tap it to toss the salad. */
export default function Bowl({ fill, over }: { fill: number; over: boolean }) {
  const still = prefersStill()
  const [ref, onScreen] = useOnScreen<HTMLDivElement>()
  return (
    <div ref={ref} className="h-full w-full">
    <Canvas
      dpr={[1, 2]}
      frameloop={still || !onScreen ? 'demand' : 'always'}
      camera={{ position: [0, 2.4, 2.5], fov: 40 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      style={{ touchAction: 'pan-y' }}
      aria-hidden="true"
      onCreated={({ camera }) => camera.lookAt(0, -0.2, 0)}
    >
      <FitWidth aspect={0.95} />
      <StudioEnvironment />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <pointLight position={[-2, 1.2, -1.5]} intensity={5} color="#d4f57a" />
      <Salad fill={fill} over={over} still={still} />
    </Canvas>
    </div>
  )
}
