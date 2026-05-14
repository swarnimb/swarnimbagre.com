/**
 * SEC-09 Server Action allowlist invariant (F-14).
 *
 * Builds the Next.js app, then asserts that the set of Server Action
 * `exportedName`s in `.next/server/server-reference-manifest.json` matches
 * the allowlist below exactly. Drift in either direction (a new action
 * appearing, or an expected action disappearing) fails this test.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// Single source of truth for the SEC-09 allowlist. Adding a new Server Action
// requires updating BOTH the `'use server'` module(s) AND this constant in
// lock-step. After T24, the allowlist is ten IDs spread across two modules:
//   - `lib/auth.ts`            — `signInWithMagicLink`, `signOut`
//   - `lib/admin-mutations.ts` — `createProject`, `updateProject`,
//                                `deleteProject`, `createPost`, `updatePost`,
//                                `deletePost`, `insertStat`, `deleteStat`
const SERVER_ACTION_ALLOWLIST = new Set<string>([
  'signInWithMagicLink',
  'signOut',
  'createProject',
  'updateProject',
  'deleteProject',
  'createPost',
  'updatePost',
  'deletePost',
  'insertStat',
  'deleteStat',
]);

const MANIFEST_PATH = resolve(
  process.cwd(),
  '.next',
  'server',
  'server-reference-manifest.json',
);

const BUILD_TIMEOUT_MS = 180_000;

interface ServerActionEntry {
  exportedName: string;
}
interface ServerReferenceManifest {
  node: Record<string, ServerActionEntry>;
  edge: Record<string, ServerActionEntry>;
}

describe('SEC-09 Server Action allowlist', () => {
  beforeAll(() => {
    // Override NODE_ENV='test' (set by vitest) so Next.js loads `.env.local`
    // for the build subprocess — otherwise required Supabase vars are missing
    // and the build aborts before producing the manifest.
    execSync('npm run build', {
      stdio: 'inherit',
      timeout: BUILD_TIMEOUT_MS,
      env: { ...process.env, NODE_ENV: 'production' },
    });
  }, BUILD_TIMEOUT_MS);

  it('manifest exports match the allowlist exactly (SEC-09)', () => {
    expect(
      existsSync(MANIFEST_PATH),
      `Server reference manifest not found at ${MANIFEST_PATH}. The build did not produce it — check \`npm run build\` output.`,
    ).toBe(true);

    const manifest = JSON.parse(
      readFileSync(MANIFEST_PATH, 'utf8'),
    ) as ServerReferenceManifest;

    const allEntries = { ...manifest.node, ...manifest.edge };
    const exportedNames = new Set(
      Object.values(allEntries).map((e) => e.exportedName),
    );

    const expectedList = [...SERVER_ACTION_ALLOWLIST].sort().join(', ');
    const foundList = [...exportedNames].sort().join(', ');
    expect(
      exportedNames,
      `Server Action allowlist drift (SEC-09). Expected: [${expectedList}]. Found: [${foundList}].`,
    ).toEqual(SERVER_ACTION_ALLOWLIST);
  });
});
