import * as THREE from 'three'
import { Billboard, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { CUP, DESK, LAMP } from './layout'
import { useMaterials } from './materials'
import { night } from './night'

// ---- Banker's lamp ----------------------------------------------------------------------------------------

/** Where the lamp's light comes from, in world space (used by the lighting rig). */
export const LAMP_HEAD = new THREE.Vector3(LAMP.x + 0.045, DESK.top + 0.245, LAMP.z + 0.09)

export function DeskLamp() {
  const m = useMaterials()
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#0d4a30', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#1f8a55', emissiveIntensity: 0,
  }), [])
  const inner = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4e7c9', emissive: '#ffcf8a', emissiveIntensity: 0, side: THREE.BackSide }), [])
  const bulb = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff4dd', emissive: '#ffd59a', emissiveIntensity: 0 }), [])
  useFrame(() => {
    inner.emissiveIntensity = 0.15 + 0.9 * night.current
    glass.emissiveIntensity = 0.07 * night.current // light leaking through the green glass
    bulb.emissiveIntensity = 0.3 + 9 * night.current
  })
  const stemH = 0.3
  return (
    <group position={[LAMP.x, DESK.top, LAMP.z]} rotation-y={0.5}>
      <mesh material={m.brass} scale={[1, 1, 0.7]} position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.085, 0.024, 48]} />
      </mesh>
      <mesh material={m.brass} position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.03, 0.016, 32]} />
      </mesh>
      <mesh material={m.brass} position={[0, stemH / 2 + 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, stemH, 20]} />
      </mesh>
      {/* yoke */}
      <mesh material={m.brass} position={[0, stemH + 0.03, 0.04]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.08, 16]} />
      </mesh>
      <group position={[0, stemH + 0.03, 0.08]} rotation-x={-0.25}>
        {/* half-cylinder green glass shade, axis along X, opening downward */}
        <mesh material={glass} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.32, 48, 1, true, -Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh material={inner} rotation={[0, 0, Math.PI / 2]} scale={0.97}>
          <cylinderGeometry args={[0.065, 0.065, 0.32, 48, 1, true, -Math.PI / 2, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.brass} position={[s * 0.161, 0, 0]} rotation={[0, s * Math.PI / 2, 0]}>
            <circleGeometry args={[0.067, 32, Math.PI, Math.PI]} />
          </mesh>
        ))}
        <mesh material={bulb} position={[0, -0.025, 0]} rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.012, 0.18, 6, 16]} />
        </mesh>
        <mesh material={m.brass} position={[0.09, -0.08, 0.02]}>
          <cylinderGeometry args={[0.0012, 0.0012, 0.09, 6]} />
        </mesh>
        <mesh material={m.brass} position={[0.09, -0.128, 0.02]}>
          <sphereGeometry args={[0.005, 12, 12]} />
        </mesh>
      </group>
    </group>
  )
}

// ---- Coffee cup with rising steam -----------------------------------------------------------------------

const steamVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.x += sin(uv.y * 5.0 + uTime * 1.3 + uSeed) * 0.012 * uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const steamFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.22 + uSeed;
    float width = mix(0.12, 0.42, uv.y);
    float cx = 0.5 + (fbm(vec2(uv.y * 2.0 - t, uSeed)) - 0.5) * 0.5 * uv.y;
    float column = smoothstep(width, 0.0, abs(uv.x - cx));
    float wisps = fbm(vec2(uv.x * 3.0, uv.y * 2.4 - t * 1.6));
    wisps = smoothstep(0.42, 0.85, wisps);
    float fade = smoothstep(0.0, 0.18, uv.y) * (1.0 - smoothstep(0.45, 1.0, uv.y));
    float a = column * wisps * fade * uStrength;
    gl_FragColor = vec4(uColor, a);
  }
`

function Steam({ seed, height }: { seed: number; height: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: steamVertex,
    fragmentShader: steamFragment,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uStrength: { value: 0.5 }, uColor: { value: new THREE.Color('#fff7ec') } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), [seed])
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime
    mat.uniforms.uStrength.value = THREE.MathUtils.lerp(0.35, 0.6, night.current)
  })
  return (
    <mesh material={mat} position={[0, height / 2, 0]}>
      <planeGeometry args={[0.09, height, 1, 24]} />
    </mesh>
  )
}

export function CoffeeCup() {
  const m = useMaterials()
  const { cup, saucer } = useMemo(() => {
    const cupPts = [
      [0.0, 0.004], [0.029, 0.004], [0.031, 0.0], [0.034, 0.002], [0.038, 0.03], [0.041, 0.07], [0.0425, 0.084],
      [0.0405, 0.086], [0.0385, 0.07], [0.0355, 0.03], [0.027, 0.012], [0.0, 0.01],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const saucerPts = [
      [0.0, 0.0], [0.045, 0.0], [0.05, 0.003], [0.072, 0.009], [0.076, 0.013], [0.074, 0.014], [0.05, 0.008], [0.0, 0.006],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    return { cup: new THREE.LatheGeometry(cupPts, 72), saucer: new THREE.LatheGeometry(saucerPts, 72) }
  }, [])
  const base = 0.008
  return (
    <group position={[CUP.x, DESK.top, CUP.z]}>
      <mesh geometry={saucer} material={m.ceramic} castShadow receiveShadow />
      <group position={[0, base, 0]}>
        <mesh geometry={cup} material={m.ceramic} castShadow receiveShadow />
        <mesh material={m.coffee} position={[0, 0.072, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.0392, 48]} />
        </mesh>
        <mesh material={m.ceramic} position={[0.046, 0.046, 0]} rotation-z={-Math.PI / 2} castShadow>
          <torusGeometry args={[0.019, 0.0055, 16, 32, Math.PI]} />
        </mesh>
        <Billboard position={[0, 0.08, 0]} lockX lockZ>
          <Steam seed={0.0} height={0.24} />
        </Billboard>
        <Billboard position={[0.006, 0.08, 0.004]} lockX lockZ>
          <Steam seed={3.7} height={0.2} />
        </Billboard>
      </group>
    </group>
  )
}

// ---- Small things -----------------------------------------------------------------------------------------

export function Books() {
  const books = [
    { size: [0.24, 0.032, 0.17], color: '#3b2b23', rot: 0.18 },
    { size: [0.21, 0.026, 0.15], color: '#24372e', rot: 0.05 },
    { size: [0.19, 0.022, 0.13], color: '#6d2a22', rot: 0.26 },
  ] as const
  let y = DESK.top
  return (
    <group position={[-0.53, 0, 0.0]}>
      {books.map((b, i) => {
        const [w, h, d] = b.size
        const cy = y + h / 2
        y += h
        return (
          <group key={i} position={[0, cy, 0]} rotation-y={b.rot}>
            <RoundedBox args={[w, h, d]} radius={0.002} smoothness={2} castShadow receiveShadow>
              <meshStandardMaterial color={b.color} roughness={0.75} />
            </RoundedBox>
            <mesh position={[0.004, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[w - 0.004, h - 0.004, d + 0.0004 - 0.008]} />
              <meshStandardMaterial color="#e9dcbc" roughness={0.95} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
