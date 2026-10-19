# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The maintainer writes in Arabic — reply in Arabic. Code, comments, and this file stay in English.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npx oxlint src     # lint (a few react-compiler warnings from R3F are expected)
```

## Rules that matter

- **No automatic translation, ever.** Each article has `title_ar`, `content_ar`, `title_tr`, `content_tr`,
  written by hand. The chosen language loads only its own fields.
- **The admin passcode never appears in the code.** Publishing goes through the `publish_article()` database
  function (`supabase/schema.sql`). Only the public anon / publishable key is used in the browser; never
  put a `service_role` key in a `VITE_` variable.
- **Only a direct click on the gramophone mesh toggles the music.** Keep every other canvas interaction.
- Sizes and camera poses live in `src/scene/layout.ts`; change them there, not inline.
- Keys live in `.env.local` (gitignored); `.env.example` documents them.
