/**
 * T44.A — `sort_order` migration shape assertions.
 *
 * WHY STATIC-SHAPE AND NOT BEHAVIORAL:
 * This repo's Vitest harness has no live Postgres, no pglite, and no SQL
 * execution engine. Every "db" test (see `tests/db.test.ts`,
 * `tests/admin-project-media-mutations.test.ts`) drives a STUBBED Supabase
 * client and asserts the TypeScript query / RPC-dispatch layer — never the
 * SQL itself. The behavioral guarantees of these migrations (backfill ranks
 * newest-first; `save_project_order` writes array order into `sort_order`;
 * non-array `p_rows` raises; anon EXECUTE is denied) can only be proven
 * against a real database and are verified by the main thread on apply via
 * Supabase advisors + manual SQL. See the BLOCK at the bottom of this file
 * for the exact live-DB checklist.
 *
 * What this file DOES guarantee, cheaply and in CI: that the migration SQL on
 * disk still contains the load-bearing idioms T44.A depends on. If a later
 * edit drops the null-guarded backfill, the non-negative CHECK, the
 * append-on-insert trigger, the loud non-array guard, or the anon EXECUTE
 * revoke, this test fails loudly rather than silently shipping a regression.
 * Mirrors the file-reading approach already used in
 * `tests/server-actions-manifest.test.ts`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

let schemaSql = '';
let rpcSql = '';

beforeAll(() => {
  schemaSql = readFileSync(resolve(MIGRATIONS_DIR, '012_sort_order.sql'), 'utf8');
  rpcSql = readFileSync(
    resolve(MIGRATIONS_DIR, '012a_save_sort_order_rpc.sql'),
    'utf8',
  );
});

describe('012_sort_order.sql — column, backfill, constraint, index, trigger', () => {
  it('adds sort_order idempotently to both projects and posts', () => {
    expect(schemaSql).toMatch(
      /alter table public\.projects\s+add column if not exists sort_order integer;/,
    );
    expect(schemaSql).toMatch(
      /alter table public\.posts\s+add column if not exists sort_order integer;/,
    );
  });

  it('backfills newest-first via row_number() over (order by created_at desc) - 1', () => {
    // The -1 makes the newest row rank 0 (0-based sort_order).
    expect(schemaSql).toMatch(
      /row_number\(\) over \(order by created_at desc\) - 1/,
    );
  });

  it('backfill is re-run-safe: only updates rows where sort_order is null', () => {
    // Both UPDATEs must scope to `sort_order is null` so a re-run never
    // reshuffles a table that has since been hand-ordered.
    const nullGuards = schemaSql.match(/where sort_order is null/g) ?? [];
    expect(nullGuards.length).toBeGreaterThanOrEqual(2);
  });

  it('sets NOT NULL after the backfill on both tables', () => {
    expect(schemaSql).toMatch(
      /alter table public\.projects\s+alter column sort_order set not null;/,
    );
    expect(schemaSql).toMatch(
      /alter table public\.posts\s+alter column sort_order set not null;/,
    );
  });

  it('adds a non-negative CHECK with the repo naming convention, drop-then-add', () => {
    expect(schemaSql).toContain(
      'drop constraint if exists projects_sort_order_nonneg',
    );
    expect(schemaSql).toMatch(
      /add constraint projects_sort_order_nonneg\s+check \(sort_order >= 0\)/,
    );
    expect(schemaSql).toContain(
      'drop constraint if exists posts_sort_order_nonneg',
    );
    expect(schemaSql).toMatch(
      /add constraint posts_sort_order_nonneg\s+check \(sort_order >= 0\)/,
    );
  });

  it('adds a (status, sort_order) btree index per table, idempotently', () => {
    expect(schemaSql).toMatch(
      /create index if not exists projects_status_sort_order_idx\s+on public\.projects \(status, sort_order\);/,
    );
    expect(schemaSql).toMatch(
      /create index if not exists posts_status_sort_order_idx\s+on public\.posts \(status, sort_order\);/,
    );
  });

  it('defines an append-on-insert trigger fn per table: coalesce(max+1, 0) when null', () => {
    expect(schemaSql).toContain(
      'create or replace function public.projects_set_sort_order_default()',
    );
    expect(schemaSql).toContain(
      'create or replace function public.posts_set_sort_order_default()',
    );
    // Append-to-end logic present for both tables.
    expect(schemaSql).toMatch(
      /coalesce\(\s*\(select max\(sort_order\) \+ 1 from public\.projects\),\s*0\s*\)/,
    );
    expect(schemaSql).toMatch(
      /coalesce\(\s*\(select max\(sort_order\) \+ 1 from public\.posts\),\s*0\s*\)/,
    );
    // Only fills when the caller did not supply a value.
    expect(schemaSql).toMatch(/if new\.sort_order is null then/);
  });

  it('trigger functions pin search_path empty and are wired BEFORE INSERT', () => {
    const pinned = schemaSql.match(/set search_path = ''/g) ?? [];
    expect(pinned.length).toBeGreaterThanOrEqual(2);
    expect(schemaSql).toMatch(
      /create trigger projects_set_sort_order_default\s+before insert on public\.projects/,
    );
    expect(schemaSql).toMatch(
      /create trigger posts_set_sort_order_default\s+before insert on public\.posts/,
    );
  });
});

describe('012a_save_sort_order_rpc.sql — reorder RPCs', () => {
  it('defines both save_project_order(jsonb) and save_post_order(jsonb)', () => {
    expect(rpcSql).toContain(
      'create or replace function public.save_project_order(',
    );
    expect(rpcSql).toContain(
      'create or replace function public.save_post_order(',
    );
  });

  it('each RPC is security invoker with search_path pinned empty', () => {
    const invoker = rpcSql.match(/security invoker/g) ?? [];
    expect(invoker.length).toBeGreaterThanOrEqual(2);
    const pinned = rpcSql.match(/set search_path = ''/g) ?? [];
    expect(pinned.length).toBeGreaterThanOrEqual(2);
  });

  it('writes array position (ord - 1) into sort_order via with ordinality', () => {
    const updates =
      rpcSql.match(
        /set sort_order = \(r\.ord - 1\)::integer\s+from jsonb_array_elements\(p_rows\) with ordinality as r\(value, ord\)\s+where t\.id = \(r\.value->>'id'\)::uuid;/g,
      ) ?? [];
    // One UPDATE in each of the two RPC bodies.
    expect(updates.length).toBe(2);
  });

  it('raises loudly with context on null or non-array p_rows, in both RPCs', () => {
    expect(rpcSql).toMatch(
      /if p_rows is null or jsonb_typeof\(p_rows\) <> 'array' then/,
    );
    expect(rpcSql).toContain(
      "'save_project_order: p_rows must be a jsonb array (got %)'",
    );
    expect(rpcSql).toContain(
      "'save_post_order: p_rows must be a jsonb array (got %)'",
    );
  });

  it('applies the exact revoke-from-public / revoke-from-anon / grant-to-authenticated triplet per RPC', () => {
    expect(rpcSql).toContain(
      'revoke execute on function public.save_project_order(jsonb) from public;',
    );
    expect(rpcSql).toContain(
      'revoke execute on function public.save_project_order(jsonb) from anon;',
    );
    expect(rpcSql).toContain(
      'grant  execute on function public.save_project_order(jsonb) to authenticated;',
    );
    expect(rpcSql).toContain(
      'revoke execute on function public.save_post_order(jsonb) from public;',
    );
    expect(rpcSql).toContain(
      'revoke execute on function public.save_post_order(jsonb) from anon;',
    );
    expect(rpcSql).toContain(
      'grant  execute on function public.save_post_order(jsonb) to authenticated;',
    );
  });

  it('does NOT suppress the updated_at trigger (plain UPDATE, per @cto T44.A decision)', () => {
    // A reorder is intended to bump updated_at via the existing set_updated_at
    // trigger. There must be no session_replication_role / trigger-disable
    // hack smuggled into the RPC bodies.
    expect(rpcSql).not.toMatch(/session_replication_role/i);
    expect(rpcSql).not.toMatch(/disable trigger/i);
  });
});

/**
 * LIVE-DB VERIFICATION CHECKLIST (main thread, on apply — NOT covered above):
 *
 *   1. Backfill ranks existing rows newest-first:
 *        select id, sort_order, created_at from public.projects order by sort_order;
 *      -> sort_order ascends as created_at descends; newest row = 0.
 *
 *   2. save_project_order persists array order:
 *        select public.save_project_order(
 *          jsonb_build_array(
 *            jsonb_build_object('id', '<id-B>'),
 *            jsonb_build_object('id', '<id-A>')
 *          ));
 *      -> row B now sort_order 0, row A now sort_order 1.
 *
 *   3. save_project_order raises on non-array p_rows:
 *        select public.save_project_order('{"id":"x"}'::jsonb);
 *      -> ERROR: save_project_order: p_rows must be a jsonb array (got object)
 *
 *   4. save_post_order mirrors (2) and (3) against public.posts.
 *
 *   5. RLS / EXECUTE intent:
 *        - authenticated role: save_*_order succeeds, rows update.
 *        - anon role (set role anon; or anon publishable key): EXECUTE denied
 *          (permission denied for function save_project_order) before the body
 *          runs.
 *
 *   6. updated_at bump: confirm a reorder UPDATE advances updated_at on the
 *      touched rows (set_updated_at trigger fires). @cto-accepted behavior.
 *
 *   7. get_advisors (security_lint + performance_lint) clean after apply —
 *      specifically no 0011_function_search_path_mutable warning on the four
 *      new functions.
 */
