import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DESK, NOTEBOOK, PAGE, TIMELINE, smoothstep } from './layout'
import { useAnisotropy, useMaterials } from './materials'
import { UI, type Lang } from './i18n'
import { book, keepPages, pageTexture } from './book'
import type { ThreeEvent } from '@react-three/fiber'
import { scroll } from './scroll'

const C = NOTEBOOK.cover
const HINGE = C + PAGE.block // height of the hinge line above the desk: where the two page stacks meet when closed
const CW = PAGE.w + NOTEBOOK.coverMargin
const CD = PAGE.d + 2 * NOTEBOOK.coverMargin

/**
 * Height of the paper surface above the cover board at distance `s` (m) from the spine, fully open:
 * the pages dive into the gutter, swell slightly just beside it, then lie almost flat.
 */
export function pageHeight(s: number) {
  const settle = 1 - Math.exp(-s / 0.012)
  const swell = 0.0024 * Math.exp(-(((s - 0.028) / 0.026) ** 2))
  return 0.0009 + (PAGE.block - 0.0009) * settle + swell - 0.0007 * (s / PAGE.w)
}

/** Same, blended by how far the book is open: a closed book has flat, stacked pages. */
const surfaceAt = (s: number, open: number) => PAGE.block + (pageHeight(s) - PAGE.block) * open

type Deforming = { geometry: THREE.BufferGeometry; update: (open: number) => void }

/** Curved top sheet of one half. side = +1 for the right page (x ≥ 0), -1 for the left page. */
function pageSurface(side: 1 | -1): Deforming {
  const g = new THREE.PlaneGeometry(PAGE.w, PAGE.d, 96, 1)
  g.rotateX(-Math.PI / 2)
  g.translate((side * PAGE.w) / 2, 0, 0)
  const p = g.attributes.position as THREE.BufferAttribute
  return {
    geometry: g,
    update(open) {
      for (let i = 0; i < p.count; i++) p.setY(i, surfaceAt(Math.abs(p.getX(i)), open))
      p.needsUpdate = true
      g.computeVertexNormals()
    },
  }
}

/** Solid page stack under the top sheet, extruded along Z; its top follows the same curve. */
function pageBlock(side: 1 | -1): Deforming {
  const shape = new THREE.Shape()
  const n = 48
  shape.moveTo(0, 0)
  for (let i = 0; i <= n; i++) shape.lineTo((side * i * PAGE.w) / n, PAGE.block)
  shape.lineTo(side * PAGE.w, 0)
  shape.closePath()
  const depth = PAGE.d - 0.0006
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 })
  g.translate(0, 0, -depth / 2)
  const p = g.attributes.position as THREE.BufferAttribute
  const top = Array.from({ length: p.count }, (_, i) => p.getY(i) > 1e-6)
  return {
    geometry: g,
    update(open) {
      for (let i = 0; i < p.count; i++) if (top[i]) p.setY(i, surfaceAt(Math.abs(p.getX(i)), open) - 0.0004)
      p.needsUpdate = true
      g.computeVertexNormals()
    },
  }
}

/**
 * Ribbon marker. It comes out of the head of the gutter (tucked under the paper, so it has no visible cut
 * end), lies against the slope of the left page right beside the fold, then rolls over the bottom edge of
 * the pages and the cover in one smooth curve and settles on the desk, ending in a swallowtail. When the
 * book is closed it is trapped between the pages and only the tail shows.
 */
