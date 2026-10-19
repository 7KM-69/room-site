import * as THREE from 'three'
import { useSyncExternalStore } from 'react'
import { fieldsFor, parseContent } from './content'
import { UI, language, type Lang } from './i18n'
import { INK, MUTED, PAGE_PX, RULES, TEXT_BOX, paintPage, type Line } from './pageContent'
import { excerpt, findIn } from './search'
import { library } from './library'
import { scroll } from './scroll'
import { TIMELINE } from './layout'

// The notebook as a book: pages in reading order, which spread is open, and page turns.
//
// Arabic (rtl): page 2k is the right page of spread k, 2k+1 its left page; "next" turns the left page over
// to the right. Turkish (ltr): page 2k is the left page, 2k+1 the right; "next" turns the right page to the left.
//
// Page order: epigraph, contents, then each article opening on a fresh spread (title page first).

export type Side = 'left' | 'right'

// ---- Layout ----------------------------------------------------------------------------------------------

const BODY = 0.033 // text size, fraction of page height
const HEAD = 0.042
const TITLE = 0.066
const INDENT = 0.06 // first-line indent, fraction of page width
const ON_RULE = 0.009 // baseline sits this far above its ruled line

/** Baselines of the ruled lines that carry text. */
const ROWS: number[] = []
for (let y = RULES.first + RULES.spacing; y < RULES.last + 1e-6; y += RULES.spacing) ROWS.push(y - ON_RULE)

/** Greedy word wrap with the page's real font. */
function wrap(g: CanvasRenderingContext2D, text: string, width: (first: boolean) => number) {
  const lines: string[] = []
  let line = ''
  for (const w of text.split(/\s+/)) {
    const trial = line ? `${line} ${w}` : w
    if (g.measureText(trial).width > width(lines.length === 0) && line) {
      lines.push(line)
      line = w
    } else line = trial
  }
  if (line) lines.push(line)
  return lines
}

const num = (n: number, lang: Lang) => n.toLocaleString(UI[lang].locale)

function titlePage(lang: Lang, g: CanvasRenderingContext2D, title: string, n: number): Line[] {
  const ui = UI[lang]
  g.font = `700 ${Math.round(TITLE * PAGE_PX.h)}px ${ui.font}`
  const rows = wrap(g, title, () => 0.8 * PAGE_PX.w).slice(0, 4)
  return [
    { text: ui.essay(num(n, lang)), y: 0.2, size: 0.034, weight: 400, color: MUTED, font: ui.font },
    ...rows.map((text, i): Line => ({ text, y: 0.3 + i * 0.085, size: TITLE, weight: 700, color: INK, font: ui.font })),
  ]
}

function epigraphPage(lang: Lang): Line[] {
  const ui = UI[lang]
  const top = 0.4
  return [
    ...ui.epigraph.map((text, i): Line => ({ text, y: top + i * 0.06, size: 0.046, weight: 400, color: INK, font: ui.font })),
    { text: ui.epigraphBy, y: top + ui.epigraph.length * 0.06 + 0.02, size: 0.03, weight: 400, color: MUTED, font: ui.font },
  ]
}

/**
 * Article titles on the ruled lines, with the page each one opens on at the far margin; runs onto more pages
 * when there are many articles. (`starts` only changes the numbers, never how many pages this takes.)
 */
function contentsPages(lang: Lang, g: CanvasRenderingContext2D, starts: number[]): Line[][] {
  const ui = UI[lang]
  const rtl = ui.dir === 'rtl'
  const near = { align: rtl ? 'right' : 'left', x: rtl ? TEXT_BOX.right : TEXT_BOX.left } as const
  const far = { align: rtl ? 'left' : 'right', x: rtl ? TEXT_BOX.left : TEXT_BOX.right } as const
  const size = BODY * 1.12
  const pages: Line[][] = [[{ text: ui.contents, y: 0.2, size: 0.05, weight: 700, color: INK, font: ui.font }]]
  let row = 3
  if (!library.list().length) pages[0].push({ text: ui.noArticles, y: ROWS[row], size, weight: 400, color: MUTED, font: ui.font })
  g.font = `400 ${Math.round(size * PAGE_PX.h)}px ${ui.font}`
  library.list().forEach((a, n) => {
    const rows = wrap(g, `${num(n + 1, lang)}. ${fieldsFor(a, lang).title}`, () => 0.64 * PAGE_PX.w)
    if (row + rows.length > ROWS.length) { pages.push([]); row = 0 }
    const lines = pages[pages.length - 1]
    rows.forEach((text, i) => lines.push({ text, y: ROWS[row + i], size, weight: 400, color: INK, font: ui.font, ...near }))
    lines.push({ text: num((starts[n] ?? 0) + 1, lang), y: ROWS[row + rows.length - 1], size, weight: 400, color: MUTED, font: ui.font, ...far })
    row += rows.length + 1
  })
  return pages
}

