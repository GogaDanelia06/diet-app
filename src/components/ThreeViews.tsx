import { Component, lazy, Suspense, type ReactNode } from 'react'

// The 3D scenes live in their own chunk so the app opens fast; each falls back to a flat look.
const Orb = lazy(() => import('../three/Orb'))
const Plate = lazy(() => import('../three/Plate'))
const Medal = lazy(() => import('../three/Medal'))

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Safe({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </Fallback>
  )
}

function FlatOrb({ fill, over }: { fill: number; over: boolean }) {
  const color = over ? '#ff5a4a' : '#d4f57a'
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="relative aspect-square w-[78%] overflow-hidden rounded-full border border-white/15"
        style={{ boxShadow: `inset 0 0 40px ${color}55, 0 0 50px -10px ${color}` }}
      >
        <div className="absolute inset-x-0 bottom-0" style={{ height: `${Math.min(100, fill * 100)}%`, background: `linear-gradient(${color}cc, ${color}44)` }} />
      </div>
    </div>
  )
}

export function OrbView({ fill, over }: { fill: number; over: boolean }) {
  const flat = <FlatOrb fill={fill} over={over} />
  return (
    <Safe fallback={flat}>
      <Orb fill={fill} over={over} />
    </Safe>
  )
}

export function PlateView({ mini = false }: { mini?: boolean }) {
  return (
    <Safe fallback={<span className="text-2xl">🍽️</span>}>
      <Plate mini={mini} />
    </Safe>
  )
}

export function MedalView() {
  return (
    <Safe fallback={<span className="text-6xl">🏅</span>}>
      <Medal />
    </Safe>
  )
}
