import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Plot } from '../lib/gadgets'
import { FitWidth, prefersStill, StudioEnvironment, useOnScreen, useSoftShadow } from './shared'

// A raised bed of 4 rows × 7 days, oldest day at the back left, today at the front right.
const COLS = 7
const ROWS = 4
const CELL = 0.44
const W = COLS * CELL + 0.1
const D = ROWS * CELL + 0.1
const GROUND = -0.21

type V3 = [number, number, number]

function useKit() {
  return useMemo(() => {
    const mat = (color: string, roughness = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, ...extra })
    return {
      g: {
        sphere: new THREE.SphereGeometry(1, 16, 12),
        cone: new THREE.ConeGeometry(1, 1, 12),
        cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
        capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
        box: new THREE.BoxGeometry(1, 1, 1),
        ring: new THREE.TorusGeometry(1, 0.05, 8, 40),
        star: new THREE.OctahedronGeometry(1, 0),
      },
      m: {
        wood: mat('#8b5e3c', 0.75),
        soil: mat('#3a2a1f', 1),
        mound: mat('#4a3523', 1),
        leaf: mat('#6fae45', 0.55),
        leafLight: mat('#a3cf5c', 0.5),
        leafDark: mat('#3f7a2c', 0.6),
        orange: mat('#ee8a2a', 0.45),
        red: mat('#e2483a', 0.3),
        beet: mat('#8a2c5a', 0.4),
        yellow: mat('#f2c94c', 0.45),
        stake: mat('#a07850', 0.8),
        wilt: mat('#8a6a3a', 0.8),
        glow: mat('#d4f57a', 0.4, { emissive: new THREE.Color('#d4f57a'), emissiveIntensity: 0.6 }),
        wingA: mat('#f7d774', 0.5, { side: THREE.DoubleSide }),
        wingB: mat('#f2a7c3', 0.5, { side: THREE.DoubleSide }),
        gold: mat('#f5c542', 0.22, { metalness: 0.9, emissive: new THREE.Color('#7a5200'), emissiveIntensity: 0.45 }),
        petals: ['#f2a7c3', '#f7f3e8', '#c9a2ef', '#ffb38a'].map((c) => mat(c, 0.5)),
        straw: mat('#e3c46b', 0.8),
        sack: mat('#e9d3a9', 0.85),
        shirt: mat('#c8553d', 0.7),
        hat: mat('#a8823f', 0.8),
        dark: mat('#1d1712', 0.6),
        sparkle: mat('#fff3b0', 0.2, { emissive: new THREE.Color('#ffd84a'), emissiveIntensity: 1.4 }),
      },
    }
  }, [])
}

type Kit = ReturnType<typeof useKit>

function P({ g, m, p, s, r }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; s: V3 | number; r?: V3 }) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} />
}

