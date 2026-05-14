import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ServiceError } from '@/lib/errors';
import {
  sanitizeFilename,
  uploadImageInternal,
} from '@/lib/admin-images-mutations-internal';
import {
  IMAGES_BUCKET,
  MAX_FILE_BYTES,
} from '@/lib/admin-images-mutations-types';
import type { ImageRecord } from '@/lib/types';

/**
 * T25 acceptance — admin IMAGE mutation throwing helpers.
 *
 * Tests live against `uploadImageInternal` (the throwing layer) rather than
 * the `'use server'` wrapper. The wrapper's uniformity contract is tested
 * separately in `tests/admin-images-mutations.uniformity.test.ts` and
 * `tests/admin-images-mutations.timing.test.ts`. Mirrors the pattern in
 * `tests/admin-projects-mutations.test.ts`,
 * `tests/admin-posts-mutations.test.ts`, and
 * `tests/admin-stats-mutations.test.ts`.
 *
 * Adds two test classes that the prior trios do not have:
 *   - SVG MIME-type rejection (closes the SVG drift between the original
 *     T25 spec and the locked decision to drop SVG from the allowlist).
 *   - Compensating-delete invariant: if Storage upload succeeds but the row
 *     insert fails, the wrapper must `storage.remove([path])` before
 *     re-throwing.
 */

interface StubCall {
  method: string;
  args: unknown[];
}

/** A minimal File-like object for the validator tests. We avoid the real
 * `new File([...], name, { type })` constructor because Node's `File` global
 * shape varies across versions and the validator only inspects
 * `instanceof File`, `.size`, `.type`, and `.name`. */
function makeFile(opts: {
  size: number;
  type: string;
  name: string;
}): File {
  // Use a Blob and stamp on `name` to satisfy the structural shape; the
  // validator's `instanceof File` check requires the real constructor when
  // the test wants the validator to accept the input. For the
  // bad-MIME-or-size cases we still need `instanceof File` to be true —
  // hence the real File constructor below.
  return new File(['x'.repeat(Math.min(opts.size, 16))], opts.name, {
    type: opts.type,
  });
}

/**
 * Build a stub Supabase client for the upload happy / error paths. Records
 * every chained call so tests can assert path shape, payload shape, and
 * compensating-delete invocation.
 *
 * Storage chain:  `.storage.from(bucket).upload(path, file, opts) -> { error }`
 * Storage delete: `.storage.from(bucket).remove([path]) -> { error }`
 * Insert chain:   `.from('images').insert(...).select().single() -> { data, error }`
 */
function makeImageStub(opts: {
  uploadResult: { error: { message?: string } | null };
  insertResult: { data: unknown; error: { code?: string; message?: string } | null };
  removeResult?: { error: { message?: string } | null };
}): { client: SupabaseClient; calls: StubCall[] } {
  const calls: StubCall[] = [];
  const removeResult = opts.removeResult ?? { error: null };

  const insertChain: Record<string, unknown> = {};
  insertChain.insert = (...args: unknown[]) => {
    calls.push({ method: 'insert', args });
    return insertChain;
  };
  insertChain.select = (...args: unknown[]) => {
    calls.push({ method: 'select', args });
    return insertChain;
  };
  insertChain.single = (..._args: unknown[]) => {
    calls.push({ method: 'single', args: _args });
    return Promise.resolve(opts.insertResult);
  };

  const storageChain: Record<string, unknown> = {
    upload: (...args: unknown[]) => {
      calls.push({ method: 'storage.upload', args });
      return Promise.resolve(opts.uploadResult);
    },
    remove: (...args: unknown[]) => {
      calls.push({ method: 'storage.remove', args });
      return Promise.resolve(removeResult);
    },
  };

  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] });
      return insertChain;
    },
    storage: {
      from: (bucket: string) => {
        calls.push({ method: 'storage.from', args: [bucket] });
        return storageChain;
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const VALID_PARENT_ID = '11111111-1111-4111-8111-111111111111';

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
});

