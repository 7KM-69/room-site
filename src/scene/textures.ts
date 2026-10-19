import * as THREE from 'three'

/** #FDF6E2 — the parchment colour shared by the 3D pages and the HTML paper layer. */
export const PAPER_RGB = [253, 246, 226]

// Procedural PBR maps (colour + roughness + normal) baked once at startup — no downloads, crisp at any
// distance thanks to mipmaps + max anisotropy. Swap for photo-scanned maps (e.g. Poly Haven, CC0) later.

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Tileable value noise: integer lattice wraps every `period` cells. */
function noise(x: number, y: number, seed: number, px = 1 << 20, py = px) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const w = (v: number, p: number) => ((v % p) + p) % p
  const x0 = w(xi, px), x1 = w(xi + 1, px), y0 = w(yi, py), y1 = w(yi + 1, py)
  const a = hash(x0, y0, seed), b = hash(x1, y0, seed), c = hash(x0, y1, seed), d = hash(x1, y1, seed)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function fbm(x: number, y: number, seed: number, octaves: number, px?: number, py?: number) {
  let sum = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f, seed + i * 17, px && px * f, py && py * f)
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

type Sample = { c: [number, number, number]; h: number; r: number }

export type PBRSet = { map: THREE.Texture; roughnessMap: THREE.Texture; normalMap: THREE.Texture }

function dataTexture(data: Uint8ClampedArray, w: number, h: number, srgb: boolean) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

function bake(w: number, h: number, sample: (u: number, v: number) => Sample, normalStrength: number): PBRSet {
  const color = new Uint8ClampedArray(w * h * 4)
  const rough = new Uint8ClampedArray(w * h * 4)
  const height = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = sample(x / w, y / h)
      const i = (y * w + x) * 4
      color[i] = s.c[0]; color[i + 1] = s.c[1]; color[i + 2] = s.c[2]; color[i + 3] = 255
      const r = s.r * 255
      rough[i] = rough[i + 1] = rough[i + 2] = r; rough[i + 3] = 255
      height[y * w + x] = s.h
    }
  const normal = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hx = height[y * w + ((x + 1) % w)] - height[y * w + ((x - 1 + w) % w)]
      const hy = height[((y + 1) % h) * w + x] - height[((y - 1 + h) % h) * w + x]
      let nx = -hx * normalStrength, ny = -hy * normalStrength, nz = 1
      const l = Math.hypot(nx, ny, nz)
      nx /= l; ny /= l; nz /= l
      const i = (y * w + x) * 4
      normal[i] = (nx * 0.5 + 0.5) * 255; normal[i + 1] = (ny * 0.5 + 0.5) * 255; normal[i + 2] = (nz * 0.5 + 0.5) * 255; normal[i + 3] = 255
    }
  return { map: dataTexture(color, w, h, true), roughnessMap: dataTexture(rough, w, h, false), normalMap: dataTexture(normal, w, h, false) }
}

const mixc = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as [number, number, number]
const scale = (c: number[], k: number) => [c[0] * k, c[1] * k, c[2] * k] as [number, number, number]

/** Walnut floor planks; one tile ≈ 120 cm square, 8 planks across. */
export function floorPlanks(size = 2048): PBRSet {
  const dark = [52, 33, 22], light = [104, 68, 44]
  return bake(size, size, (u, v) => {
    const row = Math.floor(v * 8)
    const uu = u + hash(row, 0, 3)
    const seg = Math.floor(uu * 2)
    const plank = hash(row, seg, 7)
    const ring = (v * 8 + fbm(uu * 3, v * 8, 11 + row, 3, 3, 8) * 0.9) * 7 + plank * 5
    const g = Math.pow(Math.abs(Math.sin(ring * Math.PI)), 3)
    const fiber = noise(uu * 600, v * 48, 5, 600, 48)
    let c = scale(mixc(dark, light, g * 0.55 + fiber * 0.25 + plank * 0.2), 0.85 + plank * 0.3)
    let h = 0.5 + g * 0.08 + fiber * 0.05
    let r = 0.5 + g * 0.12 + fiber * 0.1
    const fv = v * 8 - row, fu = uu * 2 - Math.floor(uu * 2)
    if (fv < 0.012 || fv > 0.988 || fu < 0.003 || fu > 0.997) { c = scale(c, 0.35); h = 0; r = 0.9 }
    return { c, h, r }
  }, 2)
}

/** Oiled walnut slab for the desk top (grain runs along U). */
export function walnutSlab(w = 1024, h = 512): PBRSet {
  const dark = [48, 29, 19], light = [118, 78, 50]
  return bake(w, h, (u, v) => {
    const warp = fbm(u * 2, v * 4, 21, 5, 2, 4)
    const ring = (v * 2.2 + warp * 1.3) * 8
    const g = Math.pow(Math.abs(Math.sin(ring * Math.PI)), 2)
    const fiber = noise(u * 900, v * 90, 9, 900, 90)
    const c = mixc(dark, light, 0.3 + g * 0.16 + fiber * 0.22 + warp * 0.3)
    return { c, h: 0.5 + g * 0.015 + fiber * 0.04, r: 0.42 + g * 0.06 + fiber * 0.08 }
  }, 1.2)
}

/** Lime-plaster wall, one tile ≈ 100 cm. */
export function plaster(size = 512, base = [74, 64, 57]): PBRSet {
  return bake(size, size, (u, v) => {
    const n = fbm(u * 6, v * 6, 31, 5, 6, 6)
    const fine = noise(u * 160, v * 160, 33, 160, 160)
    return { c: scale(base, 0.9 + n * 0.18 + fine * 0.04), h: n * 0.6 + fine * 0.4, r: 0.92 }
  }, 1.5)
}

/** Pebbled black leather (notebook covers). */
export function leather(size = 512): PBRSet {
  return bake(size, size, (u, v) => {
    const n = fbm(u * 110, v * 110, 41, 2, 110, 110)
    const crease = 1 - Math.abs(n * 2 - 1)
    return { c: scale([24, 22, 21], 0.92 + crease * 0.12), h: crease, r: 0.55 + crease * 0.15 }
  }, 1.2)
}

/** Stacked page edges for the sides of the page block. */
export function pageEdges(w = 256, h = 64): PBRSet {
  return bake(w, h, (_u, v) => {
    const layer = Math.floor(v * 48)
    const k = 0.86 + hash(layer, 0, 61) * 0.12
    return { c: scale(PAPER_RGB, k * 0.97), h: k, r: 0.95 }
  }, 1)
}

export function applyAnisotropy(set: PBRSet, a: number) {
  set.map.anisotropy = set.roughnessMap.anisotropy = set.normalMap.anisotropy = a
}

export function setRepeat(set: PBRSet, x: number, y: number) {
  for (const t of [set.map, set.roughnessMap, set.normalMap]) t.repeat.set(x, y)
}
