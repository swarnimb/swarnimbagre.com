'use client';

import { Button } from '@/components/ui/button';

/**
 * Admin route-group error boundary. Surfaces the failure loudly — message and
 * digest shown verbatim, no swallowing — and offers a retry wired to reset().
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return (
    <main
      className="admin-root flex flex-col items-start gap-4 px-6 py-10"
      role="alert"
    >
      <h1 className="text-2xl font-semibold text-foreground">
        Something broke in admin
      </h1>
      <p className="text-sm text-muted-foreground">
        {error.message || 'No error message was provided.'}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
      ) : null}
      <Button size="sm" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