/** One of the six vegetables, about 0.3 tall, standing on the soil at y = 0. */
function Vegetable({ kind, k }: { kind: number; k: Kit }) {
  const { g, m } = k
  switch (kind) {
    case 0: // carrot
      return (
        <>
          <P g={g.cone} m={m.orange} p={[0, 0.03, 0]} s={[0.06, 0.12, 0.06]} r={[Math.PI, 0, 0]} />
          {[-0.4, 0, 0.4].map((a) => <P key={a} g={g.cone} m={m.leaf} p={[a * 0.08, 0.18, 0]} s={[0.02, 0.22, 0.02]} r={[0, 0, -a]} />)}
        </>
      )
    case 1: // cabbage
      return (
        <>
          <P g={g.sphere} m={m.leafLight} p={[0, 0.1, 0]} s={[0.12, 0.1, 0.12]} />
          {[0, 1.6, 3.2, 4.8].map((a) => (
            <P key={a} g={g.sphere} m={m.leaf} p={[Math.cos(a) * 0.1, 0.05, Math.sin(a) * 0.1]} s={[0.11, 0.025, 0.075]} r={[0, -a, 0.45]} />
          ))}
        </>
      )
    case 2: // tomato plant
      return (
        <>
          <P g={g.cylinder} m={m.stake} p={[0.06, 0.17, -0.02]} s={[0.012, 0.34, 0.012]} />
          <P g={g.sphere} m={m.leaf} p={[0, 0.15, 0]} s={[0.09, 0.12, 0.09]} />
          {([[0.07, 0.11, 0.05], [-0.06, 0.17, 0.05], [0.02, 0.23, -0.06]] as V3[]).map((p) => <P key={p[1]} g={g.sphere} m={m.red} p={p} s={0.042} />)}
        </>
      )
    case 3: // pumpkin
      return (
        <>
          <P g={g.sphere} m={m.orange} p={[0, 0.08, 0]} s={[0.14, 0.09, 0.14]} />
          <P g={g.cylinder} m={m.leafDark} p={[0, 0.18, 0]} s={[0.015, 0.05, 0.015]} />
          <P g={g.sphere} m={m.leaf} p={[0.1, 0.04, -0.09]} s={[0.1, 0.02, 0.08]} r={[0, 0.6, 0.2]} />
        </>
      )
    case 4: // beetroot
      return (
        <>
          <P g={g.sphere} m={m.beet} p={[0, 0.04, 0]} s={0.07} />
          {[-0.35, 0, 0.35].map((a) => <P key={a} g={g.sphere} m={m.leafDark} p={[a * 0.09, 0.16, 0]} s={[0.035, 0.11, 0.015]} r={[0, 0, -a]} />)}
        </>
      )
    default: // corn
      return (
        <>
          <P g={g.cylinder} m={m.leaf} p={[0, 0.18, 0]} s={[0.02, 0.36, 0.02]} />
          <P g={g.capsule} m={m.yellow} p={[0.045, 0.22, 0]} s={[0.035, 0.06, 0.035]} r={[0, 0, -0.3]} />
          <P g={g.cone} m={m.leaf} p={[-0.06, 0.14, 0]} s={[0.016, 0.26, 0.016]} r={[0, 0, 0.6]} />
          <P g={g.cone} m={m.leafLight} p={[0.06, 0.1, 0.02]} s={[0.016, 0.22, 0.016]} r={[0, 0, -0.7]} />
        </>
      )
  }
}

function Sprout({ k, wilted }: { k: Kit; wilted?: boolean }) {
  const leaf = wilted ? k.m.wilt : k.m.leafLight
  const droop = wilted ? -1 : 1
  return (
    <>
      <P g={k.g.cylinder} m={wilted ? k.m.wilt : k.m.leaf} p={[0, 0.035, 0]} s={[0.008, 0.07, 0.008]} />
      <P g={k.g.sphere} m={leaf} p={[-0.035, 0.07, 0]} s={[0.05, 0.012, 0.03]} r={[0, 0, -0.5 * droop]} />
      <P g={k.g.sphere} m={leaf} p={[0.035, 0.07, 0]} s={[0.05, 0.012, 0.03]} r={[0, 0, 0.5 * droop]} />
    </>
  )
}

/** Plant size a plot grows to: today grows with the share of the budget eaten. */
function plotScale(p: Plot) {
  if (p.state === 'empty') return 0
  if (p.state === 'growing') return 0.7 + p.progress * 0.9
  return 1
}

function Butterfly({ k, index }: { k: Kit; index: number }) {
  const body = useRef<THREE.Group>(null)
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime + index * 2.1
    if (!body.current || !left.current || !right.current) return
    body.current.position.set(Math.sin(t * 0.5) * 1.2, 0.6 + Math.sin(t * 1.7) * 0.1, Math.cos(t * 0.37) * 0.55)
    body.current.rotation.y = Math.atan2(Math.cos(t * 0.5) * 0.5, -Math.sin(t * 0.37) * 0.2)
    const flap = Math.sin(t * 18) * 0.9
    left.current.rotation.z = flap
    right.current.rotation.z = -flap
  })
  const wing = index % 2 ? k.m.wingB : k.m.wingA
  return (
    <group ref={body}>
      <P g={k.g.capsule} m={k.m.stake} s={[0.008, 0.03, 0.008]} r={[Math.PI / 2, 0, 0]} />
      <group ref={left}>
        <P g={k.g.sphere} m={wing} p={[-0.04, 0, 0]} s={[0.045, 0.004, 0.035]} />
      </group>
      <group ref={right}>
        <P g={k.g.sphere} m={wing} p={[0.04, 0, 0]} s={[0.045, 0.004, 0.035]} />
      </group>
    </group>
  )
}

