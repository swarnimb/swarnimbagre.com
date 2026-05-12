import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginForm } from '@/components/admin/LoginForm';

const UNIFORM_MESSAGE = 'If that email is registered, check your inbox.';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

/** Fill the email field and submit the form using fireEvent + act (no user-event dep). */
async function submitWithEmail(email: string): Promise<void> {
  const input = screen.getByLabelText('Email') as HTMLInputElement;
  fireEvent.change(input, { target: { value: email } });
  await act(async () => {
    fireEvent.submit(input.closest('form')!);
  });
}

describe('LoginForm', () => {
  it('shows the uniform message when sign-in resolves (allowlisted, F-2)', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSignIn={onSignIn} />);
    await submitWithEmail('allowed@example.test');

    await waitFor(() => {
      expect(screen.getByText(UNIFORM_MESSAGE)).toBeInTheDocument();
    });
    expect(onSignIn).toHaveBeenCalledWith('allowed@example.test');
  });

  it('shows the SAME uniform message when sign-in resolves for a non-allowlisted email (F-2 + F-13)', async () => {
    // Post-F-13 fix: the Server Action never throws. The non-allowlisted server
    // path resolves uniformly with `undefined` — the throw shape is contained
    // to the internal `attemptMagicLink` helper (tested in `auth.test.ts`).
    const onSignIn = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSignIn={onSignIn} />);
    await submitWithEmail('attacker@evil.example');

    await waitFor(() => {
      expect(screen.getByText(UNIFORM_MESSAGE)).toBeInTheDocument();
    });
    expect(onSignIn).toHaveBeenCalledTimes(1);
    // Critical: no distinct error message leaks the rejection reason.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the SAME uniform message when Supabase fails (F-2 + F-13)', async () => {
    // Post-F-13 fix: Supabase-failure path also resolves uniformly server-side.
    const onSignIn = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSignIn={onSignIn} />);
    await submitWithEmail('allowed@example.test');

    await waitFor(() => {
      expect(screen.getByText(UNIFORM_MESSAGE)).toBeInTheDocument();
    });
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows an inline format error and does NOT call the server action for malformed input', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSignIn={onSignIn} />);
    await submitWithEmail('not-an-email');

    await waitFor(() => {
      // shadcn `<FormMessage />` renders the zod error inline.
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });
    expect(onSignIn).not.toHaveBeenCalled();
    // Uniform terminal-state message is NOT shown for format errors —
    // the form stays interactive so the user can correct the input.
    expect(screen.queryByText(UNIFORM_MESSAGE)).not.toBeInTheDocument();
  });
});