function ribbon(): Deforming {
  const HALF = 0.0021 // 4.2 mm wide
  const CX = -0.0026 // its centre line, just left of the fold
  const offs = [-1, -0.5, 0, 0.5, 1]
  const cols = offs.length
  const edge = PAGE.d / 2
  const crease: number[] = []
  for (let i = 0; i <= 26; i++) crease.push(-edge + 0.0005 + (i / 26) * (PAGE.d - 0.0005))
  const TAIL = 30
  const rows = crease.length + TAIL + 1 // + the swallowtail row
  const pos = new Float32Array(rows * cols * 3)
  const uv = new Float32Array(rows * cols * 2)
  const index: number[] = []
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1
      index.push(a, d, b, b, d, e)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(index)
  const p = g.attributes.position as THREE.BufferAttribute
  const t = g.attributes.uv as THREE.BufferAttribute
  const side = new THREE.Vector3()
  const lift = (x: number, open: number) => C + surfaceAt(Math.abs(x), open) + 0.00025

  return {
    geometry: g,
    update(open) {
      let k = 0, along = 0, lastZ = crease[0]
      const row = (x: number, y: number, z: number, sx: number, sz: number, ys: number[]) => {
        offs.forEach((o, c) => {
          p.setXYZ(k, x + sx * o * HALF, y + ys[c], z + sz * o * HALF)
          t.setXY(k, c / (cols - 1), along / 0.006)
          k++
        })
      }
      // along the crease, each edge of the ribbon follows the page's own slope
      crease.forEach((z, i) => {
        along += z - lastZ
        lastZ = z
        const tuck = i === 0 ? -0.0009 : 0 // the first row dives under the paper at the head
        row(CX, 0, z, 1, 0, offs.map((o) => lift(CX + o * HALF, open) + tuck))
      })
      // over the edge and onto the desk
      const y0 = lift(CX, open)
      const slope = offs.map((o) => lift(CX + o * HALF, open) - y0)
      const M = NOTEBOOK.coverMargin
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(CX, y0, edge),
        new THREE.Vector3(CX, THREE.MathUtils.lerp(y0, C + 0.0003, 0.6), edge + 0.0026),
        new THREE.Vector3(CX + 0.0002, C + 0.00028, edge + M - 0.0004),
        new THREE.Vector3(CX + 0.0006, C * 0.52, edge + M + 0.0015),
        new THREE.Vector3(CX + 0.0012, 0.0005, edge + M + 0.0046),
        new THREE.Vector3(CX + 0.003, 0.00031, edge + 0.02),
        new THREE.Vector3(CX + 0.0075, 0.0003, edge + 0.036),
        new THREE.Vector3(CX + 0.0135, 0.0003, edge + 0.05),
      ], false, 'centripetal')
      const pts = curve.getSpacedPoints(TAIL)
      const tan = new THREE.Vector3()
      let prev = pts[0]
      for (let i = 1; i <= TAIL; i++) {
        const q = pts[i]
        along += q.distanceTo(prev)
        prev = q
        curve.getTangentAt(i / TAIL, tan)
        side.set(tan.z, 0, -tan.x)
        if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
        side.normalize()
        const fade = 1 - smoothstep(0, 0.004, q.z - edge) // the page's tilt eases out to lying flat
        const cup = smoothstep(edge + M + 0.004, edge + 0.012, q.z) * 0.00012 // the edges curl up a touch
        row(q.x, q.y, q.z, side.x, side.z, slope.map((s, c) => s * fade + cup * offs[c] ** 2))
      }
      // swallowtail: the centre is cut back further than the edges
      const end = pts[TAIL]
      curve.getTangentAt(1, tan)
      along += 0.006
      offs.forEach((o, c) => {
        const d = 0.0062 - 0.0044 * (1 - Math.abs(o))
        p.setXYZ(k, end.x + side.x * o * HALF + tan.x * d, end.y + 0.00012 * o * o, end.z + side.z * o * HALF + tan.z * d)
        t.setXY(k, c / (cols - 1), (along - 0.006 + d) / 0.006)
        k++
      })
      p.needsUpdate = true
      t.needsUpdate = true
      g.computeVertexNormals()
      g.computeBoundingSphere()
    },
  }
}

