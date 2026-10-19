import { createClient } from '@supabase/supabase-js'

// Supabase connection, from .env.local (see .env.example). Without it the site still works and shows only the
// articles written into src/scene/content.ts.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
