// Articles, written by hand in each language. Nothing here is ever translated at runtime: the reader picks a
// language in the opening dialog and the notebook shows only that language's fields.
//
// Content format: paragraphs separated by a blank line; a line starting with "## " is a subheading.
// The notebook holds every article in order, after a contents page; each one opens on a fresh spread.
// Articles come from Supabase (see library.ts); ARTICLES is for any you want built into the site itself.

export type Article = {
  id: string
  title_ar: string
  content_ar: string
  title_tr: string
  content_tr: string
}

export const ARTICLES: Article[] = []

/** The article's title and body in the chosen language: the only place the language picks fields. */
export const fieldsFor = (a: Article, lang: 'ar' | 'tr') =>
  lang === 'ar' ? { title: a.title_ar, content: a.content_ar } : { title: a.title_tr, content: a.content_tr }

export type Block = { type: 'h' | 'p'; text: string }

/** Splits a content string into subheadings and paragraphs. */
export function parseContent(content: string): Block[] {
  return content
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim().replace(/\s*\n\s*/g, ' '))
    .filter(Boolean)
    .map((chunk): Block => (chunk.startsWith('## ') ? { type: 'h', text: chunk.slice(3).trim() } : { type: 'p', text: chunk }))
}
