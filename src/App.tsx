import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Languages, Moon, Sun } from 'lucide-react'
import { bindScrollTrack, onScroll } from './scene/scroll'
import { book, useBook } from './scene/book'
import { UI, language, useLanguage, type Lang } from './scene/i18n'
import { TIMELINE, clamp01, smoothstep, type Mode } from './scene/layout'
import { SearchBar } from './ui/SearchBar'
import { SocialDock } from './ui/SocialDock'
import { ArticleEditor } from './ui/ArticleEditor'

const Experience = lazy(() => import('./scene/Experience'))

/** Opening dialog: the reader picks the language; the notebook then shows only that language's fields. */
function LanguageDialog() {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => { first.current?.focus() }, [])
  const pick = (l: Lang) => language.set(l)
  return (
    <div className="lang-backdrop">
      <div className="lang-dialog" role="dialog" aria-modal="true" aria-labelledby="lang-title">
        <p id="lang-title" className="lang-title">
          <span dir="rtl" lang="ar">اختر لغة القراءة</span>
          <span lang="tr">Okuma dilini seçin</span>
        </p>
        <div className="lang-choices">
          <button ref={first} lang="ar" dir="rtl" className="ar" onClick={() => pick('ar')}>{UI.ar.name}</button>
          <button lang="tr" className="tr" onClick={() => pick('tr')}>{UI.tr.name}</button>
        </div>
      </div>
    </div>
  )
}

/** Page-turn controls, shown once the camera has landed on the spread. "Next" sits on the reading side. */
function PageNav({ visible, lang }: { visible: boolean; lang: Lang }) {
  const ui = UI[lang]
  const { spread, spreads, flip, ready } = useBook()
  const n = (x: number) => x.toLocaleString(ui.locale)
  const rtl = ui.dir === 'rtl'
  const Back = rtl ? ChevronRight : ChevronLeft
  const Fwd = rtl ? ChevronLeft : ChevronRight
  return (
    <nav className={`page-nav${visible ? ' show' : ''}`} dir={ui.dir} lang={lang} aria-label={ui.pageNav} aria-hidden={!visible}>
      <button onClick={() => book.prev()} disabled={!visible || spread === 0 || !!flip} aria-label={ui.prevLabel}>
        <Back size={20} strokeWidth={1.8} />
        <span>{ui.prev}</span>
      </button>
      <span className={`folio ${lang}`}>{ready ? ui.pagesOf(n(2 * spread + 1), n(2 * spread + 2), n(spreads * 2)) : '…'}</span>
      <button onClick={() => book.next()} disabled={!visible || spread >= spreads - 1 || !!flip} aria-label={ui.nextLabel}>
        <span>{ui.next}</span>
        <Fwd size={20} strokeWidth={1.8} />
      </button>
    </nav>
  )
}

export default function App() {
  const track = useRef<HTMLDivElement>(null)
  const vignette = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLDivElement>(null)
  const debug = useRef<HTMLPreElement>(null)
  const chosen = useLanguage()
  const lang: Lang = chosen ?? 'ar'
  const ui = UI[lang]
  const [mode, setMode] = useState<Mode>('night')
  const [ready, setReady] = useState(false)
  const [landed, setLanded] = useState(false)
  const showDebug = new URLSearchParams(location.search).has('debug')

  useEffect(() => { document.documentElement.dataset.theme = mode }, [mode])
  useEffect(() => (track.current ? bindScrollTrack(track.current) : undefined), [])
  // no scrolling into the scene until a language is chosen
  useEffect(() => {
    document.documentElement.classList.toggle('locked', !chosen)
  }, [chosen])

  // Styles are written directly from the scroll tween — no React re-renders while scrolling.
  useEffect(() => onScroll((p) => {
    if (vignette.current) vignette.current.style.opacity = `${0.55 * smoothstep(0.66, TIMELINE.land, p)}`
    if (hint.current) hint.current.style.opacity = `${1 - clamp01(p * 25)}`
    if (debug.current) debug.current.textContent = `progress ${p.toFixed(3)}${p >= TIMELINE.land ? ' · locked on the spread' : ''}`
    setLanded(p > TIMELINE.land - 0.02)
  }), [])

  // Once landed, reading goes sideways: arrow keys and horizontal swipes turn pages in the reading direction.
  useEffect(() => {
    if (!landed) return
    const rtl = ui.dir === 'rtl'
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    const key = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) book.next()
      if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) book.prev()
    }
    let x0: number | null = null
    // only drags that start on the scene itself (not on the search bar, buttons…)
    const down = (e: PointerEvent) => { x0 = e.target instanceof HTMLCanvasElement ? e.clientX : null }
    const up = (e: PointerEvent) => {
      if (x0 === null) return
      const dx = e.clientX - x0
      x0 = null
      if (Math.abs(dx) < 60) return
      // drag the page you would lift: rightwards in Arabic, leftwards in Turkish
      if ((dx > 0) === rtl) book.next()
      else book.prev()
    }
    addEventListener('keydown', key)
    addEventListener('pointerdown', down)
    addEventListener('pointerup', up)
    return () => {
      removeEventListener('keydown', key)
      removeEventListener('pointerdown', down)
      removeEventListener('pointerup', up)
    }
  }, [landed, ui.dir])

  const next = mode === 'night' ? 'day' : 'night'
  return (
    <>
      <div className="controls">
        {chosen && (
          <button className="mode-toggle" lang={chosen === 'ar' ? 'tr' : 'ar'} onClick={() => language.set(chosen === 'ar' ? 'tr' : 'ar')}>
            <Languages size={17} strokeWidth={1.8} />
            <span>{ui.switchTo}</span>
          </button>
        )}
        <button className="mode-toggle" lang={lang} onClick={() => setMode(next)} aria-label={next === 'day' ? ui.toDay : ui.toNight}>
          {mode === 'night' ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
          <span>{mode === 'night' ? ui.day : ui.night}</span>
        </button>
      </div>
      {chosen && <SocialDock key={`social-${lang}`} lang={lang} />}
      {chosen && <ArticleEditor key={`editor-${lang}`} lang={lang} />}

      {/* The whole page is this track: it ends exactly where the camera lands on the open spread */}
      <div ref={track} className="track">
        <div className="stage">
          <Suspense fallback={null}>
            <Experience mode={mode} onReady={() => setReady(true)} />
          </Suspense>
          <div ref={vignette} className="vignette" />
          <div className={`loading${ready ? ' done' : ''}`} aria-hidden={ready}>{ui.loading}</div>
          {chosen && <div ref={hint} className="scroll-hint" lang={lang}>{ui.scrollHint}</div>}
          <SearchBar key={lang} visible={landed && !!chosen} lang={lang} />
          <PageNav visible={landed && !!chosen} lang={lang} />
          {showDebug && <pre ref={debug} className="debug" />}
        </div>
      </div>
      {!chosen && ready && <LanguageDialog />}
    </>
  )
}
