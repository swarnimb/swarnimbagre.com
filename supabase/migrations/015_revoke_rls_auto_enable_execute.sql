-- =============================================================================
-- Migration: 015_revoke_rls_auto_enable_execute.sql
-- Purpose:   Revoke EXECUTE on `public.rls_auto_enable()` from `public`,
--            `anon` and `authenticated`, closing audit-24 finding F-39's
--            sibling F-41: a SECURITY DEFINER function reachable by an
--            unauthenticated caller via `/rest/v1/rpc/rls_auto_enable`.
-- Date:      2026-08-04
-- Finding:   F-41 (Medium), `docs/security-report.md` audit 24.
--
-- Background: `rls_auto_enable()` is platform-side infrastructure, not project
--            authorship. It appears in no prior migration in this repo and
--            could not be dated (`pg_proc` carries no creation timestamp). It
--            backs the `ensure_rls` event trigger, which fires on
--            `ddl_command_end` and switches row security on for every new
--            table created in `public`. It is `prosecdef = true` with
--            `proconfig = ["search_path=pg_catalog"]`.
--
-- Why revoke: An event-trigger function fires as part of the DDL transaction
--            under the trigger's own ownership. Postgres does NOT consult
--            EXECUTE privilege when firing an event trigger, so the grants
--            being removed here are unused by the auto-enable behaviour. What
--            they DO provide is an internet-reachable PostgREST RPC path to a
--            definer-privilege function. Today the body is inert when called
--            that way -- its first statement is `pg_event_trigger_ddl_commands()`,
--            which raises outside a `ddl_command_end` context -- but a future
--            rewrite of that body would silently inherit an anon-callable
--            definer entry point. This restores the project's standard RPC
--            idiom (see 010a / 012a: revoke from public AND anon, grant only
--            where actually needed).
--
-- Advisors:  Closes two Supabase security lints, both WARN / EXTERNAL:
--            `anon_security_definer_function_executable` and
--            `authenticated_security_definer_function_executable`.
--
-- Reproducibility: Idempotent. `revoke` against a role lacking the grant is a
--            no-op, so re-running is safe. Guarded by a `to_regprocedure`
--            existence check so the migration does not fail on an environment
--            where the platform has not installed the function.
--
-- Rollback:  `grant execute on function public.rls_auto_enable() to anon, authenticated;`
--            Not expected to be needed -- see "Why revoke" above.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    -- `public` is the implicit grant Postgres applies to every new function.
    revoke execute on function public.rls_auto_enable() from public;
    -- Supabase's default privileges grant directly to `anon` / `authenticated`,
    -- which survives the revoke from `public` above. Both must be named.
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;
  end if;
end
$$;
