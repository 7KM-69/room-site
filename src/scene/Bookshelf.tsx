import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { ROOM } from './layout'
import { useAnisotropy, useMaterials } from './materials'

/** Seeded PRNG (mulberry32) so the shelf looks the same on every visit. */
export function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Spine = { base: string; foil: string; title: string; style: 'cloth' | 'leather' | 'paper' }

// A philosopher's shelf. Every design is painted once at 256×1024 and shared by several books.
const SPINES: Spine[] = [
  { base: '#5b2420', foil: '#d8b46a', title: 'Also sprach Zarathustra', style: 'leather' },
  { base: '#1f3a33', foil: '#d8b46a', title: 'تهافت التهافت', style: 'cloth' },
  { base: '#22304a', foil: '#e3d3a8', title: 'Beyond Good and Evil', style: 'cloth' },
  { base: '#6b4a2b', foil: '#2a1c12', title: 'مقدّمة ابن خلدون', style: 'leather' },
  { base: '#ece3cf', foil: '#7a2a20', title: 'The Myth of Sisyphus', style: 'paper' },
  { base: '#2b2421', foil: '#c9a35a', title: 'Ethica', style: 'leather' },
  { base: '#7c2f22', foil: '#f0e2bf', title: 'Being and Time', style: 'cloth' },
  { base: '#3c4a3a', foil: '#e6d7b0', title: 'فصل المقال', style: 'cloth' },
  { base: '#d7c7a2', foil: '#2b2a2f', title: 'Fear and Trembling', style: 'paper' },
  { base: '#18222c', foil: '#cfb57a', title: 'Critique of Pure Reason', style: 'leather' },
  { base: '#8a6a3c', foil: '#1d150f', title: 'Meditations', style: 'cloth' },
  { base: '#43262e', foil: '#e0c486', title: 'الإشارات والتنبيهات', style: 'leather' },
  { base: '#b9b2a1', foil: '#3a2f28', title: 'The Republic', style: 'paper' },
  { base: '#2f3640', foil: '#ead9ad', title: 'Tao Te Ching', style: 'cloth' },
]

