import { useEffect, useRef, useState } from 'react'
import { MessageSquareText, X } from 'lucide-react'
import { UI, type Lang } from '../scene/i18n'

const INSTAGRAM = { handle: '0bf.c', url: 'https://www.instagram.com/0bf.c/', dm: 'https://ig.me/m/0bf.c' }

/** Instagram's glyph (lucide no longer ships brand icons). */
const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)

/**
 * The writer's Instagram link and a "suggest a topic" button. Hovering the suggestion button shows its label;
 * clicking opens a small note: the suggestion is copied and the writer's Instagram messages open, to paste it.
 */
export function SocialDock({ lang }: { lang: Lang }) {
  const ui = UI[lang]
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    area.current?.focus()
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('pointerdown', away)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', away)
      removeEventListener('keydown', esc)
    }
  }, [open])

  const send = async () => {
    const t = text.trim()
    if (t) {
      try { await navigator.clipboard.writeText(t); setCopied(true) } catch { setCopied(false) }
    }
    window.open(INSTAGRAM.dm, '_blank', 'noopener')
  }

  return (
    <div ref={root} className="social" dir={ui.dir} lang={lang}>
      <a className="social-btn" href={INSTAGRAM.url} target="_blank" rel="noopener noreferrer" aria-label={ui.instagram} data-tip={ui.instagram}>
        <InstagramIcon />
      </a>
      <button
        className={`social-btn${open ? ' on' : ''}`}
        onClick={() => { setOpen((o) => !o); setCopied(false) }}
        aria-label={ui.suggest}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tip={open ? undefined : ui.suggest}
      >
        <MessageSquareText size={18} strokeWidth={1.8} />
      </button>
      {open && (
        <div className="suggest" role="dialog" aria-label={ui.suggest}>
          <div className="suggest-head">
            <p>{ui.suggest}</p>
            <button onClick={() => setOpen(false)} aria-label={ui.close}><X size={15} strokeWidth={2} /></button>
          </div>
          <textarea ref={area} rows={3} value={text} placeholder={ui.suggestPlaceholder} onChange={(e) => { setText(e.target.value); setCopied(false) }} />
          <button className="suggest-send" onClick={send}>{ui.suggestSend}</button>
          <p className="suggest-note">{copied ? '✓ ' : ''}{ui.suggestNote}</p>
        </div>
      )}
    </div>
  )
}
