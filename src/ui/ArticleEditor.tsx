import { useCallback, useEffect, useRef, useState } from 'react'
import { NotebookPen, X } from 'lucide-react'
import { UI, type Lang } from '../scene/i18n'
import { library } from '../scene/library'

const EMPTY = { title_ar: '', content_ar: '', title_tr: '', content_tr: '' }

/** Small button at the bottom-right that opens the article editor. */
export function ArticleEditor({ lang }: { lang: Lang }) {
  const t = UI[lang].editor
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button className="social-btn editor-btn" onClick={() => setOpen(true)} aria-label={t.open} data-tip={t.open} aria-haspopup="dialog">
        <NotebookPen size={18} strokeWidth={1.8} />
      </button>
      {open && <EditorModal lang={lang} onClose={close} />}
    </>
  )
}

function EditorModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const ui = UI[lang]
  const t = ui.editor
  const [form, setForm] = useState(EMPTY)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // write in the language you chose first; keep the page behind still
    first.current?.focus()
    document.documentElement.classList.add('modal-open')
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', esc)
    return () => {
      document.documentElement.classList.remove('modal-open')
      removeEventListener('keydown', esc)
    }
  }, [onClose])

  const fail = (msg: string) => { setError(msg); setShake((s) => s + 1) }
  // the passcode is checked by the database (supabase/schema.sql), never in this code
  const publish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const fields = {
      title_ar: form.title_ar.trim(), content_ar: form.content_ar.trim(),
      title_tr: form.title_tr.trim(), content_tr: form.content_tr.trim(),
    }
    if (Object.values(fields).some((v) => !v)) return fail(t.missing)
    if (!code) return fail(t.wrong)
    setBusy(true)
    const result = await library.publish(fields, code)
    setBusy(false)
    if (result === 'ok') return onClose()
    if (result === 'invalid_passcode') setCode('')
    fail({ invalid_passcode: t.wrong, too_many_attempts: t.tooMany, not_configured: t.notConfigured, network: t.network }[result])
  }

  const field = (k: keyof typeof EMPTY) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(null) },
  })
  const section = (l: Lang) => (
    <fieldset key={l} className={`editor-lang ${l}`}>
      <legend>{UI[l].name}</legend>
      <label>
        <span>{t.title}</span>
        <input ref={l === lang ? first : undefined} lang={l} dir={UI[l].dir} {...field(`title_${l}`)} />
      </label>
      <label>
        <span>{t.content}</span>
        <textarea lang={l} dir={UI[l].dir} rows={7} {...field(`content_${l}`)} />
      </label>
    </fieldset>
  )

  return (
    <div className="lang-backdrop editor-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form key={shake} className={`editor${shake ? ' shake' : ''}`} dir={ui.dir} lang={lang} role="dialog" aria-modal="true" aria-labelledby="editor-title" onSubmit={publish}>
        <div className="editor-head">
          <h2 id="editor-title">{t.open}</h2>
          <button type="button" onClick={onClose} aria-label={ui.close}><X size={16} strokeWidth={2} /></button>
        </div>
        <div className="editor-langs">
          {/* the chosen language's fields come first */}
          {(lang === 'ar' ? (['ar', 'tr'] as const) : (['tr', 'ar'] as const)).map(section)}
        </div>
        <p className="editor-hint">{t.hint}</p>
        <div className="editor-foot">
          <label className="editor-code">
            <span>{t.passcode}</span>
            <input type="password" inputMode="numeric" autoComplete="off" dir="ltr" value={code} onChange={(e) => { setCode(e.target.value); setError(null) }} />
          </label>
          <div className="editor-actions">
            <button type="button" className="editor-cancel" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="suggest-send" disabled={busy}>{busy ? t.publishing : t.publish}</button>
          </div>
        </div>
        <p className={`editor-note${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>{error ?? (library.online ? t.publicNote : t.notConfigured)}</p>
      </form>
    </div>
  )
}
