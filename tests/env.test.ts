import { describe, it, expect, vi, afterEach } from 'vitest';
import { assertRequiredEnv, REQUIRED_ENV_VARS } from '@/lib/env';

describe('assertRequiredEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not throw when all required vars are present', () => {
    for (const name of REQUIRED_ENV_VARS) {
      vi.stubEnv(name, 'placeholder-value');
    }
    expect(() => assertRequiredEnv()).not.toThrow();
  });

  it('throws and names the missing var when one is unset', () => {
    for (const name of REQUIRED_ENV_VARS) {
      vi.stubEnv(name, 'placeholder-value');
    }
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    expect(() => assertRequiredEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => assertRequiredEnv()).toThrow(/Missing required environment variable/);
  });

  it('throws and names ADMIN_ALLOWED_EMAIL when it is the only missing var', () => {
    for (const name of REQUIRED_ENV_VARS) {
      vi.stubEnv(name, 'placeholder-value');
    }
    vi.stubEnv('ADMIN_ALLOWED_EMAIL', '');

    expect(() => assertRequiredEnv()).toThrow(/ADMIN_ALLOWED_EMAIL/);
    expect(() => assertRequiredEnv()).toThrow(/Missing required environment variable/);
  });

  it('throws and names every missing var when several are unset', () => {
    for (const name of REQUIRED_ENV_VARS) {
      vi.stubEnv(name, '');
    }

    let caught: unknown;
    try {
      assertRequiredEnv();
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    const msg = (caught as Error).message;
    for (const name of REQUIRED_ENV_VARS) {
      expect(msg).toContain(name);
    }
    expect(msg).toContain('docs/env-checklist.md');
  });
});
