import { useEffect, useMemo } from 'react'
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
