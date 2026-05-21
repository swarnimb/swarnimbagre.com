-- =============================================================================
-- Migration: 010a_save_project_media_rpc.sql
-- Purpose:   Create the `save_project_media(p_project_id uuid, p_rows jsonb)`
--            RPC. Wraps the delete-all-then-insert-all save-media workflow
--            in a single Postgres transaction so a Node crash or insert
--            failure cannot leave a project with its old media deleted and
--            no new rows in. T43.E.
-- Date:      2026-05-20
--
-- Reproducibility: Idempotent. `create or replace function` rewrites the
--                  function body on re-run. The revoke/grant pair is also
--                  idempotent (revoke from a role that already lacks the
--                  grant is a no-op; grant to a role that already has it
--                  is a no-op).
--
-- Atomicity: Both the DELETE and the INSERT run inside the function body,
--            which itself runs inside one statement-level transaction. A
--            failure on the INSERT side (RLS reject, FK violation, row-cap
--            trigger raise) rolls back the DELETE in the same transaction —
--            no torn save state is possible.
--
-- Auth:      SECURITY INVOKER. The function runs with the caller's role,
--            so the admin RLS policy `project_media_admin_all` (for all to
--            authenticated) gates both the DELETE and the INSERT exactly
--            as it would for direct table writes. Defense in depth: EXECUTE
--            is revoked from public/anon and explicitly granted only to
--            authenticated, so anon callers fail at the EXECUTE check
--            before ever reaching the function body.
--
-- search_path: Pinned to empty per Supabase advisor
--              `0011_function_search_path_mutable`. Function body qualifies
--              every reference with `public.*` so the pinned empty path is
--              safe.
--
-- Order semantics: `order_index` is derived from array position via
--                  `with ordinality` (1-based, stored as `ord - 1`). The
--                  array IS the order. Callers MUST send rows in display
--                  order and MUST NOT supply order_index in the row
--                  payload. This eliminates the "two rows with the same
--                  order_index" failure mode at the source.
--
-- Trigger interaction: The pre-existing `project_media_enforce_row_cap`
--                      trigger fires BEFORE INSERT per row. In a transaction
--                      that DELETEs all rows for the project then bulk-
--                      INSERTs N new rows, each new row's trigger counts
--                      rows already in the table for this project. Since
--                      the DELETE ran first in the same transaction, the
--                      count window starts at 0 and grows. The 21st row
--                      would see 20 and raise — but the application-layer
--                      zod schema blocks `rows.length > 20` first. This
--                      DB-side trigger is defense-in-depth against a
--                      caller that bypasses the wrapper (psql, direct
--                      Supabase Studio, etc.).
--
-- Related:   migration 010 (creates `public.project_media` table + row-cap
--            trigger + RLS policies). 010a depends on 010 being applied.
-- =============================================================================

create or replace function public.save_project_media(
  p_project_id uuid,
  p_rows       jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Input shape guard. `jsonb_array_elements(null)` returns zero rows
  -- silently — without this guard, a NULL or non-array `p_rows` would
  -- silently wipe all media for the project (the DELETE runs unconditionally
  -- below). Loud failure is the correct behavior: a buggy caller should
  -- see a clear error, not an unexpected destructive op.
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception
      'save_project_media: p_rows must be a jsonb array (got %)',
      jsonb_typeof(p_rows);
  end if;

  -- Replace-all semantics. Both statements run in the same transaction;
  -- if the INSERT raises (RLS reject, FK violation, row-cap trigger),
  -- the DELETE rolls back.
  delete from public.project_media
    where project_id = p_project_id;

  insert into public.project_media
    (project_id, image_id, image_after_id, caption, order_index)
  select
    p_project_id,
    (r.value->>'image_id')::uuid,
    nullif(r.value->>'image_after_id', '')::uuid,
    nullif(r.value->>'caption', ''),
    (r.ord - 1)::integer
  from jsonb_array_elements(p_rows) with ordinality as r(value, ord);
end;
$$;

comment on function public.save_project_media(uuid, jsonb) is
  'T43.E: atomic delete-then-insert of project_media rows for a project. '
  'order_index is derived from array position (1-based ord, stored as ord-1); '
  'callers MUST send rows in display order and must NOT supply order_index. '
  'SECURITY INVOKER + project_media_admin_all RLS gates DELETE/INSERT; '
  'EXECUTE granted only to authenticated. Application validates rows.length '
  '<= 20 at zod boundary; DB row-cap trigger is defense-in-depth.';

-- EXECUTE grant layer. Anon callers bounce at the EXECUTE check before
-- reaching the function body. Authenticated callers are then gated by
-- the RLS policy on `project_media` for the DELETE and INSERT.
--
-- Why two revokes: `revoke ... from public` removes only the public-pseudo-
-- role grant. Supabase's project-bootstrap default-privileges run a
-- `grant execute ... to anon, authenticated, service_role` on every new
-- function in `public`, so `anon` ends up with a direct grant that
-- survives the `from public` revoke. The explicit `from anon` revoke
-- closes that. `service_role` keeps EXECUTE (admin bypass role).
revoke execute on function public.save_project_media(uuid, jsonb) from public;
revoke execute on function public.save_project_media(uuid, jsonb) from anon;
grant  execute on function public.save_project_media(uuid, jsonb) to authenticated;