/** Flows one article body onto ruled pages. */
function paginate(lang: Lang, g: CanvasRenderingContext2D, content: string): Line[][] {
  const ui = UI[lang]
  const rtl = ui.dir === 'rtl'
  const W = PAGE_PX.w, H = PAGE_PX.h
  const width = (TEXT_BOX.right - TEXT_BOX.left) * W
  const pages: Line[][] = []
  let page: Line[] = []
  let row = 0
  const newPage = () => { pages.push(page); page = []; row = 0 }
  const put = (text: string, size: number, weight: 400 | 700, indent = 0) => {
    if (row >= ROWS.length) newPage()
    page.push({
      text, y: ROWS[row++], size, weight, color: INK, font: ui.font,
      align: rtl ? 'right' : 'left',
      x: rtl ? TEXT_BOX.right - indent : TEXT_BOX.left + indent,
    })
  }

  for (const b of parseContent(content)) {
    if (b.type === 'h') {
      if (row > 0) row++ // breathing room above a heading
      if (row >= ROWS.length - 2) newPage() // never strand a heading at the foot of a page
      put(b.text, HEAD, 700)
      continue
    }
    g.font = `400 ${Math.round(BODY * H)}px ${ui.font}`
    wrap(g, b.text, (first) => width - (first ? INDENT * W : 0)).forEach((l, i) => put(l, BODY, 400, i === 0 ? INDENT : 0))
  }
  if (page.length) pages.push(page)
  return pages
}

/** Page number at the foot. */
const folio = (n: number, lang: Lang): Line => ({
  text: num(n, lang), y: 0.965, size: 0.024, weight: 400, color: MUTED, font: UI[lang].font,
})

type Page = { lines: Line[]; article: number | null; title?: boolean }

/** Every page of the notebook, laid out in the chosen language (only that language's fields are read). */
function build(lang: Lang): { pages: Page[]; starts: number[] } {
  const g = document.createElement('canvas').getContext('2d')!
  const articles = library.list()
  const contents = contentsPages(lang, g, []).length // how many pages the contents need
  const out: Page[] = [{ lines: epigraphPage(lang), article: null }]
  for (let i = 0; i < contents; i++) out.push({ lines: [], article: null })
  const starts: number[] = []
  articles.forEach((a, n) => {
    if (out.length % 2) out.push({ lines: [], article: null }) // open on a fresh spread
    starts.push(out.length)
    const { title, content } = fieldsFor(a, lang)
    out.push({ lines: titlePage(lang, g, title, n + 1), article: n, title: true })
    for (const lines of paginate(lang, g, content)) out.push({ lines, article: n })
  })
  if (out.length % 2) out.push({ lines: [], article: null })
  contentsPages(lang, g, starts).forEach((lines, i) => { out[1 + i].lines = lines })
  out.forEach((p, i) => { if (i > 0) p.lines.push(folio(i + 1, lang)) })
  return { pages: out, starts }
}

// ---- Store --------------------------------------------------------------------------------------------------

type Flip = { dir: 1 | -1; from: number; quick: boolean } // dir 1 = forward in reading order
type State = {
  lang: Lang; spread: number; spreads: number; flip: Flip | null; ready: boolean
  version: number // bumped when a language is laid out
  repaint: number // bumped when pages of the open spread were repainted (search highlight)
}

let pages: Page[] = []
let starts: number[] = []
let target: number | null = null // spread we are flipping towards (search)
let highlight: { page: number; query: string } | null = null
let state: State = { lang: 'ar', spread: 0, spreads: 1, flip: null, ready: false, version: 0, repaint: 0 }
const listeners = new Set<() => void>()
const set = (s: Partial<State>) => {
  state = { ...state, ...s }
  listeners.forEach((l) => l())
}

/** Lays the chosen language out (after its typeface has loaded, so measurements are right), opening at `spread`. */
async function load(lang: Lang, spread = 0) {
  await document.fonts?.load(UI[lang].fontLoad).catch(() => undefined)
  await document.fonts?.load(UI[lang].fontLoad.replace('400', '700')).catch(() => undefined)
  if (language.current && language.current !== lang) return // the reader picked another language meanwhile
  ;({ pages, starts } = build(lang))
  target = null
  highlight = null
  for (const t of cache.values()) t.dispose()
  cache.clear()
  const spreads = Math.ceil(pages.length / 2)
  set({ lang, spread: Math.min(spread, spreads - 1), spreads, flip: null, ready: true, version: state.version + 1 })
}

load('ar') // what sits on the desk behind the language dialog
language.subscribe(() => { if (language.current) load(language.current) })
// The article list changed (published articles arrived, or one was just published): lay the notebook out
// again where the reader was, and turn to a newly published article if the notebook is open on the desk.
library.subscribe(async () => {
  if (!state.ready) return // the first layout has not happened yet and will include them
  const added = library.lastAdded
  library.lastAdded = null
  await load(state.lang, added ? 0 : state.spread)
  const i = library.list().findIndex((a) => a.id === added)
  if (i >= 0 && scroll.progress > TIMELINE.land - 0.02) book.goTo(starts[i])
})

