import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createPostInternal,
  deletePostInternal,
  updatePostInternal,
} from '@/lib/admin-posts-mutations-internal';
import type { Post } from '@/lib/types';

/**
 * T23 acceptance — admin POST mutation throwing helpers.
 *
 * Tests live against `createPostInternal` / `updatePostInternal` /
 * `deletePostInternal` (the throwing layer) rather than the `'use server'`
 * wrappers. The wrappers' uniformity contract is tested separately in
 * `tests/admin-posts-mutations.uniformity.test.ts` and
 * `tests/admin-posts-mutations.timing.test.ts`. Mirrors the
 * `attemptMagicLink` / `signInWithMagicLink` split already in
 * `tests/auth.test.ts` and the project equivalents in
 * `tests/admin-projects-mutations.test.ts`.
 *
 * TS-04 data-write critical-path tests:
 *   1. createPost stores raw Markdown verbatim (CONSTRAINT-06).
 *   2. updatePost omits slug from the update payload on published rows
 *      (CONSTRAINT-12 slug-lock, app-side layer-one guard).
 *   3. deletePost issues DELETE FROM posts WHERE id = $1 and resolves.
 */

interface StubCall {
  method: string;
  args: unknown[];
}

/**
 * Build a stub Supabase client that simulates the create-side chain:
 *   `.from(...).insert(...).select().single() -> { data, error }`.
 *
 * Records every chained call so tests can assert that `.insert(...)` was
 * invoked with the expected payload (including the auto-generated slug).
 */
function makeCreateStub(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const chain: Record<string, unknown> = {};
  const recorder = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  chain.insert = recorder('insert');
  chain.select = recorder('select');
  chain.single = (..._args: unknown[]) => {
    calls.push({ method: 'single', args: _args });
    return Promise.resolve(result);
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

/**
 * Build a stub Supabase client for the update path: two distinct chains share
 * one `.from()` call site (one for the pre-fetch SELECT, one for the UPDATE).
 *
 * The stub maintains a small state machine — the first `.eq(...).single()`
 * call resolves with `fetchResult`, the second resolves with `updateResult`.
 */
function makeUpdateStub(opts: {
  fetchResult: { data: unknown; error: unknown };
  updateResult: { data: unknown; error: unknown };
}): { client: SupabaseClient; calls: StubCall[] } {
  const calls: StubCall[] = [];
  let singleCallCount = 0;
  const chain: Record<string, unknown> = {};
  const recorder = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  chain.select = recorder('select');
  chain.update = recorder('update');
  chain.eq = recorder('eq');
  chain.single = (..._args: unknown[]) => {
    calls.push({ method: 'single', args: _args });
    singleCallCount += 1;
    return Promise.resolve(
      singleCallCount === 1 ? opts.fetchResult : opts.updateResult,
    );
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

/**
 * Build a stub Supabase client for the delete path:
 *   `.from('posts').delete().eq('id', id) -> { error }`
 */
function makeDeleteStub(result: { error: unknown }): {
  client: SupabaseClient;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const chain: Record<string, unknown> = {};
  chain.delete = (..._args: unknown[]) => {
    calls.push({ method: 'delete', args: _args });
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    calls.push({ method: 'eq', args });
    return Promise.resolve(result);
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('createPostInternal — TS-04 stores raw Markdown verbatim (CONSTRAINT-06)', () => {
  it('passes the content string to the DB insert unchanged — leading/trailing whitespace and Markdown syntax preserved', async () => {
    // Content with leading/trailing whitespace + multiple Markdown features:
    // headings, lists, inline code, code fence, hard line breaks. If any layer
    // trimmed, normalized, or HTML-converted this string, the assertion fails.
    const RAW_MARKDOWN =
      '  \n# Heading\n\n- list item one\n- list item two\n\nInline `code` and **bold** and _italic_.\n\n```ts\nconst x = 1;\n```\n\ntrailing whitespace below \n\n  ';

    const insertedRow: Post = {
      id: 'post-new',
      title: 'Verbatim',
      slug: 'verbatim',
      content: RAW_MARKDOWN,
      status: 'draft',
      image_id: null,
      created_at: '2026-05-13T00:00:00.000Z',
      updated_at: '2026-05-13T00:00:00.000Z',
    };
    const { client, calls } = makeCreateStub({ data: insertedRow, error: null });

    const result = await createPostInternal(
      { title: 'Verbatim', content: RAW_MARKDOWN, status: 'draft' },
      client,
    );

    expect(result).toEqual(insertedRow);

    const fromCall = calls.find((c) => c.method === 'from');
    expect(fromCall?.args[0]).toBe('posts');

    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    // CONSTRAINT-06: content is stored verbatim — strict equality, no trim.
    expect(payload.content).toBe(RAW_MARKDOWN);
    // Sanity: the other fields were also forwarded.
    expect(payload.title).toBe('Verbatim');
    expect(payload.status).toBe('draft');
    expect(payload.slug).toBe('verbatim');
  });
});

describe('updatePostInternal — TS-04 rejects slug change on published post (CONSTRAINT-12)', () => {
  it('omits slug from the update payload when the existing row is published, even if title changes', async () => {
    const { client, calls } = makeUpdateStub({
      fetchResult: { data: { status: 'published', image_id: null }, error: null },
      updateResult: {
        data: {
          id: 'post-pub',
          title: 'Renamed Heading',
          slug: 'original-slug',
          content: 'body',
          status: 'published',
          image_id: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-05-13T00:00:00.000Z',
        } as Post,
        error: null,
      },
    });

    await updatePostInternal(
      'post-pub',
      {
        title: 'Renamed Heading',
        content: 'body',
        status: 'published',
        image_id: null,
      },
      client,
    );

    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall).toBeDefined();
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload).toBeDefined();
    expect(payload.title).toBe('Renamed Heading');
    expect(payload.content).toBe('body');
    expect(payload.status).toBe('published');
    // The slug key must be ABSENT — not merely undefined — so the DB trigger
    // is never asked to compare a value (defense in depth around CONSTRAINT-12).
    expect(Object.prototype.hasOwnProperty.call(payload, 'slug')).toBe(false);
  });
});

describe('deletePostInternal — TS-04 removes the row', () => {
  it('issues DELETE FROM posts WHERE id = $1 and resolves on success', async () => {
    const { client, calls } = makeDeleteStub({ error: null });

    await expect(deletePostInternal('post-1', client)).resolves.toBeUndefined();

    const fromCall = calls.find((c) => c.method === 'from');
    expect(fromCall?.args[0]).toBe('posts');
    expect(calls.find((c) => c.method === 'delete')).toBeDefined();
    const eqCall = calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'post-1']);
  });
});
