import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const R = 0.88
const BUBBLES = 14
const LIME = new THREE.Color('#d4f57a')
const CORAL = new THREE.Color('#ff957b')

// Both meshes share the same wave so the liquid meets its surface cleanly.
const WAVE = /* glsl */ `
  float wave(vec2 p, float t, float amp) {
    return (sin(p.x * 5.0 + t * 1.5) + sin(p.y * 4.0 - t * 1.2)) * 0.014 * amp;
  }
`

const liquidVertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const liquidFragment = /* glsl */ `
  uniform float uFill;
  uniform float uTime;
  uniform float uAmp;
  uniform vec3 uColor;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  ${WAVE}
  void main() {
    if (vPos.y > uFill + wave(vPos.xz, uTime, uAmp)) discard;
    float depth = clamp((uFill - vPos.y) * 0.65, 0.0, 1.0);
    vec3 col = mix(uColor * 0.88, uColor * 0.13, depth);
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
    col += uColor * fres * 0.55;
    float rim = 1.0 - smoothstep(0.0, 0.055, uFill - vPos.y);
    col += uColor * rim * 0.2;
    if (!gl_FrontFacing) col *= 0.5;
    gl_FragColor = vec4(col, 0.94);
    #include <colorspace_fragment>
  }
`

const surfaceVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uRadius;
  varying vec2 vDisc;
  ${WAVE}
  void main() {
    vec3 p = position;
    p.y += wave(p.xz * uRadius, uTime, uAmp);
    vDisc = p.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const surfaceFragment = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vDisc;
  void main() {
    float highlight = exp(-length(vDisc - vec2(-0.3, -0.4)) * 2.2);
    vec3 col = uColor * (0.65 + highlight * 0.55);
    col += vec3(0.25) * smoothstep(0.92, 1.0, length(vDisc));
    gl_FragColor = vec4(col, 0.97);
    #include <colorspace_fragment>
  }
`

const shellVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

// Procedural studio reflections give the glass depth without downloading an HDRI.
const shellFragment = /* glsl */ `
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(vView);
    float rim = pow(1.0 - max(dot(n, view), 0.0), 3.4);
    vec3 reflection = reflect(-view, n);
    float strip = pow(max(dot(reflection, normalize(vec3(-0.7, 0.5, 0.8))), 0.0), 28.0);
    float small = pow(max(dot(reflection, normalize(vec3(0.7, -0.3, 0.9))), 0.0), 50.0);
    float soft = pow(max(dot(n, normalize(vec3(-0.6, 0.8, 0.4))), 0.0), 5.0);
    vec3 col = uRim * rim * 0.48 + vec3(0.84, 0.92, 0.8) * strip * 0.7;
    col += vec3(0.6, 0.72, 0.78) * small * 0.25 + vec3(0.03) * soft;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

function Scene({ fill, over, still }: { fill: number; over: boolean; still: boolean }) {
  const group = useRef<THREE.Group>(null)
  const orbit = useRef<THREE.Group>(null)
  const outerOrbit = useRef<THREE.Group>(null)
  const surface = useRef<THREE.Mesh>(null)
  const liquidMat = useRef<THREE.ShaderMaterial>(null)
  const surfaceMat = useRef<THREE.ShaderMaterial>(null)
  const shellMat = useRef<THREE.ShaderMaterial>(null)
  const bubbles = useRef<THREE.InstancedMesh>(null)
  const level = useRef(-R - 0.05)
  const slosh = useRef(1)
  const invalidate = useThree((state) => state.invalidate)
  const liquid = useMemo(() => ({ uFill: { value: -R }, uTime: { value: 0 }, uAmp: { value: 1 }, uColor: { value: LIME.clone() } }), [])
  const surf = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: 1 }, uRadius: { value: 0 }, uColor: { value: LIME.clone() } }), [])
  const shell = useMemo(() => ({ uRim: { value: LIME.clone() } }), [])
  const color = useMemo(() => LIME.clone(), [])
  const surfaceGeometry = useMemo(() => new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), [])
  // Deterministic positions avoid particles jumping around when the scene remounts.
  const seeds = useMemo(() => Array.from({ length: BUBBLES }, (_, i) => [
    (i * 0.618) % 1, i * 2.399, 0.25 + (i % 4) * 0.13, 0.011 + (i % 3) * 0.005,
  ]), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => () => surfaceGeometry.dispose(), [surfaceGeometry])
  // Demand-mode canvases must repaint when a meal or motion preference changes.
  useEffect(() => { invalidate() }, [fill, over, still, invalidate])

  useFrame((state, delta) => {
    const lu = liquidMat.current?.uniforms
    const su = surfaceMat.current?.uniforms
    const hu = shellMat.current?.uniforms
    if (!lu || !su || !hu) return
    const dt = Math.min(delta, 0.05)
    const time = still ? 0 : state.clock.elapsedTime
    const target = -R + 2 * R * Math.min(1, Math.max(0, fill)) - (fill <= 0 ? 0.05 : 0)
    level.current = still ? target : THREE.MathUtils.damp(level.current, target, 2.5, dt)
    slosh.current = still ? 0 : THREE.MathUtils.damp(slosh.current, 1, 1.6, dt)
    if (still) color.copy(over ? CORAL : LIME)
    else color.lerp(over ? CORAL : LIME, 1 - Math.exp(-3 * dt))
    const y = level.current
    const radius = Math.sqrt(Math.max(0, R * R - y * y))
    lu.uTime.value = su.uTime.value = time
    lu.uAmp.value = su.uAmp.value = slosh.current
    lu.uFill.value = y
    su.uRadius.value = radius
    lu.uColor.value.copy(color)
    su.uColor.value.copy(color)
    hu.uRim.value.copy(color)
    if (surface.current) {
      surface.current.position.y = y
      surface.current.scale.set(radius, 1, radius)
      surface.current.visible = radius > 0.02 && y > -R + 0.01
    }

    if (bubbles.current) {
      seeds.forEach(([offset, angle, distance, size], i) => {
        const span = Math.max(0, y + R - 0.08)
        const by = -R + 0.06 + ((time * 0.07 + offset) % 1) * span
        const r = Math.sqrt(Math.max(0, R * R - by * by)) * distance
        dummy.position.set(Math.cos(angle + time * 0.12) * r, by, Math.sin(angle + time * 0.12) * r)
        dummy.scale.setScalar(span > 0.1 ? size : 0)
        dummy.updateMatrix()
        bubbles.current!.setMatrixAt(i, dummy.matrix)
      })
      bubbles.current.instanceMatrix.needsUpdate = true
    }
    if (group.current) {
      group.current.position.y = still ? 0 : Math.sin(time * 0.85) * 0.035
      group.current.rotation.y = still ? 0 : Math.sin(time * 0.16) * 0.13
    }
    if (orbit.current) orbit.current.rotation.z = time * 0.085
    if (outerOrbit.current) outerOrbit.current.rotation.z = -time * 0.055 + 0.7
  })

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[-3, 5, 4]} intensity={3.2} color="#f1ffdb" />
      <directionalLight position={[3, -2, 2]} intensity={1.5} color="#adc6cb" />
      <group ref={group}>
        <group rotation={[1.03, -0.28, -0.35]}>
          <group ref={orbit}>
            <mesh>
              <torusGeometry args={[1.23, 0.016, 8, 112]} />
              <meshStandardMaterial color="#d4f57a" metalness={0.65} roughness={0.3} />
            </mesh>
            <mesh position={[1.23, 0, 0]}>
              <sphereGeometry args={[0.068, 20, 14]} />
              <meshStandardMaterial color="#e5ffa6" metalness={0.5} roughness={0.23} />
            </mesh>
            <mesh position={[-0.87, 0.87, 0]}>
              <sphereGeometry args={[0.027, 12, 8]} />
              <meshBasicMaterial color="#ecffc2" />
            </mesh>
          </group>
        </group>
        <group rotation={[-0.72, 0.64, 0.4]}>
          <group ref={outerOrbit}>
            <mesh>
              <torusGeometry args={[1.39, 0.004, 6, 112]} />
              <meshBasicMaterial color="#bac8a7" transparent opacity={0.3} />
            </mesh>
            <mesh position={[1.39, 0, 0]}>
              <sphereGeometry args={[0.035, 12, 8]} />
              <meshStandardMaterial color="#c4cdb5" metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
        </group>
        <mesh renderOrder={1}>
          <sphereGeometry args={[R, 48, 32]} />
          <shaderMaterial ref={liquidMat} vertexShader={liquidVertex} fragmentShader={liquidFragment} uniforms={liquid} side={THREE.DoubleSide} transparent depthWrite={false} />
        </mesh>
        <mesh ref={surface} geometry={surfaceGeometry} renderOrder={2}>
          <shaderMaterial ref={surfaceMat} vertexShader={surfaceVertex} fragmentShader={surfaceFragment} uniforms={surf} side={THREE.DoubleSide} transparent />
        </mesh>
        <instancedMesh ref={bubbles} args={[undefined, undefined, BUBBLES]} renderOrder={3}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#f3ffdd" transparent opacity={0.4} depthWrite={false} />
        </instancedMesh>
        <mesh renderOrder={4} onPointerDown={() => { if (!still) slosh.current = 4 }}>
          <sphereGeometry args={[0.98, 48, 32]} />
          <shaderMaterial ref={shellMat} vertexShader={shellVertex} fragmentShader={shellFragment} uniforms={shell} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </>
  )
}

/** Liquid calorie globe with orbiting satellites. Decorative, with tap-to-slosh motion. */
export default function Orb({ fill, over }: { fill: number; over: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const [still, setStill] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setStill(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let onScreen = true
    const update = () => setVisible(onScreen && document.visibilityState !== 'hidden')
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      update()
    }, { rootMargin: '80px' })
    if (container.current) observer?.observe(container.current)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return (
    <div ref={container} style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        flat
        frameloop={still || !visible ? 'demand' : 'always'}
        camera={{ position: [0, 0.48, 4.2], fov: 43 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        style={{ touchAction: 'pan-y' }}
      >
        <Scene fill={fill} over={over} still={still} />
      </Canvas>
    </div>
  )
}
