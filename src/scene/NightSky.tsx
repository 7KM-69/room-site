import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { rng } from './Bookshelf'
import { night } from './night'

// Stars seen through the window: real points with randomised position, brightness, colour temperature and
// a slow, out-of-phase twinkle — instead of pixels baked into the sky texture.

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float twinkle = 0.78 + 0.22 * sin(uTime * aSpeed + aPhase) * sin(uTime * aSpeed * 0.37 + aPhase * 1.7);
    vAlpha = aBright * twinkle;
    vColor = aColor;
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const fragment = /* glsl */ `
  uniform float uNight;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = exp(-d * d * 9.0);          // soft gaussian core
    float halo = exp(-d * d * 2.2) * 0.18;   // faint bloom
    float a = (core + halo) * vAlpha * uNight * (1.0 - smoothstep(0.85, 1.0, d));
    gl_FragColor = vec4(vColor, a);
  }
`

/** Stars on a vertical sheet behind the window. `center` is the sheet centre, `size` its [z, y] extent. */
export function NightSky({ center, size, horizon, count = 520 }: {
  center: [number, number, number]; size: [number, number]; horizon: number; count?: number
}) {
  const dpr = useThree((s) => s.viewport.dpr)
  const { geometry, material } = useMemo(() => {
    const r = rng(2026)
    const pos = new Float32Array(count * 3)
    const sizeA = new Float32Array(count)
    const bright = new Float32Array(count)
    const phase = new Float32Array(count)
    const speed = new Float32Array(count)
    const color = new Float32Array(count * 3)
    const warm = new THREE.Color('#ffe2c0'), white = new THREE.Color('#f4f6ff'), blue = new THREE.Color('#c6d6ff')
    const c = new THREE.Color()
    const [zSize, ySize] = size
    const y0 = center[1] - ySize / 2
    for (let i = 0; i < count; i++) {
      // uniform across, thinning towards the hazy horizon
      const z = center[2] + (r() - 0.5) * zSize
      const v = horizon + (1 - horizon) * Math.pow(r(), 0.75)
      pos.set([center[0], y0 + v * ySize, z], i * 3)
      const mag = Math.pow(r(), 4) // most stars faint, a handful bright
      sizeA[i] = 1.4 + mag * 4.2
      bright[i] = (0.25 + mag * 0.75) * THREE.MathUtils.smoothstep(v, horizon, horizon + 0.15)
      phase[i] = r() * Math.PI * 2
      speed[i] = 0.6 + r() * 2.2
      const t = r()
      c.copy(t < 0.2 ? warm : t < 0.75 ? white : blue)
      color.set([c.r, c.g, c.b], i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizeA, 1))
    geometry.setAttribute('aBright', new THREE.BufferAttribute(bright, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uNight: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry, material }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...center, ...size, horizon, count])

  useFrame((s) => {
    material.uniforms.uTime.value = s.clock.elapsedTime
    material.uniforms.uPixelRatio.value = dpr
    material.uniforms.uNight.value = THREE.MathUtils.smoothstep(night.current, 0.35, 1)
  })
  return <points geometry={geometry} material={material} frustumCulled={false} />
}
