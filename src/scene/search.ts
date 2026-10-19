import type { Lang } from './i18n'

// Search matching that forgives how people type: Arabic without vowel marks or with a plain alef, Turkish
// without its special letters. The folded text keeps a map back to the original, so a match can be shown
// (and highlighted on the page) exactly where it is.

const AR_DROP = /[ً-ٰٟـ]/ // harakat, superscript alef, tatweel
const AR_FOLD: Record<string, string> = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه' }
const TR_FOLD: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' }
const QUOTES = /[’'‘`]/

export type Folded = { text: string; map: number[] } // map[i] = index in the original of folded char i

export function fold(s: string, lang: Lang): Folded {
  let text = ''
  const map: number[] = []
  const lower = lang === 'tr' ? s.toLocaleLowerCase('tr-TR') : s.toLowerCase()
  // toLocaleLowerCase keeps the length for the Turkish alphabet, so indices still line up with `s`
  const same = lower.length === s.length
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i]
    if (AR_DROP.test(ch) || QUOTES.test(ch)) continue
    const f = AR_FOLD[ch] ?? TR_FOLD[ch] ?? (/\s/.test(ch) ? ' ' : ch)
    if (f === ' ' && text.endsWith(' ')) continue
    text += f
    map.push(same ? i : Math.min(i, s.length - 1))
  }
  return { text, map }
}

/** Where `query` occurs in `s`, as a range of the original string, or null. */
export function findIn(s: string, query: string, lang: Lang): [number, number] | null {
  const q = fold(query, lang).text.trim()
  if (!q) return null
  const f = fold(s, lang)
  const at = f.text.indexOf(q)
  if (at < 0) return null
  return [f.map[at], f.map[at + q.length - 1] + 1]
}

/** A short excerpt around a match, split so the match itself can be marked up. */
export function excerpt(s: string, [a, b]: [number, number], radius = 34) {
  let from = Math.max(0, a - radius)
  let to = Math.min(s.length, b + radius)
  // don't cut words in half
  while (from > 0 && !/\s/.test(s[from - 1])) from--
  while (to < s.length && !/\s/.test(s[to])) to++
  return {
    before: (from > 0 ? '… ' : '') + s.slice(from, a),
    match: s.slice(a, b),
    after: s.slice(b, to) + (to < s.length ? ' …' : ''),
  }
}
