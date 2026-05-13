import type { Session } from '@supabase/supabase-js';
import { createServerClient } from './supabase';

/** Operation tag for structured log lines emitted from this module (EH-02). */
const GET_SESSION_OPERATION = 'getServerSession';

/**
 * Read the current admin session from the SSR cookie, server-side. Returns
 * null when no session is present or when the cookie cannot be parsed.
 *
 * Lives in this non-`'use server'` module by design: exporting from
 * `lib/auth.ts` would promote it to a publicly callable Server Action that
 * any client could probe via the `Next-Action` header to confirm admin
 * session presence -- a wire-level enumeration channel orthogonal to the
 * F-12/F-13/F-14 closures. SEC-08 / handoff line 104.
 *
 * Uses `getSession()` (local cookie read) rather than `getUser()` (Supabase
 * round-trip): the gate is a presence check per CONSTRAINT-09, the cookie is
 * HMAC-signed by Supabase, and any forged cookie fails signature verification
 * on the next admin DB call where it actually matters.
 *
 * Never throws. The only sensible response to a session-read failure is
 * "treat as unauthenticated"; throwing would force every caller to wrap in
 * try/catch with the same fallback. Errors are logged with operation tag and
 * error name only -- never token contents, full session, or raw error message
 * (SEC-05, EH-02).
 *
 * @returns The current session, or null when absent or unreadable.
 */
export async function getServerSession(): Promise<Session | null> {
  const supabase = await createServerClient();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error(`[auth] ${GET_SESSION_OPERATION} failed`, {
        operation: GET_SESSION_OPERATION,
        errorName: error.name,
      });
      return null;
    }
    return data.session;
  } catch (cause) {
    console.error(`[auth] ${GET_SESSION_OPERATION} threw`, {
      operation: GET_SESSION_OPERATION,
      errorName: cause instanceof Error ? cause.name : 'unknown',
    });
    return null;
  }
}