/** Starts the next page turn towards `target`, quickly while several pages remain. */
function stepToTarget() {
  if (target === null || target === state.spread) { target = null; return }
  const dir = target > state.spread ? 1 : -1
  set({ flip: { dir, from: state.spread, quick: Math.abs(target - state.spread) > 1 } })
}

function setHighlight(h: typeof highlight) {
  const touched = [highlight?.page, h?.page].filter((p): p is number => p !== undefined)
  highlight = h
  for (const p of touched) {
    cache.get(p)?.dispose()
    cache.delete(p)
  }
  if (touched.some((p) => Math.floor(p / 2) === state.spread)) set({ repaint: state.repaint + 1 })
}

export type SearchHit = { article: number; title: string; page: number; isTitle: boolean; before: string; match: string; after: string }

export const book = {
  get state() { return state },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
  next() {
    target = null
    if (state.ready && !state.flip && state.spread < state.spreads - 1) set({ flip: { dir: 1, from: state.spread, quick: false } })
  },
  prev() {
    target = null
    if (state.ready && !state.flip && state.spread > 0) set({ flip: { dir: -1, from: state.spread, quick: false } })
  },
  /** Called by the notebook when the turning page has landed. */
  finishFlip() {
    if (!state.flip) return
    set({ spread: state.flip.from + state.flip.dir, flip: null })
    stepToTarget()
  },
  /** Turns the pages, one after another, until `page` is open; marks `query` on it. */
  goTo(page: number, query?: string) {
    if (!state.ready) return
    setHighlight(query ? { page, query } : null)
    target = Math.max(0, Math.min(state.spreads - 1, Math.floor(page / 2)))
    if (!state.flip) stepToTarget()
  },
  clearHighlight() { setHighlight(null) },
  /** Articles whose title or text (in the chosen language only) contains `query`; titles first. */
  search(query: string, limit = 8): SearchHit[] {
    if (!state.ready || !query.trim()) return []
    const lang = state.lang
    const titles: SearchHit[] = []
    const body: SearchHit[] = []
    library.list().forEach((a, n) => {
      const title = fieldsFor(a, lang).title
      const t = findIn(title, query, lang)
      if (t) titles.push({ article: n, title, page: starts[n], isTitle: true, ...excerpt(title, t, 80) })
    })
    pages.forEach((p, i) => {
      if (p.article === null || p.title) return
      const text = p.lines.slice(0, -1).map((l) => l.text).join(' ') // without the folio
      const m = findIn(text, query, lang)
      if (m) body.push({ article: p.article, title: fieldsFor(library.list()[p.article], lang).title, page: i, isTitle: false, ...excerpt(text, m) })
    })
    return [...titles, ...body].slice(0, limit)
  },
  get dir() { return UI[state.lang].dir },
  /** Index of the page lying on `side` when spread `k` is open. */
  pageOn(side: Side, k: number) {
    const rtl = UI[state.lang].dir === 'rtl'
    return (side === 'right') === rtl ? 2 * k : 2 * k + 1
  },
  /** Which side the turning sheet lifts from when going forward (dir 1) or back (dir -1). */
  liftSide(dir: 1 | -1): Side {
    const forwardFromLeft = UI[state.lang].dir === 'rtl'
    return (dir === 1) === forwardFromLeft ? 'left' : 'right'
  },
}

export const useBook = () => useSyncExternalStore(book.subscribe, () => book.state)

// ---- Page textures --------------------------------------------------------------------------------------

const cache = new Map<number, THREE.CanvasTexture>()

/** The page's lines, with the searched words marked where they fall within a single line. */
function linesOf(i: number): Line[] {
  const lines = pages[i]?.lines ?? []
  if (highlight?.page !== i) return lines
  const q = highlight.query
  return lines.map((l) => {
    const m = findIn(l.text, q, state.lang)
    return m ? { ...l, mark: m } : l
  })
}

/** Texture for page i (a blank ruled page past the end of the text), created on demand. */
export function pageTexture(i: number, anisotropy: number) {
  let t = cache.get(i)
  if (!t) {
    t = new THREE.CanvasTexture(document.createElement('canvas'))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = anisotropy
    // a page on the right has the gutter on its left edge, and vice versa
    const onRight = book.pageOn('right', Math.floor(i / 2)) === i
    paintPage(t.image as HTMLCanvasElement, linesOf(i), onRight ? 'left' : 'right', UI[state.lang].dir)
    t.needsUpdate = true
    cache.set(i, t)
  }
  return t
}

/** Frees every cached page except the ones listed (page textures are large). */
export function keepPages(keep: number[]) {
  for (const [i, t] of cache) {
    if (!keep.includes(i)) {
      t.dispose()
      cache.delete(i)
    }
  }
}