describe('uploadImageInternal — file boundary (TS-01 errors)', () => {
  it('rejects file > 2MB with ServiceError (no storage upload made)', async () => {
    const oversized = makeFile({
      size: MAX_FILE_BYTES + 1,
      type: 'image/jpeg',
      name: 'foo.jpg',
    });
    // Force the .size getter past the boundary — `new File(...)` only writes
    // as many bytes as we passed it. We patch the property descriptor.
    Object.defineProperty(oversized, 'size', {
      value: MAX_FILE_BYTES + 1,
      configurable: true,
    });

    const { client, calls } = makeImageStub({
      uploadResult: { error: null },
      insertResult: { data: null, error: null },
    });

    await expect(
      uploadImageInternal(
        {
          file: oversized,
          parentType: 'projects',
          parentId: VALID_PARENT_ID,
          altText: 'a',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(calls.find((c) => c.method === 'storage.upload')).toBeUndefined();
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });

  it('rejects empty alt text with ZodError (no storage upload, no row insert)', async () => {
    const file = makeFile({ size: 100, type: 'image/jpeg', name: 'foo.jpg' });
    const { client, calls } = makeImageStub({
      uploadResult: { error: null },
      insertResult: { data: null, error: null },
    });

    await expect(
      uploadImageInternal(
        {
          file,
          parentType: 'projects',
          parentId: VALID_PARENT_ID,
          altText: '',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'storage.upload')).toBeUndefined();
    expect(calls.find((c) => c.method === 'insert')).toBeUndefined();
  });

  it('rejects unknown MIME type (image/svg+xml) with ServiceError — closes SVG drift', async () => {
    const svg = makeFile({
      size: 100,
      type: 'image/svg+xml',
      name: 'foo.svg',
    });
    const { client, calls } = makeImageStub({
      uploadResult: { error: null },
      insertResult: { data: null, error: null },
    });

    await expect(
      uploadImageInternal(
        {
          file: svg,
          parentType: 'projects',
          parentId: VALID_PARENT_ID,
          altText: 'a',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);
    expect(calls.find((c) => c.method === 'storage.upload')).toBeUndefined();
  });

  it('rejects when parentType is not in allowlist with ZodError', async () => {
    const file = makeFile({ size: 100, type: 'image/jpeg', name: 'foo.jpg' });
    const { client, calls } = makeImageStub({
      uploadResult: { error: null },
      insertResult: { data: null, error: null },
    });

    await expect(
      uploadImageInternal(
        {
          file,
          parentType: 'comments',
          parentId: VALID_PARENT_ID,
          altText: 'a',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'storage.upload')).toBeUndefined();
  });

  it('rejects when parentId is not a UUID with ZodError (path-injection guard)', async () => {
    const file = makeFile({ size: 100, type: 'image/jpeg', name: 'foo.jpg' });
    const { client, calls } = makeImageStub({
      uploadResult: { error: null },
      insertResult: { data: null, error: null },
    });

    await expect(
      uploadImageInternal(
        {
          file,
          parentType: 'projects',
          parentId: '../../etc/passwd',
          altText: 'a',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ZodError);
    expect(calls.find((c) => c.method === 'storage.upload')).toBeUndefined();
  });
});

describe('uploadImageInternal — happy path (TS-01, TS-04)', () => {
  it('uploads file and inserts row on valid input with the canonical path scheme', async () => {
    const file = makeFile({ size: 1234, type: 'image/jpeg', name: 'foo.jpg' });
    const insertedRow: ImageRecord = {
      id: 'img-1',
      bucket_path: 'placeholder-overwritten-by-stub',
      alt_text: 'kitten',
      parent_id: VALID_PARENT_ID,
      parent_type: 'projects',
      created_at: '2026-05-13T00:00:00.000Z',
    };
    const { client, calls } = makeImageStub({
      uploadResult: { error: null },
      insertResult: { data: insertedRow, error: null },
    });

    const result = await uploadImageInternal(
      {
        file,
        parentType: 'projects',
        parentId: VALID_PARENT_ID,
        altText: 'kitten',
      },
      client,
    );

    expect(result).toEqual(insertedRow);

    const storageFromCall = calls.find((c) => c.method === 'storage.from');
    expect(storageFromCall?.args[0]).toBe(IMAGES_BUCKET);

    const uploadCall = calls.find((c) => c.method === 'storage.upload');
    expect(uploadCall).toBeDefined();
    const bucketPath = uploadCall?.args[0] as string;
    expect(bucketPath).toMatch(
      new RegExp(
        `^images/projects/${VALID_PARENT_ID}/[0-9a-f-]{36}_foo\\.jpg$`,
      ),
    );

    const insertFromCall = calls.find(
      (c) => c.method === 'from' && c.args[0] === 'images',
    );
    expect(insertFromCall).toBeDefined();
    const insertCall = calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.bucket_path).toBe(bucketPath);
    expect(payload.alt_text).toBe('kitten');
    expect(payload.parent_id).toBe(VALID_PARENT_ID);
    expect(payload.parent_type).toBe('projects');
  });
});

describe('uploadImageInternal — failure paths (TS-04)', () => {
  it('handles Storage failure with ServiceError + structured log', async () => {
    const file = makeFile({ size: 100, type: 'image/jpeg', name: 'foo.jpg' });
    const { client } = makeImageStub({
      uploadResult: { error: { message: 'storage 5xx' } },
      insertResult: { data: null, error: null },
    });

    await expect(
      uploadImageInternal(
        {
          file,
          parentType: 'projects',
          parentId: VALID_PARENT_ID,
          altText: 'a',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const logCalls = consoleErrorSpy?.mock.calls ?? [];
    const matched = logCalls.find((c) => {
      const payload = c[1] as Record<string, unknown> | undefined;
      return payload?.operation === 'uploadImage' && typeof payload?.bucketPath === 'string';
    });
    expect(matched).toBeDefined();
  });

  it('compensating-deletes the storage object when the row insert fails (cites insert error)', async () => {
    const file = makeFile({ size: 100, type: 'image/jpeg', name: 'foo.jpg' });
    const insertError = { code: '42501', message: 'permission denied' };
    const { client, calls } = makeImageStub({
      uploadResult: { error: null },
      insertResult: { data: null, error: insertError },
      removeResult: { error: null },
    });

    await expect(
      uploadImageInternal(
        {
          file,
          parentType: 'projects',
          parentId: VALID_PARENT_ID,
          altText: 'kitten',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ServiceError);

    const uploadCall = calls.find((c) => c.method === 'storage.upload');
    const uploadedPath = uploadCall?.args[0] as string;

    const removeCall = calls.find((c) => c.method === 'storage.remove');
    expect(removeCall).toBeDefined();
    expect(removeCall?.args[0]).toEqual([uploadedPath]);
  });
});

describe('sanitizeFilename — strips path separators and control chars', () => {
  it('handles separators, normal names, traversal patterns, and empty input', () => {
    // forward slash collapses to `_`
    expect(sanitizeFilename('foo/bar.png')).toBe('foo_bar.png');
    // normal name passes through unchanged
    expect(sanitizeFilename('normal_file.png')).toBe('normal_file.png');
    // empty input throws (caller surfaces generic-error envelope)
    expect(() => sanitizeFilename('')).toThrow(ServiceError);
    // traversal pattern: `../../etc/passwd` — the `lastDot` split treats the
    // leading dot before `../` as the extension boundary, leaving the basename
    // entirely composed of separator characters that strip to empty. Layered
    // throw is acceptable per spec ("throws OR returns safe — whichever
    // matches your impl"); the parentId UUID schema check at the wrapper is
    // the authoritative path-injection guard.
    expect(() => sanitizeFilename('../../etc/passwd')).toThrow(ServiceError);
  });
});