/** Woven grosgrain for the ribbon: fine lengthwise threads, faint cross ribs, darker selvedges. Tiles along v. */
function ribbonTexture(anisotropy: number) {
  const W = 64, H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#7d1a18'
  g.fillRect(0, 0, W, H)
  for (let x = 0; x < W; x += 2) {
    g.fillStyle = x % 4 ? 'rgba(255,190,170,0.07)' : 'rgba(40,0,0,0.10)'
    g.fillRect(x, 0, 1, H)
  }
  for (let y = 0; y < H; y += 4) {
    g.fillStyle = 'rgba(30,0,0,0.12)'
    g.fillRect(0, y, W, 1)
  }
  g.fillStyle = 'rgba(30,0,0,0.35)'
  g.fillRect(0, 0, 3, H)
  g.fillRect(W - 3, 0, 3, H)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = anisotropy
  return tex
}

/** Gold-tooled border and title on the front cover. Drawn rotated 180° because the cover is flipped shut. */
function coverTooling(anisotropy: number) {
  const W = 740, H = 1080
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  const paint = (lang: Lang) => {
    const ui = UI[lang]
    g.clearRect(0, 0, W, H)
    g.save()
    g.translate(W, H)
    g.rotate(Math.PI)
    g.strokeStyle = '#c9a25a'
    g.lineWidth = 5
    g.strokeRect(46, 46, W - 92, H - 92)
    g.lineWidth = 2
    g.strokeRect(64, 64, W - 128, H - 128)
    g.fillStyle = '#c9a25a'
    g.textAlign = 'center'
    g.direction = ui.dir
    g.font = `700 ${lang === 'ar' ? 84 : 70}px ${ui.font}`
    g.fillText(ui.kicker, W / 2, H * 0.42)
    g.fillRect(W / 2 - 90, H * 0.47, 180, 3)
    g.restore()
    tex.needsUpdate = true
  }
  return { tex, paint }
}

/**
 * The sheet that turns during a page flip. θ = 0 lies on the left page, θ = π on the right page. The free edge
 * lags behind the spine (`dir` says which way it is travelling), so the paper curls instead of swinging stiffly.
 * Two geometries share one position buffer: the face that lies on the left shows a left-page texture, the
 * other face a right-page texture.
 */
function flipSheet() {
  const N = 56
  const pos = new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3)
  const uvL = new Float32Array((N + 1) * 2 * 2)
  const uvR = new Float32Array((N + 1) * 2 * 2)
  const index: number[] = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    for (let j = 0; j < 2; j++) {
      const k = i * 2 + j
      const v = j === 0 ? 1 : 0 // j = 0 is the far (top) edge
      uvL.set([1 - u, v], k * 2) // left-page texture: spine on its right edge
      uvR.set([u, v], k * 2) // right-page texture: spine on its left edge
    }
    if (i < N) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 2, i * 2 + 3, i * 2 + 1)
  }
  const make = (uv: Float32Array) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', pos)
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.setIndex(index)
    return g
  }
  const left = make(uvL), right = make(uvR)
  const ds = PAGE.w / N
  return {
    left,
    right,
    update(theta: number, dir: 1 | -1) {
      const rest = 1 - Math.sin(theta) // 1 while lying on either page, 0 standing up
      let x = 0, y = 0
      for (let i = 0; i <= N; i++) {
        const s = i * ds
        // pages keep the gentle gutter curve while lying down
        const yy = y + rest * (pageHeight(s) - pageHeight(0)) + 0.0005
        for (let j = 0; j < 2; j++) pos.setXYZ(i * 2 + j, x, C + pageHeight(0) + yy, j === 0 ? -PAGE.d / 2 : PAGE.d / 2)
        const lag = dir * 0.55 * Math.sin(theta) * (s / PAGE.w) ** 1.4
        const phi = THREE.MathUtils.clamp(Math.PI - theta + lag, 0, Math.PI)
        x += Math.cos(phi) * ds
        y += Math.sin(phi) * ds
      }
      pos.needsUpdate = true
      left.computeVertexNormals()
      right.computeVertexNormals()
      left.computeBoundingSphere()
    },
  }
}

