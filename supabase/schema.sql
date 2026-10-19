-- Notebook articles on Supabase. Run once in the dashboard: SQL Editor → New query → paste → Run.
--
-- Anyone can read articles. Nobody can write to the table directly with the public (anon) key: the only way
-- in is publish_article(), which checks the admin passcode against a bcrypt hash kept in a schema the API
-- never exposes. The passcode itself never appears in the site's code.

create extension if not exists pgcrypto with schema extensions;

-- ---- Articles --------------------------------------------------------------------------------------------

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null check (length(btrim(title_ar)) > 0),
  content_ar text not null check (length(btrim(content_ar)) > 0),
  title_tr text not null check (length(btrim(title_tr)) > 0),
  content_tr text not null check (length(btrim(content_tr)) > 0),
  created_at timestamptz not null default now()
);

alter table public.articles enable row level security;

drop policy if exists "Articles are public" on public.articles;
create policy "Articles are public" on public.articles for select to anon, authenticated using (true);
-- no insert / update / delete policies: with row level security on, the anon key cannot write

-- ---- Admin passcode (private: not reachable through the API) ---------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.admin (
  only_row boolean primary key default true check (only_row),
  passcode_hash text not null
);

-- failed tries, to slow down guessing (a 4-digit code has only 10,000 possibilities)
create table if not exists private.failed_attempts (at timestamptz not null default now());

-- ---- Publishing -------------------------------------------------------------------------------------------

-- Returns {"ok": true, "article": {...}} or {"ok": false, "error": "invalid_passcode" | "too_many_attempts"}.
-- It reports failures in its result instead of raising, so the failed attempt it records is kept.
create or replace function public.publish_article(
  p_passcode text, p_title_ar text, p_content_ar text, p_title_tr text, p_content_tr text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored text;
  created public.articles;
begin
  delete from private.failed_attempts where at < now() - interval '1 day';
  -- at most 5 wrong passcodes per hour, from anyone
  if (select count(*) from private.failed_attempts where at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select passcode_hash into stored from private.admin;
  if stored is null or extensions.crypt(coalesce(p_passcode, ''), stored) <> stored then
    insert into private.failed_attempts default values;
    return jsonb_build_object('ok', false, 'error', 'invalid_passcode');
  end if;

  insert into public.articles (title_ar, content_ar, title_tr, content_tr)
  values (btrim(p_title_ar), btrim(p_content_ar), btrim(p_title_tr), btrim(p_content_tr))
  returning * into created;
  return jsonb_build_object('ok', true, 'article', to_jsonb(created));
end;
$$;

revoke all on function public.publish_article(text, text, text, text, text) from public;
grant execute on function public.publish_article(text, text, text, text, text) to anon, authenticated;

-- ---- Set (or change) the passcode -------------------------------------------------------------------------
-- Replace CHANGE-ME with your passcode before running, and don't save the real one back into this file.

insert into private.admin (passcode_hash)
values (extensions.crypt('CHANGE-ME', extensions.gen_salt('bf')))
on conflict (only_row) do update set passcode_hash = excluded.passcode_hash;
