import { describe, it, expect, afterEach, vi } from 'vitest';
import { isPinchZoomed, trapTab } from '@/lib/lightbox-dom';

/**
 * The viewer's two DOM-level guards. Both exist to stop the overlay from
 * misbehaving in states the happy path never reaches: a pinch-zoomed viewport,
 * and a Tab that would otherwise walk out of an open modal.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('isPinchZoomed', () => {
  it('reports not zoomed at the default scale', () => {
    vi.stubGlobal('visualViewport', { scale: 1 });
    expect(isPinchZoomed()).toBe(false);
  });

  it('reports zoomed once the visual viewport scales past 1', () => {
    vi.stubGlobal('visualViewport', { scale: 2.5 });
    expect(isPinchZoomed()).toBe(true);
  });

  it('reports not zoomed when the API is missing entirely', () => {
    vi.stubGlobal('visualViewport', undefined);
    expect(isPinchZoomed()).toBe(false);
  });
});

describe('trapTab', () => {
  function dialogWith(buttonCount: number): HTMLElement {
    const dialog = document.createElement('div');
    dialog.tabIndex = -1;
    for (let index = 0; index < buttonCount; index += 1) {
      const button = document.createElement('button');
      button.textContent = `b${index}`;
      dialog.appendChild(button);
    }
    document.body.appendChild(dialog);
    return dialog;
  }

  it('wraps forward from the last control to the first', () => {
    const dialog = dialogWith(3);
    const buttons = dialog.querySelectorAll('button');
    buttons[2].focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    trapTab(event, dialog);
    expect(document.activeElement).toBe(buttons[0]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps forward from the dialog itself into the first control', () => {
    // Without this the first Tab falls through to browser default, which only
    // happens to land inside the dialog because the portal is body's last
    // child. Anything mounted after it would take focus out of the modal.
    const dialog = dialogWith(3);
    dialog.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    trapTab(event, dialog);
    expect(document.activeElement).toBe(dialog.querySelectorAll('button')[0]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('wraps backward from the dialog itself to the last control', () => {
    const dialog = dialogWith(3);
    dialog.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      cancelable: true,
    });
    trapTab(event, dialog);
    expect(document.activeElement).toBe(dialog.querySelectorAll('button')[2]);
  });

  it('holds focus rather than letting it escape when nothing is focusable', () => {
    const dialog = dialogWith(0);
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    trapTab(event, dialog);
    expect(event.defaultPrevented).toBe(true);
  });
});