const FLIP_TIME = 1.1 // seconds per page turn (much quicker while riffling towards a search result)

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/** 0 = closed, 1 = flat open — scrubbed by scroll, so it reverses when scrolling back up. */
const openAmount = () => easeInOut(smoothstep(TIMELINE.open[0], TIMELINE.open[1], scroll.progress))

export function Notebook() {
  const m = useMaterials()
  const aniso = useAnisotropy()
  const parts = useMemo(() => ({
    // page maps are assigned once the chosen language has been laid out (see turnPage)
    right: { surface: pageSurface(1), block: pageBlock(1), mat: new THREE.MeshStandardMaterial({ color: '#fdf6e2', roughness: 0.92 }) },
    left: { surface: pageSurface(-1), block: pageBlock(-1), mat: new THREE.MeshStandardMaterial({ color: '#fdf6e2', roughness: 0.92 }) },
    sheet: flipSheet(),
    // the turning sheet sits a hair above the page it covers; polygon offset keeps it from flickering
    sheetL: new THREE.MeshStandardMaterial({ roughness: 0.92, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    sheetR: new THREE.MeshStandardMaterial({ roughness: 0.92, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    blockMat: new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.95 }),
    ribbon: ribbon(),
    ribbonMat: new THREE.MeshPhysicalMaterial({
      map: ribbonTexture(aniso), roughness: 0.55, sheen: 0.4, sheenRoughness: 0.45, sheenColor: new THREE.Color('#a8403a'), side: THREE.DoubleSide,
    }),
    cover: coverTooling(aniso),
  }), [aniso])
  const tooling = useMemo(() => new THREE.MeshStandardMaterial({ map: parts.cover.tex, transparent: true, metalness: 0.45, roughness: 0.35 }), [parts])

  /**
   * Page turn from spread k to k2. The sheet lifts from one side (the left page when reading Arabic forwards,
   * the right page when reading Turkish forwards) and lands on the other. Its back is the page that will lie on
   * the landing side of k2, and the page waiting underneath on the lifting side is already k2's.
   */
  const turnPage = (dt: number) => {
    const tex = (i: number) => pageTexture(i, aniso)
    // a new language was laid out: show its first spread and retitle the cover
    if (book.state.version !== shownVersion.current && book.state.ready) {
      shownVersion.current = book.state.version
      parts.right.mat.map = tex(book.pageOn('right', book.state.spread))
      parts.left.mat.map = tex(book.pageOn('left', book.state.spread))
      for (const mat of [parts.right.mat, parts.left.mat]) {
        mat.color.set('#ffffff') // the texture carries the paper colour from here on
        mat.needsUpdate = true
      }
      parts.cover.paint(book.state.lang)
      turning.current = null
      if (sheet.current) sheet.current.visible = false
    }
    // a search highlight was painted onto a page of the open spread
    if (book.state.repaint !== shownRepaint.current && !turning.current) {
      shownRepaint.current = book.state.repaint
      parts.right.mat.map = tex(book.pageOn('right', book.state.spread))
      parts.left.mat.map = tex(book.pageOn('left', book.state.spread))
    }
    const req = book.state.flip
    if (req && !turning.current) {
      const k = req.from, k2 = req.from + req.dir
      const lift = book.liftSide(req.dir)
      const land = lift === 'left' ? 'right' : 'left'
      const front = tex(book.pageOn(lift, k))
      const back = tex(book.pageOn(land, k2))
      if (lift === 'left') { parts.sheetL.map = front; parts.sheetR.map = back } else { parts.sheetR.map = front; parts.sheetL.map = back }
      parts[lift].mat.map = tex(book.pageOn(lift, k2))
      parts.sheetL.needsUpdate = parts.sheetR.needsUpdate = true
      turning.current = { from: k, to: k2, lift, t: 0, time: req.quick ? FLIP_TIME * 0.42 : FLIP_TIME }
      if (sheet.current) sheet.current.visible = true
    }
    const f = turning.current
    if (!f) return
    f.t = Math.min(1, f.t + dt / f.time)
    const e = easeInOut(f.t)
    // θ runs 0 → π when the sheet travels left → right, π → 0 the other way
    parts.sheet.update(f.lift === 'left' ? e * Math.PI : (1 - e) * Math.PI, f.lift === 'left' ? 1 : -1)
    if (f.t >= 1) {
      const r = book.pageOn('right', f.to), l = book.pageOn('left', f.to)
      parts.right.mat.map = tex(r)
      parts.left.mat.map = tex(l)
      if (sheet.current) sheet.current.visible = false
      turning.current = null
      keepPages([r, l])
      book.finishFlip()
    }
  }

  // tap a page to turn it: the page you would lift to read on goes forward, the other one back
  // (only once the camera has landed on the spread)
  const landed = () => scroll.progress > TIMELINE.land - 0.02
  const tap = (side: 'left' | 'right') => (e: ThreeEvent<MouseEvent>) => {
    if (!landed() || e.delta > 8) return
    e.stopPropagation()
    if (side === book.liftSide(1)) book.next()
    else book.prev()
  }

  const hinge = useRef<THREE.Group>(null)
  const spine = useRef<THREE.Mesh>(null)
  const last = useRef(-1)
  const sheet = useRef<THREE.Group>(null)
  const turning = useRef<{ from: number; to: number; lift: 'left' | 'right'; t: number; time: number } | null>(null)
  const shownVersion = useRef(-1)
  const shownRepaint = useRef(0)

  useFrame((_, dt) => {
    turnPage(dt)
    const open = openAmount()
    if (Math.abs(open - last.current) < 1e-5) return
    last.current = open
    for (const d of [parts.left.surface, parts.left.block, parts.right.surface, parts.right.block, parts.ribbon]) d.update(open)
    if (hinge.current) hinge.current.rotation.z = Math.PI * (1 - open)
    if (spine.current) {
      // the spine board stands up at the fold when the book is shut and lies flat underneath when open
      const t = 1 - open
      spine.current.position.set(THREE.MathUtils.lerp(0, C / 2, t), THREE.MathUtils.lerp(C / 2 - 0.0006, HINGE, t), 0)
      spine.current.rotation.z = (t * Math.PI) / 2
      spine.current.scale.x = THREE.MathUtils.lerp(0.014, 2 * HINGE + C, t)
    }
  })

  /** Cover board + page stack + top sheet for one half, built on the desk-top plane. */
  const half = (side: 1 | -1, k: 'left' | 'right') => (
    <>
      <mesh material={m.cover} position={[(side * CW) / 2, C / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[CW, C, CD]} />
      </mesh>
      <group position={[0, C, 0]}>
        <mesh geometry={parts[k].block.geometry} material={parts.blockMat} castShadow receiveShadow />
        <mesh geometry={parts[k].surface.geometry} material={parts[k].mat} receiveShadow onClick={tap(k)} />
      </group>
    </>
  )

  return (
    <group position={[NOTEBOOK.x, DESK.top, NOTEBOOK.z]}>
      {half(-1, 'left')}
      {/* the right half swings over on a hinge along the fold */}
      <group ref={hinge} position={[0, HINGE, 0]}>
        <group position={[0, -HINGE, 0]}>
          {half(1, 'right')}
          <mesh material={tooling} position={[CW / 2, -0.0002, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[CW - 0.006, CD - 0.008]} />
          </mesh>
        </group>
      </group>
      <mesh ref={spine} material={m.cover} castShadow receiveShadow>
        <boxGeometry args={[1, C, CD]} />
      </mesh>
      <mesh geometry={parts.ribbon.geometry} material={parts.ribbonMat} castShadow receiveShadow />
      <group ref={sheet} visible={false}>
        <mesh geometry={parts.sheet.left} material={parts.sheetL} castShadow receiveShadow />
        <mesh geometry={parts.sheet.right} material={parts.sheetR} receiveShadow />
      </group>
    </group>
  )
}
