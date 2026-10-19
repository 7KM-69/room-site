import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DESK, ROOM, type Mode } from './layout'
import { useAnisotropy, useMaterials } from './materials'
import { WIDE_ART, WIDE_ASPECT, artTexture, type ArtSlot } from './wallArt'
import { Bookshelf, rng } from './Bookshelf'
import { NightSky } from './NightSky'

const T = 0.12 // wall thickness

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Walls() {
  const m = useMaterials()
  const { backZ, leftX, rightX, frontZ, height: H, window: win } = ROOM
  const depth = frontZ - backZ
  const width = rightX - leftX
  const lx = leftX - T / 2
  // left wall is four blocks around the window opening, so sunlight only gets in through the glass
  const left: [number, number, number, number][] = [
    // [zCenter, zSize, yCenter, ySize]
    [(backZ + frontZ) / 2, depth, win.y0 / 2, win.y0],
    [(backZ + frontZ) / 2, depth, (win.y1 + H) / 2, H - win.y1],
    [(backZ + win.z0) / 2, win.z0 - backZ, (win.y0 + win.y1) / 2, win.y1 - win.y0],
    [(win.z1 + frontZ) / 2, frontZ - win.z1, (win.y0 + win.y1) / 2, win.y1 - win.y0],
  ]
  return (
    <group>
      <mesh material={m.floor} rotation-x={-Math.PI / 2} position={[(leftX + rightX) / 2, 0, (backZ + frontZ) / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
      </mesh>
      <mesh material={m.wall} position={[(leftX + rightX) / 2, H / 2, backZ - T / 2]} receiveShadow castShadow>
        <boxGeometry args={[width + 2 * T, H, T]} />
      </mesh>
      <mesh material={m.wall} position={[rightX + T / 2, H / 2, (backZ + frontZ) / 2]} receiveShadow castShadow>
        <boxGeometry args={[T, H, depth]} />
      </mesh>
      {left.map(([zc, zs, yc, ys], i) => (
        <mesh key={i} material={m.wall} position={[lx, yc, zc]} receiveShadow castShadow>
          <boxGeometry args={[T, ys, zs]} />
        </mesh>
      ))}
      <mesh position={[(leftX + rightX) / 2, H + 0.05, (backZ + frontZ) / 2]} castShadow>
        <boxGeometry args={[width + 2 * T, 0.1, depth]} />
        <meshStandardMaterial color="#d8d0c4" roughness={0.95} />
      </mesh>
      {/* skirting boards */}
      <mesh material={m.trim} position={[(leftX + rightX) / 2, 0.06, backZ + 0.008]} receiveShadow>
        <boxGeometry args={[width, 0.12, 0.016]} />
      </mesh>
      <mesh material={m.trim} position={[leftX + 0.008, 0.06, (backZ + frontZ) / 2]} receiveShadow>
        <boxGeometry args={[0.016, 0.12, depth]} />
      </mesh>
    </group>
  )
}

function WindowFrame({ mode }: { mode: Mode }) {
  const m = useMaterials()
  const { leftX, window: w } = ROOM
  const zc = (w.z0 + w.z1) / 2, yc = (w.y0 + w.y1) / 2
  const zs = w.z1 - w.z0, ys = w.y1 - w.y0
  const bar = 0.045
  const x = leftX - T / 2

  const day = useMemo(() => canvasTex(512, 512, (g) => {
    const s = g.createLinearGradient(0, 0, 0, 512)
    s.addColorStop(0, '#9fc3e6'); s.addColorStop(0.6, '#e6eef2'); s.addColorStop(1, '#fbe9cf')
    g.fillStyle = s; g.fillRect(0, 0, 512, 512)
    g.fillStyle = 'rgba(120,135,110,0.55)' // far tree line
    g.beginPath(); g.moveTo(0, 512)
    for (let i = 0; i <= 64; i++) g.lineTo(i * 8, 400 - Math.sin(i * 0.7) * 14 - Math.sin(i * 2.3) * 8)
    g.lineTo(512, 512); g.fill()
  }), [])
  const night = useMemo(() => canvasTex(1024, 1024, (g) => {
    const s = g.createLinearGradient(0, 0, 0, 1024)
    s.addColorStop(0, '#03070f'); s.addColorStop(0.55, '#0b1428'); s.addColorStop(1, '#1c2742')
    g.fillStyle = s; g.fillRect(0, 0, 1024, 1024)
    // faint diagonal haze of the galaxy
    const r = rng(5)
    for (let i = 0; i < 260; i++) {
      const t = r(), x = t * 1024, y = 120 + t * 420 + (r() - 0.5) * 220, rad = 30 + r() * 90
      const h = g.createRadialGradient(x, y, 0, x, y, rad)
      h.addColorStop(0, 'rgba(150,170,220,0.035)'); h.addColorStop(1, 'rgba(150,170,220,0)')
      g.fillStyle = h; g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    const glow = g.createRadialGradient(300, 230, 0, 300, 230, 160)
    glow.addColorStop(0, 'rgba(240,235,215,0.35)'); glow.addColorStop(1, 'rgba(240,235,215,0)')
    g.fillStyle = glow; g.fillRect(140, 70, 320, 320)
    g.fillStyle = '#f1ead4'; g.beginPath(); g.arc(300, 230, 30, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(180,170,150,0.25)' // maria
    for (const [dx, dy, rr] of [[-8, -6, 9], [9, 5, 7], [-3, 12, 5]]) { g.beginPath(); g.arc(300 + dx, 230 + dy, rr, 0, Math.PI * 2); g.fill() }
    g.fillStyle = '#05080f'
    g.beginPath(); g.moveTo(0, 1024)
    for (let i = 0; i <= 128; i++) g.lineTo(i * 8, 800 - Math.sin(i * 0.35) * 28 - Math.sin(i * 1.15) * 16 - Math.sin(i * 3.1) * 5)
    g.lineTo(1024, 1024); g.fill()
  }), [])

  const nightMat = useRef<THREE.MeshBasicMaterial>(null)
  const dayMat = useRef<THREE.MeshBasicMaterial>(null)
  const k = useRef(mode === 'night' ? 1 : 0)
  useFrame((_, dt) => {
    k.current = THREE.MathUtils.damp(k.current, mode === 'night' ? 1 : 0, 3, dt)
    if (nightMat.current) nightMat.current.opacity = k.current
    if (dayMat.current) dayMat.current.color.setScalar(THREE.MathUtils.lerp(2.2, 0.2, k.current))
  })

  return (
    <group>
      {/* sky seen through the window; never casts shadows so the sun gets through */}
      <mesh position={[leftX - 1.6, yc + 0.2, zc]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[4.5, 3.4]} />
        <meshBasicMaterial ref={dayMat} map={day} />
      </mesh>
      <mesh position={[leftX - 1.59, yc + 0.2, zc]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[4.5, 3.4]} />
        <meshBasicMaterial ref={nightMat} map={night} transparent />
      </mesh>
      {/* the tree line sits 22% up the sheet; stars only above it */}
      <NightSky center={[leftX - 1.55, yc + 0.2, zc]} size={[4.5, 3.4]} horizon={0.24} />
      {/* reveal boards */}
      {[
        [x, w.y0 + 0.01, zc, T, 0.02, zs],
        [x, w.y1 - 0.01, zc, T, 0.02, zs],
        [x, yc, w.z0 + 0.01, T, ys, 0.02],
        [x, yc, w.z1 - 0.01, T, ys, 0.02],
        [x, yc, zc, 0.04, ys, bar * 0.8], // mullion
        [x, yc + 0.18, zc, 0.04, bar * 0.8, zs], // transom
      ].map(([px, py, pz, sx, sy, sz], i) => (
        <mesh key={i} material={m.windowWood} position={[px, py, pz]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
        </mesh>
      ))}
      <mesh material={m.windowWood} position={[leftX + 0.05, w.y0 - 0.015, zc]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.03, zs + 0.12]} />
      </mesh>
    </group>
  )
}

function Frame({ position, size, slot, mat: matW = 0.05 }: { position: [number, number, number]; size: [number, number]; slot: ArtSlot; mat?: number }) {
  const m = useMaterials()
  const aniso = useAnisotropy()
  const [w, h] = size
  const border = 0.025, depth = 0.025
  const aw = w - 2 * matW, ah = h - 2 * matW
  const artMat = useMemo(() => new THREE.MeshStandardMaterial({ map: artTexture(slot, aw / ah, aniso), roughness: 0.85 }), [slot, aw, ah, aniso])
  return (
    <group position={position}>
      {[
        [0, h / 2 + border / 2, w + 2 * border, border],
        [0, -h / 2 - border / 2, w + 2 * border, border],
        [-w / 2 - border / 2, 0, border, h],
        [w / 2 + border / 2, 0, border, h],
      ].map(([x, y, sx, sy], i) => (
        <mesh key={i} material={m.frame} position={[x, y, depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, depth]} />
        </mesh>
      ))}
      <mesh material={m.mat} position={[0, 0, 0.004]} receiveShadow>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={artMat} position={[0, 0, 0.005]} receiveShadow>
        <planeGeometry args={[aw, ah]} />
      </mesh>
      <mesh material={m.glass} position={[0, 0, depth - 0.004]}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  )
}

/** One wide frame centred over the desk, clear of the lamp. (The earlier small frames are ART in wallArt.ts.) */
function WallArt() {
  const artW = 0.85 // picture width; the frame adds the mat around it
  const mat = 0.05
  return <Frame position={[-0.04, 1.48, ROOM.backZ]} size={[artW + 2 * mat, artW / WIDE_ASPECT + 2 * mat]} mat={mat} slot={WIDE_ART} />
}

function Rug() {
  const tex = useMemo(() => {
    const t = canvasTex(1024, 700, (g) => {
      g.fillStyle = '#6e2a22'; g.fillRect(0, 0, 1024, 700)
      g.strokeStyle = '#c9a66b'; g.lineWidth = 10; g.strokeRect(40, 40, 944, 620)
      g.strokeStyle = '#26303a'; g.lineWidth = 34; g.strokeRect(80, 80, 864, 540)
      g.strokeStyle = '#c9a66b'; g.lineWidth = 4; g.strokeRect(112, 112, 800, 476)
      g.fillStyle = '#26303a'
      g.beginPath(); g.ellipse(512, 350, 170, 110, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#b48a55'
      g.beginPath(); g.ellipse(512, 350, 90, 55, 0, 0, Math.PI * 2); g.fill()
      const img = g.getImageData(0, 0, 1024, 700)
      const r = rng(11)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (r() - 0.5) * 26
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n
      }
      g.putImageData(img, 0, 0)
    })
    t.anisotropy = 16
    return t
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[DESK.x - 0.05, 0.004, DESK.z + 0.75]} receiveShadow>
      <planeGeometry args={[2.3, 1.6]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  )
}

function Chair() {
  const m = useMaterials()
  const seat = 0.46
  return (
    <group position={[-0.78, 0, DESK.z + 0.62]} rotation-y={1.05}>
      <mesh material={m.deskWood} position={[0, seat, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.035, 0.42]} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} material={m.trim} position={[sx * 0.19, seat / 2, sz * 0.18]} castShadow>
          <cylinderGeometry args={[0.016, 0.013, seat, 10]} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={m.trim} position={[sx * 0.19, seat + 0.24, 0.19]} castShadow>
          <cylinderGeometry args={[0.014, 0.016, 0.48, 10]} />
        </mesh>
      ))}
      <mesh material={m.deskWood} position={[0, seat + 0.42, 0.19]} castShadow>
        <boxGeometry args={[0.42, 0.09, 0.022]} />
      </mesh>
      {[-0.1, 0, 0.1].map((x) => (
        <mesh key={x} material={m.trim} position={[x, seat + 0.2, 0.19]} castShadow>
          <boxGeometry args={[0.022, 0.34, 0.014]} />
        </mesh>
      ))}
    </group>
  )
}

export function Room({ mode }: { mode: Mode }) {
  return (
    <group>
      <Walls />
      <WindowFrame mode={mode} />
      <WallArt />
      <Bookshelf />
      <Rug />
      <Chair />
    </group>
  )
}
