-- Timeout: cloud sync tables. Run once in a Supabase project (SQL editor or migration).

create table public.timeout_plays (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  rev bigint not null,                       -- client timestamp (ms) of the last change; newest wins
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint timeout_plays_size check (pg_column_size(data) < 300000)
);
create index timeout_plays_user_idx on public.timeout_plays (user_id);
alter table public.timeout_plays enable row level security;
create policy "own plays: read"   on public.timeout_plays for select to authenticated using ((select auth.uid()) = user_id);
create policy "own plays: insert" on public.timeout_plays for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own plays: update" on public.timeout_plays for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own plays: delete" on public.timeout_plays for delete to authenticated using ((select auth.uid()) = user_id);

-- Plays shared by short link. Only the owner can list their shares;
-- everyone else can fetch one share at a time, and only if they know its id.
create table public.timeout_shares (
  id text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  constraint timeout_shares_size check (pg_column_size(data) < 300000)
);
create index timeout_shares_user_idx on public.timeout_shares (user_id);
alter table public.timeout_shares enable row level security;
create policy "own shares: read"   on public.timeout_shares for select to authenticated using ((select auth.uid()) = user_id);
create policy "own shares: insert" on public.timeout_shares for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own shares: delete" on public.timeout_shares for delete to authenticated using ((select auth.uid()) = user_id);

create function public.timeout_get_share(share_id text) returns jsonb
  language sql stable security definer set search_path = ''
  as $$ select data from public.timeout_shares where id = share_id $$;
revoke all on function public.timeout_get_share(text) from public;
grant execute on function public.timeout_get_share(text) to anon, authenticated;
