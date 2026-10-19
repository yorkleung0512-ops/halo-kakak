-- Fix invite RPCs: pgcrypto lives in extensions schema; SECURITY DEFINER
-- search_path was public-only so gen_random_bytes/digest failed at runtime.
-- Required for controlled membership creation (E4-15 invitation flow).

create or replace function public.create_household_invite(
  p_household_id uuid,
  p_invited_role text default 'helper',
  p_expires_hours int default 72
)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  raw_token text;
  thash text;
  exp timestamptz;
  iid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_employer_or_owner(p_household_id) then
    raise exception 'forbidden';
  end if;
  if p_invited_role not in ('employer', 'helper') then
    raise exception 'invalid role';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');
  thash := encode(digest(raw_token, 'sha256'), 'hex');
  exp := now() + make_interval(hours => greatest(p_expires_hours, 1));

  insert into public.household_invites (
    household_id, token_hash, invited_role, expires_at, created_by
  ) values (
    p_household_id, thash, p_invited_role, exp, uid
  ) returning id into iid;

  invite_id := iid;
  token := raw_token;
  expires_at := exp;
  return next;
end;
$$;

revoke all on function public.create_household_invite(uuid, text, int) from public;
revoke all on function public.create_household_invite(uuid, text, int) from anon;
grant execute on function public.create_household_invite(uuid, text, int) to authenticated;

create or replace function public.accept_household_invite(p_token text)
returns public.household_members
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  thash text;
  inv public.household_invites;
  mem public.household_members;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_token is null or length(p_token) < 16 then
    raise exception 'invalid token';
  end if;

  thash := encode(digest(p_token, 'sha256'), 'hex');

  select * into inv from public.household_invites
  where token_hash = thash
  for update;

  if inv.id is null then raise exception 'invite not found'; end if;
  if inv.revoked_at is not null then raise exception 'invite revoked'; end if;
  if inv.used_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;

  insert into public.household_members (household_id, user_id, role, status, joined_at, removed_at)
  values (inv.household_id, uid, inv.invited_role, 'active', now(), null)
  on conflict (household_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        joined_at = now(),
        removed_at = null
  returning * into mem;

  update public.household_invites
  set used_at = now()
  where id = inv.id;

  return mem;
end;
$$;

revoke all on function public.accept_household_invite(text) from public;
revoke all on function public.accept_household_invite(text) from anon;
grant execute on function public.accept_household_invite(text) to authenticated;

-- ROLLBACK: restore set search_path = public on both functions (breaks gen_random_bytes again).
