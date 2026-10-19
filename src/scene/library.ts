import { ARTICLES, type Article } from './content'
import { supabase } from '../lib/supabase'

// Every article the notebook shows: the ones published to the Supabase `articles` table (newest first), then
// the ones written into content.ts. Publishing goes through the database's publish_article() function, which
// checks the passcode server-side (see supabase/schema.sql).

const isArticle = (a: unknown): a is Article =>
  !!a && typeof a === 'object' &&
  (['id', 'title_ar', 'content_ar', 'title_tr', 'content_tr'] as const).every((k) => typeof (a as Record<string, unknown>)[k] === 'string')

const toArticle = ({ id, title_ar, content_ar, title_tr, content_tr }: Article): Article => ({ id, title_ar, content_ar, title_tr, content_tr })

let remote: Article[] = []
let list: Article[] = ARTICLES
const listeners = new Set<() => void>()
const changed = () => {
  list = [...remote, ...ARTICLES]
  listeners.forEach((fn) => fn())
}

export type PublishResult = 'ok' | 'invalid_passcode' | 'too_many_attempts' | 'not_configured' | 'network'

export const library = {
  list: () => list,
  /** Whether a database is configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). */
  online: !!supabase,
  /** Id of an article just published here; the notebook turns to it, then clears this. */
  lastAdded: null as string | null,

  /** Loads the published articles. Failing leaves the built-in ones in place. */
  async refresh() {
    if (!supabase) return
    const { data, error } = await supabase
      .from('articles')
      .select('id, title_ar, content_ar, title_tr, content_tr')
      .order('created_at', { ascending: false })
    if (error) {
      console.warn('[articles] could not load from Supabase:', error.message)
      return
    }
    remote = (data ?? []).filter(isArticle).map(toArticle)
    changed()
  },

  /** Publishes an article for every visitor; the passcode is checked by the database, not here. */
  async publish(fields: Omit<Article, 'id'>, passcode: string): Promise<PublishResult> {
    if (!supabase) return 'not_configured'
    const { data, error } = await supabase.rpc('publish_article', {
      p_passcode: passcode,
      p_title_ar: fields.title_ar,
      p_content_ar: fields.content_ar,
      p_title_tr: fields.title_tr,
      p_content_tr: fields.content_tr,
    })
    if (error || !data) {
      console.warn('[articles] publish failed:', error?.message)
      return 'network'
    }
    const res = data as { ok: boolean; error?: PublishResult; article?: unknown }
    if (!res.ok || !isArticle(res.article)) return res.error ?? 'network'
    const article = toArticle(res.article)
    remote = [article, ...remote.filter((a) => a.id !== article.id)]
    library.lastAdded = article.id
    changed()
    return 'ok'
  },

  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
}

library.refresh()
