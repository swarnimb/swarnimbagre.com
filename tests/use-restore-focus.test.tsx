import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { useRestoreFocus } from '@/lib/use-restore-focus';

/**
 * The hook exists because holding a DOM node across the viewer's lifetime does
 * not survive React re-creating it. These cases cover the two outcomes that
 * matter: the opener is found again, or it is gone and nothing breaks.
 */

afterEach(() => {
  cleanup();
});

function Harness({ hideOnClose = false }: { hideOnClose?: boolean }) {
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const remember = useRestoreFocus(open, (index) =>
    document.querySelectorAll<HTMLElement>('[data-opener]')[index],
  );

  return (
    <div>
      {!(hideOnClose && closed) && (
        <>
          <span data-opener="0">first</span>
          <span data-opener="1">second</span>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          remember(1);
          setOpen(true);
        }}
      >
        open
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setClosed(true);
        }}
      >
        close
      </button>
    </div>
  );
}

describe('useRestoreFocus', () => {
  it('focuses the remembered opener once the viewer closes', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    fireEvent.click(screen.getByText('close'));
    const second = document.querySelectorAll('[data-opener]')[1];
    expect(document.activeElement).toBe(second);
    expect(second).toHaveAttribute('tabindex', '-1');
  });

  it('does nothing when the opener no longer exists', () => {
    render(<Harness hideOnClose />);
    fireEvent.click(screen.getByText('open'));
    expect(() => fireEvent.click(screen.getByText('close'))).not.toThrow();
    expect(document.querySelectorAll('[data-opener]')).toHaveLength(0);
    // Focus is simply left where it was; the hook does not guess a fallback.
    expect(document.activeElement).toBe(document.body);
  });
});
