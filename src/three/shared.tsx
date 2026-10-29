import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/** Soft studio reflections built in code, so nothing is downloaded and it works offline. */
export function StudioEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = target.texture
    return () => {
      scene.environment = null
      target.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

/** A critically-under-damped spring for pop-in scale animations; call step(delta) each frame. */
export function useSpring(target: number, from: number, stiffness = 120, damping = 11) {
  return useMemo(() => {
    let x = from
    let v = 0
    return {
      step(delta: number) {
        const dt = Math.min(delta, 0.05)
        v += (stiffness * (target - x) - damping * v) * dt
        x += v * dt
        return x
      },
    }
  }, [target, from, stiffness, damping])
}

export const prefersStill = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Pulls the camera back on canvases narrower than `aspect`, so the scene always fits across. */
export function FitWidth({ aspect }: { aspect: number }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    camera.zoom = Math.min(1, size.width / size.height / aspect)
    camera.updateProjectionMatrix()
  }, [camera, size, aspect])
  return null
}

/** A soft round shadow to lay under an object, drawn in code. */
export function useSoftShadow() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
    grad.addColorStop(0, 'rgba(0,0,0,0.55)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** Whether the element is on screen, so scenes scrolled out of view stop drawing frames. */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, visible] as const
}
