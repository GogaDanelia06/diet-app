import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { Plot } from '../lib/gadgets'

// The 3D scenes live in their own chunk so the app opens fast; each falls back to a flat look.
const Bowl = lazy(() => import('../three/Bowl'))
const Plate = lazy(() => import('../three/Plate'))
const Medal = lazy(() => import('../three/Medal'))
const Garden = lazy(() => import('../three/Garden'))

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

/** Flat salad bowl used while the 3D one loads or when WebGL is unavailable. */
function FlatBowl({ fill, over }: { fill: number; over: boolean }) {
  const color = over ? '#ff957b' : '#d4f57a'
  const level = 86 - Math.min(1, Math.max(0, fill)) * 48
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 120 100" className="w-[80%]" aria-hidden="true">
        <clipPath id="flat-bowl-inside">
          <path d="M14 38 A46 46 0 0 0 106 38 Z" />
        </clipPath>
        <rect x="0" y={level} width="120" height="100" fill="#8cc152" clipPath="url(#flat-bowl-inside)" />
        <path d="M12 38 A48 48 0 0 0 108 38" fill="none" stroke="#efebe1" strokeWidth="4" />
        <path d="M48 90 h24" stroke="#efebe1" strokeWidth="4" strokeLinecap="round" />
        <path d="M9 38 h102" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function BowlView({ fill, over }: { fill: number; over: boolean }) {
  const flat = <FlatBowl fill={fill} over={over} />
  return (
    <Safe fallback={flat}>
      <Bowl fill={fill} over={over} />
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

const VEG = ['🥕', '🥬', '🍅', '🎃', '🍆', '🌽']
const PLOT_ART: Record<Plot['state'], (p: Plot) => string> = { veg: (p) => VEG[p.kind], sprout: () => '🌱', growing: () => '🌱', wilt: () => '🍂', empty: () => '·' }

function FlatGarden({ plots }: { plots: Plot[] }) {
  return (
    <div className="flat-garden" aria-hidden="true">
      {plots.map((p) => <span key={p.date} className={p.state === 'empty' ? 'opacity-30' : ''}>{PLOT_ART[p.state](p)}</span>)}
    </div>
  )
}

export function GardenView({ plots, streak }: { plots: Plot[]; streak: number }) {
  return (
    <Safe fallback={<FlatGarden plots={plots} />}>
      <Garden plots={plots} streak={streak} />
    </Safe>
  )
}