function Flower({ k, petal, height }: { k: Kit; petal: THREE.Material; height: number }) {
  return (
    <>
      <P g={k.g.cylinder} m={k.m.leaf} p={[0, height / 2, 0]} s={[0.008, height, 0.008]} />
      <P g={k.g.sphere} m={k.m.leaf} p={[0.025, height * 0.4, 0]} s={[0.03, 0.007, 0.015]} r={[0, 0, 0.5]} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return <P key={i} g={k.g.sphere} m={petal} p={[Math.cos(a) * 0.03, height, Math.sin(a) * 0.03]} s={[0.028, 0.008, 0.019]} r={[0, -a, 0.15]} />
      })}
      <P g={k.g.sphere} m={k.m.yellow} p={[0, height + 0.006, 0]} s={0.017} />
    </>
  )
}

/** A two-row strip of flowers along the front of the bed, the reward for a week-long streak. */
function FlowerBorder({ k }: { k: Kit }) {
  return (
    <group position={[0, GROUND, 0]}>
      {Array.from({ length: 14 }, (_, i) => (
        <group key={i} position={[-W / 2 + ((i + 0.5) * W) / 14, 0, D / 2 + 0.17 + (i % 2) * 0.1]}>
          <Flower k={k} petal={k.m.petals[i % k.m.petals.length]} height={0.17 + (i % 3) * 0.03} />
        </group>
      ))}
    </group>
  )
}

/** A little scarecrow behind the bed, the reward for a 30-day streak. */
function Scarecrow({ k }: { k: Kit }) {
  return (
    <>
      <P g={k.g.cylinder} m={k.m.stake} p={[0, 0.36, 0]} s={[0.02, 0.72, 0.02]} />
      <P g={k.g.cylinder} m={k.m.stake} p={[0, 0.5, 0]} s={[0.014, 0.46, 0.014]} r={[0, 0, Math.PI / 2]} />
      <P g={k.g.box} m={k.m.shirt} p={[0, 0.45, 0]} s={[0.17, 0.2, 0.09]} />
      <P g={k.g.box} m={k.m.shirt} p={[0, 0.5, 0]} s={[0.34, 0.055, 0.065]} />
      {[-1, 1].map((side) => <P key={side} g={k.g.cone} m={k.m.straw} p={[side * 0.21, 0.5, 0]} s={[0.03, 0.07, 0.03]} r={[0, 0, -side * Math.PI / 2]} />)}
      <P g={k.g.cone} m={k.m.straw} p={[0, 0.33, 0]} s={[0.07, 0.07, 0.05]} r={[Math.PI, 0, 0]} />
      <P g={k.g.sphere} m={k.m.sack} p={[0, 0.63, 0]} s={0.075} />
      {[-1, 1].map((side) => <P key={side} g={k.g.sphere} m={k.m.dark} p={[side * 0.025, 0.645, 0.066]} s={0.01} />)}
      <P g={k.g.cylinder} m={k.m.hat} p={[0, 0.69, 0]} s={[0.12, 0.014, 0.12]} />
      <P g={k.g.cone} m={k.m.hat} p={[0, 0.74, 0]} s={[0.065, 0.1, 0.065]} />
    </>
  )
}

