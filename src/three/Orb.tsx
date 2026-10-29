import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const R = 0.9 // liquid radius; the glass shell is 1
const BUBBLES = 18

// Same wave in the liquid and its surface so they meet exactly.
const WAVE = /* glsl */ `
  float wave(vec2 p, float t, float amp) {
    return (sin(p.x * 6.0 + t * 2.1) + sin(p.y * 5.0 - t * 1.7)) * 0.018 * amp;
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
    float depth = clamp((uFill - vPos.y) * 0.7, 0.0, 1.0);
    vec3 col = mix(uColor * 1.0, uColor * 0.22, depth);
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
    col += uColor * fres * 0.55;
    if (!gl_FrontFacing) col *= 0.55;
    gl_FragColor = vec4(col, 0.9);
    #include <colorspace_fragment>
  }
`

const surfaceVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uRadius;
  varying float vEdge;
  ${WAVE}
  void main() {
    vec3 p = position;
    // The disc is built at radius 1 and scaled to the liquid's width at this height.
    vec2 world = p.xz * uRadius;
    p.y += wave(world, uTime, uAmp);
    vEdge = length(p.xz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const surfaceFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vEdge;
  void main() {
    vec3 col = mix(uColor * 1.25, uColor * 0.8, smoothstep(0.0, 1.0, vEdge));
    gl_FragColor = vec4(col, 0.96);
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

// Glass: bright rim, a sharp highlight and an otherwise clear body (drawn additively).
const shellFragment = /* glsl */ `
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float ndv = max(dot(n, vView), 0.0);
    float rim = pow(1.0 - ndv, 3.0);
    vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
    float spec = pow(max(dot(reflect(-L, n), vView), 0.0), 60.0);
    vec3 col = uRim * rim * 0.95 + vec3(1.0) * spec * 0.85;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const MINT = new THREE.Color('#45f0a0')
const AMBER = new THREE.Color('#ffc547')
const RED = new THREE.Color('#ff5a4a')

function targetColor(fill: number, over: boolean) {
  if (over) return RED
  if (fill > 0.9) return MINT.clone().lerp(AMBER, (fill - 0.9) / 0.1)
  return MINT
}

function Scene({ fill, over, still }: { fill: number; over: boolean; still: boolean }) {
  const group = useRef<THREE.Group>(null)
  const surface = useRef<THREE.Mesh>(null)
  const liquidMat = useRef<THREE.ShaderMaterial>(null)
  const surfaceMat = useRef<THREE.ShaderMaterial>(null)
  const shellMat = useRef<THREE.ShaderMaterial>(null)
  const bubbles = useRef<THREE.InstancedMesh>(null)
  const level = useRef(-R)
  const slosh = useRef(1)

  // Initial values only; the frame loop writes through the material refs.
  const liquid = useMemo(() => ({ uFill: { value: -R }, uTime: { value: 0 }, uAmp: { value: 1 }, uColor: { value: MINT.clone() } }), [])
  const surf = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: 1 }, uRadius: { value: 0 }, uColor: { value: MINT.clone() } }), [])
  const shell = useMemo(() => ({ uRim: { value: MINT.clone() } }), [])
  const color = useMemo(() => MINT.clone(), [])
  const surfaceGeometry = useMemo(() => new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), [])
  const seeds = useMemo(() => Array.from({ length: BUBBLES }, () => [Math.random(), Math.random() * Math.PI * 2, 0.2 + Math.random() * 0.5, 0.012 + Math.random() * 0.02]), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((state, delta) => {
    const lu = liquidMat.current?.uniforms
    const su = surfaceMat.current?.uniforms
    const hu = shellMat.current?.uniforms
    if (!lu || !su || !hu) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    // Ease the level toward the target so logging food visibly fills the orb.
    const target = -R + 2 * R * Math.min(1, Math.max(0, fill)) - (fill <= 0 ? 0.05 : 0)
    level.current = THREE.MathUtils.damp(level.current, target, 2.2, dt)
    slosh.current = THREE.MathUtils.damp(slosh.current, 1, 1.5, dt)
    color.lerp(targetColor(fill, over), 1 - Math.exp(-3 * dt))
    const y = level.current
    const radius = Math.sqrt(Math.max(0, R * R - y * y))
    lu.uTime.value = su.uTime.value = t
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
      seeds.forEach(([offset, angle, dist, size], i) => {
        const span = Math.max(0, y + R - 0.08)
        const by = -R + 0.06 + ((t * 0.12 + offset) % 1) * span
        const r = Math.sqrt(Math.max(0, R * R - by * by)) * dist
        dummy.position.set(Math.cos(angle + t * 0.3) * r, by, Math.sin(angle + t * 0.3) * r)
        dummy.scale.setScalar(span > 0.1 ? size : 0)
        dummy.updateMatrix()
        bubbles.current!.setMatrixAt(i, dummy.matrix)
      })
      bubbles.current.instanceMatrix.needsUpdate = true
    }

    if (group.current && !still) {
      group.current.rotation.y += dt * 0.25
      group.current.position.y = Math.sin(t * 1.2) * 0.04
    }
  })

  return (
    <group ref={group} onPointerDown={() => (slosh.current = 4)}>
      <mesh renderOrder={1}>
        <sphereGeometry args={[R, 64, 48]} />
        <shaderMaterial ref={liquidMat} vertexShader={liquidVertex} fragmentShader={liquidFragment} uniforms={liquid} side={THREE.DoubleSide} transparent depthWrite={false} />
      </mesh>
      <mesh ref={surface} geometry={surfaceGeometry} renderOrder={2}>
        <shaderMaterial ref={surfaceMat} vertexShader={surfaceVertex} fragmentShader={surfaceFragment} uniforms={surf} side={THREE.DoubleSide} transparent />
      </mesh>
      <instancedMesh ref={bubbles} args={[undefined, undefined, BUBBLES]} renderOrder={3}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>
      <mesh renderOrder={4}>
        <sphereGeometry args={[1, 64, 48]} />
        <shaderMaterial
          ref={shellMat}
          vertexShader={shellVertex}
          fragmentShader={shellFragment}
          uniforms={shell}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

/** Glass orb whose liquid level shows how much of today's budget is eaten. Tap to slosh. */
export default function Orb({ fill, over }: { fill: number; over: boolean }) {
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <Canvas
      dpr={[1, 2]}
      flat
      frameloop={still ? 'demand' : 'always'}
      camera={{ position: [0, 0.35, 3.1], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      style={{ touchAction: 'pan-y' }}
      aria-hidden="true"
    >
      <Scene fill={fill} over={over} still={still} />
    </Canvas>
  )
}
