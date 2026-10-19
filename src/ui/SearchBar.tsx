import { useEffect, useId, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { book, useBook, type SearchHit } from '../scene/book'
import { UI, type Lang } from '../scene/i18n'

/**
 * Floating search over the open notebook. Results update as you type (only the chosen language's text is
 * searched); picking one riffles the pages over to it and marks the words on the page.
 */
export function SearchBar({ visible, lang }: { visible: boolean; lang: Lang }) {
  const ui = UI[lang]
  const { ready } = useBook() // re-renders when a language is laid out, so results follow the new pages
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()
  const hits = ready ? book.search(query) : []
  const n = (x: number) => x.toLocaleString(ui.locale)

  // click outside closes the list
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    addEventListener('pointerdown', away)
    return () => removeEventListener('pointerdown', away)
  }, [open])

  const go = (h: SearchHit | undefined) => {
    if (!h) return
    book.goTo(h.page, query)
    setOpen(false)
    input.current?.blur()
  }
  const clear = () => {
    setQuery('')
    setActive(0)
    book.clearHighlight()
    input.current?.focus()
  }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[active]) }
    else if (e.key === 'Escape') { if (query) clear(); else input.current?.blur(); setOpen(false) }
  }

  const showList = open && query.trim().length > 0
  return (
    <div ref={box} className={`search${visible ? ' show' : ''}`} dir={ui.dir} lang={lang} aria-hidden={!visible}>
      <label className="search-field">
        <Search size={17} strokeWidth={1.9} aria-hidden />
        <input
          ref={input}
          type="search"
          value={query}
          placeholder={ui.searchPlaceholder}
          aria-label={ui.searchLabel}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
          tabIndex={visible ? 0 : -1}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); if (!e.target.value) book.clearHighlight() }}
          onFocus={() => setOpen(true)}
          onKeyDown={key}
        />
        {query && (
          <button className="search-clear" onClick={clear} aria-label={ui.clearSearch} tabIndex={visible ? 0 : -1}>
            <X size={15} strokeWidth={2} />
          </button>
        )}
      </label>
      {showList && (
        <ul className="search-results" id={listId} role="listbox">
          {hits.length === 0 && <li className="search-empty">{ui.noResults}</li>}
          {hits.map((h, i) => (
            <li
              key={`${h.page}-${h.isTitle}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(e) => { e.preventDefault(); go(h) }}
            >
              <span className="hit-head">
                <span className="hit-title">{h.isTitle ? <Marked {...h} /> : h.title}</span>
                <span className="hit-page">{ui.page(n(h.page + 1))}</span>
              </span>
              {!h.isTitle && <span className="hit-text"><Marked {...h} /></span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const Marked = ({ before, match, after }: { before: string; match: string; after: string }) => (
  <>{before}<mark>{match}</mark>{after}</>
)
