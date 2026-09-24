-- =============================================================================
-- Lunelle V2 — G1: self-service account deletion
--
-- Deleting a row from auth.users requires privileges the `authenticated` role
-- does not have. Rather than giving the API a service-role code path, this
-- SECURITY DEFINER function runs as its owner and deletes exactly one row: the
-- caller's own, identified by auth.uid() from the verified JWT. Every
-- user-owned table cascades from auth.users, so nothing else is needed.
--
-- The Express route DELETE /api/account calls it through the caller-scoped
-- client: `supabase.rpc('delete_own_account')`.
-- =============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
-- Empty search_path: every reference below is schema-qualified, so a malicious
-- object in another schema can never be picked up while running as the owner.
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- Never run without a verified identity (e.g. called with a token that has
  -- no `sub`, or through a session the role check somehow let through).
  if caller is null then
    raise exception 'delete_own_account: no authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  -- The only row this function can ever touch. Cascades remove profiles,
  -- cycle_settings, cycle_events, daily_observations, journal_entries,
  -- forecasts, pattern_evidence and subscription_state for the caller.
  delete from auth.users where id = caller;
end;
$$;

comment on function public.delete_own_account() is
  'G1: deletes the calling user (auth.uid()) and, via cascades, all rows they own. SECURITY DEFINER; callable by authenticated only.';

-- Supabase grants EXECUTE on new public functions to anon/authenticated/
-- service_role by default privilege. Take everything away, then grant back
-- exactly one role.
revoke execute on function public.delete_own_account() from public, anon, authenticated, service_role;
grant execute on function public.delete_own_account() to authenticated;
