import * as THREE from 'three'

// Image slots for the framed wall art. Each slot tries a local file in public/art/ first (drop your own
// high-res scan there), then the remote URL. Images are cropped to the frame and tone-mapped on a canvas,
// so a colourful map arrives as a quiet grey print. Remote hosts must send CORS headers (Wikimedia does).

export type Tone = 'original' | 'mono' | 'grey'

export type ArtSlot = {
  id: string
  local: string // file name in public/art/
  url: string // remote fallback
  tone: Tone
  /** focus point for the cover crop, 0..1 from the top-left */
  focus?: [number, number]
  credit: string
}

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons'

/** The wide picture above the desk. Drop your image at public/art/wide.png (or change `local`); 5:3 fits exactly. */
export const WIDE_ART: ArtSlot = {
  id: 'wide',
  local: 'wide.png',
  url: '', // no remote fallback: the frame shows plain mat board until the file is there
  tone: 'original',
  credit: '',
}
export const WIDE_ASPECT = 5 / 3

/** The earlier trio of small frames (not hung at the moment; see WallArt in Room.tsx). */
export const ART: Record<'nietzsche' | 'palestine' | 'ibnRushd', ArtSlot> = {
  nietzsche: {
    id: 'nietzsche',
    local: 'nietzsche.jpg',
    url: `${WIKI}/1/1b/Nietzsche187a.jpg`,
    tone: 'mono',
    focus: [0.5, 0.35],
    credit: 'Friedrich Nietzsche, photograph by Gustav Schultze, 1882 (public domain, Wikimedia Commons)',
  },
  palestine: {
    id: 'palestine',
    local: 'palestine-map.jpg',
    url: `${WIKI}/thumb/5/55/1933_Motor_map_of_Palestine%2C_Survey_of_Palestine.jpg/1920px-1933_Motor_map_of_Palestine%2C_Survey_of_Palestine.jpg`,
    tone: 'grey',
    focus: [0.62, 0.5],
    credit: 'Survey of Palestine, Motor Map 1:500,000, 1933 (public domain, Wikimedia Commons)',
  },
  ibnRushd: {
    id: 'ibn-rushd',
    local: 'ibn-rushd.jpg',
    url: `${WIKI}/6/66/Averroes_closeup.jpg`,
    tone: 'original',
    focus: [0.55, 0.35],
    credit: 'Averroes, detail of The School of Athens by Raphael, 1511 (public domain, Wikimedia Commons)',
  },
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Vite answers a missing public file with index.html, so check the type before trusting it. */
async function localExists(file: string) {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}art/${file}`, { method: 'HEAD' })
    return r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')
  } catch {
    return false
  }
}

function tone(g: CanvasRenderingContext2D, w: number, h: number, mode: Tone) {
  if (mode === 'original') return
  const img = g.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    if (mode === 'mono') {
      // neutral silver-gelatin look, a touch of warmth in the highlights
      d[i] = l * 1.02; d[i + 1] = l; d[i + 2] = l * 0.96
    } else {
      // soft grey print: a gentle curve keeps the linework while the paper settles to mid-grey
      const v = 34 + Math.pow(l / 255, 1.7) * 196
      d[i] = v; d[i + 1] = v; d[i + 2] = v * 0.98
    }
  }
  g.putImageData(img, 0, 0)
}

/**
 * Texture for a frame of the given aspect (w / h). Starts as blank mat-board and is filled in once the
 * image arrives; if neither the local file nor the URL loads, the frame simply stays blank.
 */
export function artTexture(slot: ArtSlot, aspect: number, anisotropy: number) {
  const H = 1400
  const W = Math.round(H * aspect)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#d9d3c7'
  g.fillRect(0, 0, W, H)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy

  ;(async () => {
    const local = (await localExists(slot.local)) ? [`${import.meta.env.BASE_URL}art/${slot.local}`] : []
    const sources = [...local, slot.url].filter(Boolean)
    for (const src of sources) {
      try {
        const img = await loadImage(src)
        const [fx, fy] = slot.focus ?? [0.5, 0.5]
        const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) // cover
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s
        const dx = Math.min(0, Math.max(W - dw, W / 2 - fx * dw))
        const dy = Math.min(0, Math.max(H - dh, H / 2 - fy * dh))
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, dx, dy, dw, dh)
        tone(g, W, H, slot.tone)
        tex.needsUpdate = true
        return
      } catch {
        /* try the next source */
      }
    }
    console.warn(`[wall art] could not load "${slot.id}" — add public/art/${slot.local}`)
  })()

  return tex
}
