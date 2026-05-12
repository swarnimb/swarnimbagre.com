'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { signInWithMagicLink } from '@/lib/auth';

/** Zod schema mirrored on the client for inline UX feedback (SEC-02 enforced server-side). */
const FORM_SCHEMA = z.object({
  email: z.string().min(1, { message: 'Required' }).email({ message: 'Invalid email' }),
});

/** Inferred form values type for `react-hook-form`. */
type LoginFormValues = z.infer<typeof FORM_SCHEMA>;

/**
 * Uniform post-submit message (F-2 mitigation — enumeration resistance).
 *
 * Shown on every terminal outcome of the server call: success, server-side
 * validation rejection (not allowlisted), and Supabase failure alike. The
 * actual outcome is logged server-side via `lib/auth.ts` — the UI deliberately
 * does not branch (auth-flow.md §2 step 4). The only branch that remains is
 * client-side zod format validation, which exposes shape, not registration
 * state, and therefore poses no enumeration risk.
 *
 * Voice: dry, no SaaS phrasing, no emoji (CONSTRAINT-13).
 */
const UNIFORM_SUBMIT_MESSAGE = 'If that email is registered, check your inbox.';
const SUBMIT_LABEL = 'Send link';
const SUBMIT_PENDING_LABEL = 'Sending';

/** Optional injection point used by tests to stub the server action. */
export interface LoginFormProps {
  /** Defaults to `signInWithMagicLink`; tests override with a mock. */
  onSignIn?: (email: string) => Promise<void>;
}

/**
 * Single-field magic-link sign-in form for the admin panel.
 *
 * Renders a shadcn `<Form>` with one email field and one submit button. After
 * submit, the form is replaced with a single inline status message regardless
 * of whether the server action resolved or rejected — this is the F-2
 * mitigation against email enumeration (auth-flow.md §2 step 4). The detailed
 * outcome (`ValidationError` for not-allowlisted, `ServiceError` for Supabase
 * failure, resolve for accepted) is logged server-side; the client never
 * branches on it (EH-04, SEC-05).
 *
 * Client-side zod format validation still surfaces inline ("Please enter a
 * valid email address.") via `<FormMessage />` — that path reveals email
 * syntax only, not registration state, so it is not an enumeration channel.
 *
 * @param props Optional `onSignIn` for test injection.
 * @returns React element rendering the sign-in form.
 */
export function LoginForm({ onSignIn = signInWithMagicLink }: LoginFormProps = {}): React.ReactElement {
  const [status, setStatus] = useState<'idle' | 'submitted'>('idle');
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(FORM_SCHEMA),
    defaultValues: { email: '' },
  });

  /**
   * Submit handler — invokes the server action and transitions to the single
   * terminal `submitted` state regardless of outcome. The underlying error
   * (or success) is deliberately swallowed at this boundary; full detail is
   * captured by the server-side log inside `lib/auth.ts` (EH-04). This is
   * idempotent UX: the user always sees the same message after a submit.
   */
  async function onSubmit(values: LoginFormValues): Promise<void> {
    try {
      await onSignIn(values.email);
    } catch {
      // Outcome is logged server-side. Client must not branch (F-2, SEC-05).
    }
    setStatus('submitted');
  }

  if (status === 'submitted') {
    return (
      <p role="status" className="text-sm text-foreground">
        {UNIFORM_SUBMIT_MESSAGE}
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? SUBMIT_PENDING_LABEL : SUBMIT_LABEL}
        </Button>
      </form>
    </Form>
  );
}