function paintSpine(s: Spine, seed: number) {
  const W = 256, H = 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  const r = rng(seed)
  g.fillStyle = s.base
  g.fillRect(0, 0, W, H)
  // rounded spine: darker towards both edges
  const roll = g.createLinearGradient(0, 0, W, 0)
  roll.addColorStop(0, 'rgba(0,0,0,0.35)')
  roll.addColorStop(0.25, 'rgba(255,255,255,0.06)')
  roll.addColorStop(0.5, 'rgba(255,255,255,0.1)')
  roll.addColorStop(0.75, 'rgba(255,255,255,0.03)')
  roll.addColorStop(1, 'rgba(0,0,0,0.35)')
  g.fillStyle = roll
  g.fillRect(0, 0, W, H)
  // weave / grain / wear
  const img = g.getImageData(0, 0, W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let n = (r() - 0.5) * (s.style === 'leather' ? 18 : 10)
      if (s.style === 'cloth') n += ((x + y) % 4 < 2 ? 4 : -4) // fine weave
      const wear = Math.max(0, 1 - Math.min(y, H - y) / 40) * 30 // rubbed head and tail
      img.data[i] += n + wear; img.data[i + 1] += n + wear; img.data[i + 2] += n + wear * 0.8
    }
  g.putImageData(img, 0, 0)

  g.fillStyle = s.foil
  g.strokeStyle = s.foil
  if (s.style === 'leather') {
    // raised bands with gilt rules
    for (const y of [130, 300, 760, 900]) {
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(0, y + 10, W, 8)
      g.fillStyle = 'rgba(255,255,255,0.12)'
      g.fillRect(0, y, W, 8)
      g.fillStyle = s.foil
      g.fillRect(14, y - 10, W - 28, 3)
      g.fillRect(14, y + 24, W - 28, 3)
    }
  } else if (s.style === 'cloth') {
    g.lineWidth = 4
    g.strokeRect(16, 40, W - 32, 8)
    g.strokeRect(16, H - 48, W - 32, 8)
  } else {
    g.fillRect(0, 70, W, 46)
    g.fillRect(0, H - 116, W, 46)
  }

  // title along the spine, reading top to bottom
  g.save()
  g.translate(W / 2, H / 2)
  g.rotate(Math.PI / 2)
  g.fillStyle = s.foil
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const arabic = /[؀-ۿ]/.test(s.title)
  let size = 96
  g.font = `700 ${size}px ${arabic ? 'Amiri' : 'Georgia, "Times New Roman"'}, serif`
  while (g.measureText(s.title).width > 560 && size > 40) {
    size -= 4
    g.font = `700 ${size}px ${arabic ? 'Amiri' : 'Georgia, "Times New Roman"'}, serif`
  }
  g.fillText(s.title, 0, 0)
  g.restore()

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

type Book = { p: THREE.Vector3; s: THREE.Vector3; lean: number }

/** One instanced mesh per spine design; box faces: +x, -x, +y, -y, +z (spine, facing the room), -z. */
function BookRun({ design, books, aniso }: { design: number; books: Book[]; aniso: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const mats = useMemo(() => {
    const spine = paintSpine(SPINES[design], design * 977 + 13)
    spine.anisotropy = aniso
    document.fonts?.load('700 40px Amiri').then(() => {
      const fresh = paintSpine(SPINES[design], design * 977 + 13)
      spine.image = fresh.image
      spine.needsUpdate = true
    }, () => {})
    const cover = new THREE.MeshStandardMaterial({ color: SPINES[design].base, roughness: 0.75 })
    const paper = new THREE.MeshStandardMaterial({ color: '#e7dcc0', roughness: 0.95 })
    const face = new THREE.MeshStandardMaterial({ map: spine, roughness: SPINES[design].style === 'leather' ? 0.55 : 0.8 })
    return [cover, cover, paper, paper, face, cover]
  }, [design, aniso])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    books.forEach((b, i) => {
      o.position.copy(b.p)
      o.scale.copy(b.s)
      o.rotation.set(0, 0, b.lean)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [books])
  return (
    <instancedMesh ref={ref} args={[undefined, mats, books.length]} castShadow receiveShadow>
      <boxGeometry />
    </instancedMesh>
  )
}

export function Bookshelf() {
  const m = useMaterials()
  const aniso = useAnisotropy()
  const W = 0.82, H = 1.95, D = 0.3, shelves = 5, board = 0.022
  const x0 = 1.0 + W / 2, z0 = ROOM.backZ + D / 2
  const shelfY = (i: number) => 0.1 + i * ((H - 0.1) / shelves)

  const runs = useMemo(() => {
    const r = rng(7)
    const byDesign: Book[][] = SPINES.map(() => [])
    for (let i = 0; i < shelves; i++) {
      const y = shelfY(i) + board / 2
      let x = -W / 2 + board / 2 + 0.008
      const end = W / 2 - board / 2 - 0.01
      // leave room on alternate shelves for a small stack lying flat
      const stackW = i % 2 ? 0.25 : 0
      while (x < end - stackW - 0.03) {
        if (r() < 0.05) { x += 0.03 + r() * 0.04; continue } // a gap
        const t = 0.022 + r() * 0.03, h = 0.21 + r() * 0.1, d = 0.17 + r() * 0.06
        byDesign[Math.floor(r() * SPINES.length)].push({
          p: new THREE.Vector3(x + t / 2, y + h / 2, D / 2 - d / 2 - 0.01 - r() * 0.015),
          s: new THREE.Vector3(t, h, d),
          lean: 0,
        })
        x += t + 0.0015
      }
      if (stackW) {
        let sy = y
        for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
          const t = 0.025 + r() * 0.02, h = 0.2 + r() * 0.04, d = 0.16 + r() * 0.04
          // lying on its side: the spine still faces the room
          byDesign[Math.floor(r() * SPINES.length)].push({
            p: new THREE.Vector3(end - 0.13 + (r() - 0.5) * 0.02, sy + t / 2, D / 2 - d / 2 - 0.01),
            s: new THREE.Vector3(t, h, d),
            lean: Math.PI / 2,
          })
          sy += t
        }
      }
    }
    return byDesign
  }, [])

  return (
    <group position={[x0, 0, z0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.deskWood} position={[(s * (W - board)) / 2, H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[board, H, D]} />
        </mesh>
      ))}
      <mesh material={m.deskWood} position={[0, H / 2, -D / 2 + 0.006]} receiveShadow>
        <boxGeometry args={[W, H, 0.012]} />
      </mesh>
      {Array.from({ length: shelves + 1 }, (_, i) => (
        <mesh key={i} material={m.deskWood} position={[0, shelfY(i), 0]} castShadow receiveShadow>
          <boxGeometry args={[W, board, D]} />
        </mesh>
      ))}
      <mesh material={m.trim} position={[0, 0.05, 0.01]}>
        <boxGeometry args={[W, 0.1, D - 0.02]} />
      </mesh>
      {runs.map((books, i) => books.length > 0 && <BookRun key={i} design={i} books={books} aniso={aniso} />)}
    </group>
  )
}
