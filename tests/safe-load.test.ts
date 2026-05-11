import { describe, it, expect, vi } from 'vitest';
import { safeLoad } from '@/lib/safe-load';
import { ServiceError } from '@/lib/errors';

describe('safeLoad', () => {
  it('returns the loaded value when load resolves', async () => {
    const result = await safeLoad(async () => ({ x: 1 }), { x: 0 }, 'test:happy');
    expect(result).toEqual({ x: 1 });
  });

  it('returns fallback and logs when load throws a ServiceError', async () => {
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new ServiceError('boom', {
      operation: 'doStuff',
      cause: { code: 'P0001', message: 'pg fail' },
    });
    const result = await safeLoad(
      async () => {
        throw err;
      },
      'fallback',
      'test:serviceerror',
    );
    expect(result).toBe('fallback');
    expect(consoleErrSpy).toHaveBeenCalledTimes(1);
    const [msg, payload] = consoleErrSpy.mock.calls[0]!;
    expect(msg).toContain('[safeLoad]');
    expect(msg).toContain('test:serviceerror');
    expect(payload).toMatchObject({
      context: 'test:serviceerror',
      operation: 'doStuff',
      errorName: 'ServiceError',
      errorMessage: 'boom',
      causeCode: 'P0001',
      causeMessage: 'pg fail',
    });
    expect(typeof (payload as { stack?: unknown }).stack).toBe('string');
    consoleErrSpy.mockRestore();
  });

  it('returns fallback and logs even when load throws a non-Error value', async () => {
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await safeLoad(
      async () => {
        throw 'just a string';
      },
      [],
      'test:nonerror',
    );
    expect(result).toEqual([]);
    expect(consoleErrSpy).toHaveBeenCalledTimes(1);
    consoleErrSpy.mockRestore();
  });
});