function Bed({ plots, streak, still }: { plots: Plot[]; streak: number; still: boolean }) {
  const k = useKit()
  const shadow = useSoftShadow()
  const garden = useRef<THREE.Group>(null)
  const plants = useRef<(THREE.Group | null)[]>([])
  const sizes = useRef<number[]>([])
  const bounce = useRef(0)
  const sparkle = useRef<THREE.Mesh>(null)
  const scarecrow = useRef<THREE.Group>(null)
  const butterflies = streak >= 14 ? 3 : streak >= 7 ? 2 : streak >= 3 ? 1 : 0
  // From 14 days in a row the newest vegetable is made of gold.
  const golden = streak >= 14 ? plots.findLastIndex((p) => p.state === 'veg') : -1
  const goldKit = useMemo<Kit>(() => ({
    g: k.g,
    m: Object.fromEntries(Object.entries(k.m).map(([name, m]) => [name, Array.isArray(m) ? m.map(() => k.m.gold) : k.m.gold])) as Kit['m'],
  }), [k])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    bounce.current = Math.max(0, bounce.current - dt * 1.8)
    if (sparkle.current) {
      sparkle.current.rotation.y = still ? 0.6 : t * 2
      sparkle.current.position.y = 0.42 + (still ? 0 : Math.sin(t * 2.2) * 0.03)
      sparkle.current.scale.setScalar(0.05 * (still ? 1 : 1 + Math.sin(t * 4) * 0.25))
    }
    if (scarecrow.current) scarecrow.current.rotation.z = still ? 0 : Math.sin(t * 0.8) * 0.03
    plots.forEach((p, i) => {
      const plant = plants.current[i]
      if (!plant) return
      // Plants pop up one after another the first time the garden appears.
      const target = still || t > 0.2 + i * 0.04 ? plotScale(p) : 0
      const size = still ? target : THREE.MathUtils.damp(sizes.current[i] ?? 0, target, 7, dt)
      sizes.current[i] = size
      const hop = Math.sin(bounce.current * Math.PI * 3 + i * 0.4) * bounce.current * 0.25
      plant.scale.setScalar(Math.max(0.0001, size * (1 + hop)))
      plant.rotation.z = still ? 0 : Math.sin(t * 1.4 + i) * 0.04
    })
    if (garden.current && !still) garden.current.rotation.y = Math.sin(t * 0.25) * 0.12
  })

  return (
    <group ref={garden} onPointerDown={() => (bounce.current = 1)}>
      <mesh rotation-x={-Math.PI / 2} position-y={GROUND} scale={[W + 1.2, D + 1.2, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <P g={k.g.box} m={k.m.soil} p={[0, -0.1, 0]} s={[W, 0.2, D]} />
      <P g={k.g.box} m={k.m.wood} p={[0, -0.07, D / 2 + 0.04]} s={[W + 0.16, 0.26, 0.08]} />
      <P g={k.g.box} m={k.m.wood} p={[0, -0.07, -D / 2 - 0.04]} s={[W + 0.16, 0.26, 0.08]} />
      <P g={k.g.box} m={k.m.wood} p={[W / 2 + 0.04, -0.07, 0]} s={[0.08, 0.26, D]} />
      <P g={k.g.box} m={k.m.wood} p={[-W / 2 - 0.04, -0.07, 0]} s={[0.08, 0.26, D]} />
      {plots.map((p, i) => {
        const x = ((i % COLS) - (COLS - 1) / 2) * CELL
        const z = (Math.floor(i / COLS) - (ROWS - 1) / 2) * CELL
        return (
          <group key={p.date} position={[x, 0, z]}>
            {p.state !== 'empty' && <P g={k.g.sphere} m={k.m.mound} s={[0.16, 0.03, 0.16]} />}
            {p.state === 'growing' && <P g={k.g.ring} m={k.m.glow} p={[0, 0.01, 0]} s={0.18} r={[Math.PI / 2, 0, 0]} />}
            {i === golden && <mesh ref={sparkle} geometry={k.g.star} material={k.m.sparkle} />}
            <group ref={(el) => { plants.current[i] = el }} scale={0.0001}>
              {p.state === 'veg' && <Vegetable kind={p.kind} k={i === golden ? goldKit : k} />}
              {(p.state === 'sprout' || p.state === 'growing') && <Sprout k={k} />}
              {p.state === 'wilt' && <Sprout k={k} wilted />}
            </group>
          </group>
        )
      })}
      {streak >= 7 && <FlowerBorder k={k} />}
      {streak >= 30 && (
        <group ref={scarecrow} position={[W / 2 - 0.35, GROUND, -D / 2 - 0.2]}>
          <Scarecrow k={k} />
        </group>
      )}
      {!still && Array.from({ length: butterflies }, (_, i) => <Butterfly key={i} k={k} index={i} />)}
    </group>
  )
}

/** A little raised bed: every full day within budget grows a vegetable. Tap it to shake the plants. */
export default function Garden({ plots, streak }: { plots: Plot[]; streak: number }) {
  const still = prefersStill()
  const [ref, onScreen] = useOnScreen<HTMLDivElement>()
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas
        dpr={[1, 2]}
        frameloop={still || !onScreen ? 'demand' : 'always'}
        camera={{ position: [0, 2.2, 2.75], fov: 36 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        style={{ touchAction: 'pan-y' }}
        aria-hidden="true"
        onCreated={({ camera }) => camera.lookAt(0, 0, 0.05)}
      >
        <FitWidth aspect={2.2} />
        <StudioEnvironment />
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 4, 3]} intensity={1.8} color="#fff4dc" />
        <pointLight position={[-2.5, 1.5, -1]} intensity={4} color="#d4f57a" />
        <Bed plots={plots} streak={streak} still={still} />
      </Canvas>
    </div>
  )
}
