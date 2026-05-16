import { describe, it, expect } from 'vitest';
import { ServiceError, ValidationError, toLogSafeError } from '@/lib/errors';

describe('toLogSafeError', () => {
  it('reduces a Supabase-style AuthError to name/status/code only', () => {
    // Shape mirrors @supabase/supabase-js AuthError: message can carry PII.
    const authError = {
      name: 'AuthApiError',
      message: 'Email rate limit exceeded for victim@example.com',
      status: 429,
      code: 'over_email_send_rate_limit',
    };

    const safe = toLogSafeError(authError);

    expect(safe).toEqual({
      name: 'AuthApiError',
      status: 429,
      code: 'over_email_send_rate_limit',
    });
  });

  it('never includes message or cause (SEC-05 / F-29)', () => {
    const err = new ServiceError('admin allowlist not configured', {
      operation: 'signInWithMagicLink',
      cause: new Error('sensitive: leaked@example.com'),
    });

    const safe = toLogSafeError(err);
    const serialized = JSON.stringify(safe);

    expect(safe).toEqual({ name: 'ServiceError' });
    expect(serialized).not.toContain('leaked@example.com');
    expect(serialized).not.toContain('message');
    expect(serialized).not.toContain('cause');
  });

  it('omits status/code when they are absent or the wrong type', () => {
    const validation = new ValidationError('email', 'not allowlisted');

    const safe = toLogSafeError(validation);

    expect(safe).toEqual({ name: 'ValidationError' });
    expect('status' in safe).toBe(false);
    expect('code' in safe).toBe(false);
  });

  it('handles non-object thrown values without leaking them', () => {
    expect(toLogSafeError('boom: secret-token-abc')).toEqual({ name: 'NonError' });
    expect(toLogSafeError(null)).toEqual({ name: 'NonError' });
    expect(toLogSafeError(undefined)).toEqual({ name: 'NonError' });
  });

  it('falls back to UnknownError for an object with no string name', () => {
    expect(toLogSafeError({ status: 500 })).toEqual({
      name: 'UnknownError',
      status: 500,
    });
  });
});
