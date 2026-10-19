import { PAGE, PAPER_HEX } from './layout'

// How a notebook page is painted. Positions and sizes are fractions of the page (y and size of its height,
// x of its width), so the same description works at any texture resolution.

export type Line = {
  text: string
  y: number // baseline
  size: number
  weight: 400 | 700
  color: string
  align?: 'center' | 'right' | 'left'
  x?: number // anchor; defaults to the centre, or the matching margin for left/right-aligned text
  font?: string // canvas font-family; defaults to the Arabic face
  mark?: [number, number] // characters to underlay with a highlighter stroke (search hit)
}

export const INK = '#2b231c'
export const MUTED = '#8a7660'

export const RULES = { first: 0.12, spacing: 0.043, last: 0.93 } // ruled lines, fractions of the height
export const FONT = 'Amiri, "Noto Naskh Arabic", serif'

let grainPattern: CanvasPattern | null = null
/** Paper fibre noise, tiled from one small canvas (much cheaper than touching every pixel of every page). */
function grain(g: CanvasRenderingContext2D, w: number, h: number) {
  if (!grainPattern) {
    const n = document.createElement('canvas')
    n.width = n.height = 256
    const ng = n.getContext('2d')!
    const img = ng.createImageData(256, 256)
    let seed = 1337
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd() < 0.5 ? 0 : 255
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = rnd() * 10
    }
    ng.putImageData(img, 0, 0)
    grainPattern = g.createPattern(n, 'repeat')
  }
  g.fillStyle = grainPattern!
  g.fillRect(0, 0, w, h)
}

/** Right margin of the text block, as a fraction of the page width. */
export const TEXT_BOX = { right: 0.89, left: 0.11 }

export const PAGE_PX = { w: 1600, h: Math.round((1600 * PAGE.d) / PAGE.w) } // sharp enough for the full-screen spread

/** Parchment page with faint rules and ink. `spine` is the side that runs into the gutter. */
export function paintPage(c: HTMLCanvasElement, lines: Line[], spine: 'left' | 'right', dir: 'rtl' | 'ltr' = 'rtl') {
  const { w: W, h: H } = PAGE_PX
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = PAPER_HEX
  g.fillRect(0, 0, W, H)
  // gentle ageing towards the edges
  const age = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75)
  age.addColorStop(0, 'rgba(160,120,60,0)')
  age.addColorStop(1, 'rgba(160,120,60,0.10)')
  g.fillStyle = age
  g.fillRect(0, 0, W, H)
  grain(g, W, H)

  g.strokeStyle = 'rgba(150,128,96,0.32)'
  g.lineWidth = 2
  for (let y = RULES.first; y < RULES.last; y += RULES.spacing) {
    g.beginPath()
    g.moveTo(W * 0.08, y * H)
    g.lineTo(W * 0.92, y * H)
    g.stroke()
  }

  g.direction = dir
  g.textBaseline = 'alphabetic'
  for (const l of lines) {
    const align = l.align ?? 'center'
    g.textAlign = align
    g.font = `${l.weight} ${Math.round(l.size * H)}px ${l.font ?? FONT}`
    const x = l.x ?? (align === 'right' ? TEXT_BOX.right : align === 'left' ? TEXT_BOX.left : 0.5)
    if (l.mark) highlighter(g, l, x * W, align, dir)
    g.fillStyle = l.color
    g.fillText(l.text, x * W, l.y * H)
  }

  // shadow where the page dives into the gutter
  const gx = spine === 'left' ? 0 : W
  const gutter = g.createLinearGradient(gx, 0, spine === 'left' ? W * 0.14 : W * 0.86, 0)
  gutter.addColorStop(0, 'rgba(70,45,20,0.28)')
  gutter.addColorStop(1, 'rgba(70,45,20,0)')
  g.fillStyle = gutter
  g.fillRect(0, 0, W, H)
}

/** A soft yellow marker stroke behind `l.mark`, slightly uneven like a real highlighter pen. */
function highlighter(g: CanvasRenderingContext2D, l: Line, x: number, align: CanvasTextAlign, dir: 'rtl' | 'ltr') {
  const [a, b] = l.mark!
  const H = PAGE_PX.h
  const total = g.measureText(l.text).width
  const wa = g.measureText(l.text.slice(0, a)).width
  const wb = g.measureText(l.text.slice(0, b)).width
  // the edge where the line's first character sits
  const start = align === 'center' ? (dir === 'rtl' ? x + total / 2 : x - total / 2) : x
  const s = dir === 'rtl' ? -1 : 1
  const x0 = Math.min(start + s * wa, start + s * wb) - 6
  const x1 = Math.max(start + s * wa, start + s * wb) + 6
  const size = l.size * H
  const y = l.y * H - size * 0.72
  g.save()
  g.fillStyle = 'rgba(246, 205, 72, 0.5)'
  g.beginPath()
  g.moveTo(x0 + 3, y + 2)
  g.lineTo(x1, y - 1)
  g.lineTo(x1 - 2, y + size * 0.92)
  g.lineTo(x0, y + size * 0.98)
  g.closePath()
  g.fill()
  g.restore()
}
