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

-- ============================================================================
-- Playbooks, roles and invites (added after the first version)
-- Roles on a playbook: owner (full control), admin (edit plays + manage people),
-- editor (create and edit plays), viewer (view only).
-- ============================================================================
create schema if not exists timeout_private;
grant usage on schema timeout_private to authenticated;

create table public.timeout_playbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index timeout_playbooks_owner_idx on public.timeout_playbooks (owner_id);

create table public.timeout_playbook_members (
  playbook_id uuid not null references public.timeout_playbooks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (playbook_id, user_id)
);
create index timeout_playbook_members_user_idx on public.timeout_playbook_members (user_id);

create table public.timeout_invites (
  playbook_id uuid not null references public.timeout_playbooks (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (playbook_id, email)
);

alter table public.timeout_plays add column playbook_id uuid not null references public.timeout_playbooks (id) on delete cascade;
create index timeout_plays_playbook_idx on public.timeout_plays (playbook_id);

create function timeout_private.is_owner(pb uuid) returns boolean language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.timeout_playbooks where id = pb and owner_id = auth.uid()) $$;
create function timeout_private.is_member(pb uuid) returns boolean language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.timeout_playbook_members where playbook_id = pb and user_id = auth.uid()) $$;
create function timeout_private.can_edit(pb uuid) returns boolean language sql stable security definer set search_path = ''
  as $$ select timeout_private.is_owner(pb) or exists (select 1 from public.timeout_playbook_members where playbook_id = pb and user_id = auth.uid() and role in ('admin', 'editor')) $$;
create function timeout_private.can_manage(pb uuid) returns boolean language sql stable security definer set search_path = ''
  as $$ select timeout_private.is_owner(pb) or exists (select 1 from public.timeout_playbook_members where playbook_id = pb and user_id = auth.uid() and role = 'admin') $$;
revoke all on all functions in schema timeout_private from public, anon;
grant execute on all functions in schema timeout_private to authenticated;

alter table public.timeout_playbooks enable row level security;
create policy "playbooks: read"   on public.timeout_playbooks for select to authenticated using (owner_id = (select auth.uid()) or timeout_private.is_member(id));
create policy "playbooks: insert" on public.timeout_playbooks for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "playbooks: update" on public.timeout_playbooks for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "playbooks: delete" on public.timeout_playbooks for delete to authenticated using (owner_id = (select auth.uid()));

alter table public.timeout_playbook_members enable row level security;
create policy "members: read"   on public.timeout_playbook_members for select to authenticated using (user_id = (select auth.uid()) or timeout_private.is_owner(playbook_id) or timeout_private.is_member(playbook_id));
create policy "members: insert" on public.timeout_playbook_members for insert to authenticated with check (timeout_private.can_manage(playbook_id) and user_id <> (select auth.uid()));
create policy "members: update" on public.timeout_playbook_members for update to authenticated using (timeout_private.can_manage(playbook_id) and user_id <> (select auth.uid())) with check (timeout_private.can_manage(playbook_id));
create policy "members: delete" on public.timeout_playbook_members for delete to authenticated using (timeout_private.can_manage(playbook_id) or user_id = (select auth.uid()));

alter table public.timeout_invites enable row level security;
create policy "invites: read"   on public.timeout_invites for select to authenticated using (timeout_private.can_manage(playbook_id));
create policy "invites: update" on public.timeout_invites for update to authenticated using (timeout_private.can_manage(playbook_id)) with check (timeout_private.can_manage(playbook_id));
create policy "invites: delete" on public.timeout_invites for delete to authenticated using (timeout_private.can_manage(playbook_id));

-- Plays are now reached through their playbook instead of their creator.
drop policy "own plays: read" on public.timeout_plays;
drop policy "own plays: insert" on public.timeout_plays;
drop policy "own plays: update" on public.timeout_plays;
drop policy "own plays: delete" on public.timeout_plays;
create policy "plays: read"   on public.timeout_plays for select to authenticated using (timeout_private.is_owner(playbook_id) or timeout_private.is_member(playbook_id));
create policy "plays: insert" on public.timeout_plays for insert to authenticated with check (timeout_private.can_edit(playbook_id));
create policy "plays: update" on public.timeout_plays for update to authenticated using (timeout_private.can_edit(playbook_id)) with check (timeout_private.can_edit(playbook_id));
create policy "plays: delete" on public.timeout_plays for delete to authenticated using (timeout_private.can_edit(playbook_id));

-- Also in the database (see the Supabase migrations for the full text):
--   public.timeout_playbook_people(pb)            names and roles of everyone on a playbook you can see
--   public.timeout_add_person(pb, who, new_role)  add by username or email, or invite an email with no account
--   public.timeout_accept_invites()               turn invites for my confirmed email into memberships
