-- =============================================================================
-- Migration: 012a_save_sort_order_rpc.sql
-- Purpose:   Create the `save_project_order(p_rows jsonb)` and
--            `save_post_order(p_rows jsonb)` RPCs. Each takes an ordered
--            jsonb array of row identifiers and writes each row's array
--            position back into `sort_order` (0-based) in one transaction,
--            so an admin drag-reorder persists atomically (T44.A).
-- Date:      2026-06-03
--
-- Reproducibility: Idempotent. `create or replace function` rewrites the
--                  body on re-run. The revoke/grant triplet is idempotent
--                  (revoke from a role lacking the grant is a no-op; grant to
--                  a role that already has it is a no-op).
--
-- Order semantics: `sort_order` is derived from array position via
--                  `with ordinality` (1-based `ord`, stored as `ord - 1`).
--                  The array IS the order. Callers MUST send the full set of
--                  rows in the desired display order and MUST NOT supply
--                  sort_order in the payload. Rows whose id is absent from the
--                  array are left untouched (the UPDATE only matches ids that
--                  appear), so a partial array reorders only the ids it names
--                  and never NULLs a missing row.
--
-- Auth:      SECURITY INVOKER. Runs with the caller's role, so the admin RLS
--            policies `projects_admin_all` / `posts_admin_all` (for all to
--            authenticated, migrations 002 / 003) gate the UPDATE exactly as
--            for a direct table write. Defense in depth: EXECUTE is revoked
--            from public/anon and granted only to authenticated, so an anon
--            caller bounces at the EXECUTE check before reaching the body.
--
-- updated_at: @cto DECISION (T44.A): a reorder bumps updated_at. These RPCs
--             do a plain UPDATE and let the existing set_updated_at BEFORE
--             UPDATE trigger (migration 001) fire normally. No
--             trigger-suppression logic.
--
-- search_path: Pinned to empty per Supabase advisor
--              0011_function_search_path_mutable. The body qualifies every
--              reference with public.* so the pinned empty path is safe.
--
-- Related:   migration 012 (adds the `sort_order` column, CHECK, index, and
--            append-on-insert trigger to both tables). 012a depends on 012
--            being applied.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- save_project_order: persist drag-reorder of projects.
-- ---------------------------------------------------------------------------

create or replace function public.save_project_order(
  p_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Input shape guard. `jsonb_array_elements(null)` returns zero rows
  -- silently and a non-array would error obscurely deep in the set-returning
  -- call; a loud, contextual failure is the correct behavior so a buggy
  -- caller sees exactly what went wrong rather than a silent no-op reorder.
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception
      'save_project_order: p_rows must be a jsonb array (got %)',
      jsonb_typeof(p_rows);
  end if;

  update public.projects t
    set sort_order = (r.ord - 1)::integer
    from jsonb_array_elements(p_rows) with ordinality as r(value, ord)
    where t.id = (r.value->>'id')::uuid;
end;
$$;

comment on function public.save_project_order(jsonb) is
  'T44.A: persist admin drag-reorder of projects. sort_order is derived from '
  'array position (1-based ord, stored as ord-1); callers MUST send rows in '
  'display order and must NOT supply sort_order. SECURITY INVOKER + '
  'projects_admin_all RLS gates the UPDATE; EXECUTE granted only to '
  'authenticated. updated_at bumps via the existing set_updated_at trigger.';

-- EXECUTE grant layer. Anon callers bounce at the EXECUTE check before
-- reaching the body. Two revokes: `from public` removes the public-pseudo-
-- role grant, but Supabase's project-bootstrap default privileges
-- `grant execute ... to anon, authenticated, service_role` give anon a direct
-- grant that survives the `from public` revoke, so the explicit `from anon`
-- revoke is required. service_role keeps EXECUTE (admin bypass role).
revoke execute on function public.save_project_order(jsonb) from public;
revoke execute on function public.save_project_order(jsonb) from anon;
grant  execute on function public.save_project_order(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- save_post_order: persist drag-reorder of posts. Mirror of the above.
-- ---------------------------------------------------------------------------

create or replace function public.save_post_order(
  p_rows jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception
      'save_post_order: p_rows must be a jsonb array (got %)',
      jsonb_typeof(p_rows);
  end if;

  update public.posts t
    set sort_order = (r.ord - 1)::integer
    from jsonb_array_elements(p_rows) with ordinality as r(value, ord)
    where t.id = (r.value->>'id')::uuid;
end;
$$;

comment on function public.save_post_order(jsonb) is
  'T44.A: persist admin drag-reorder of posts. sort_order is derived from '
  'array position (1-based ord, stored as ord-1); callers MUST send rows in '
  'display order and must NOT supply sort_order. SECURITY INVOKER + '
  'posts_admin_all RLS gates the UPDATE; EXECUTE granted only to '
  'authenticated. updated_at bumps via the existing set_updated_at trigger.';

revoke execute on function public.save_post_order(jsonb) from public;
revoke execute on function public.save_post_order(jsonb) from anon;
grant  execute on function public.save_post_order(jsonb) to authenticated;

-- =============================================================================
-- End of 012a_save_sort_order_rpc.sql
-- =============================================================================
