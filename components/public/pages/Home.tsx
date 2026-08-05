'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { FindMeHere } from '@/components/public/home/SocialIcons';

/**
 * Home - the conversation page.
 *
 * The chat is deliberately fake. There is no model, no API route and no
 * history: submitting swaps in a single canned exchange and nothing else.
 * That is the joke, and the deflection copy admits it rather than pretending
 * otherwise. Repeated submits rotate through DEFLECTIONS by index rather than
 * at random, so the behaviour stays deterministic and testable.
 *
 * Copy note: everything here is first person, as is every other page's copy.
 * The design export's third-person bio was the odd one out, not the rule.
 */

const QUESTION = 'is this another portfolio site?';

const EMPTY_SUBMIT_FALLBACK = 'tell me more';

const DEFLECTIONS = [
  'I am not rich enough to put a real API endpoint on a personal site, so this box does nothing. The icons above actually work, though.',
  'You think I would waste my tokens on this? The links above go to an actual human.',
  'Nice try. There is no model behind this, just a few answers I typed in advance.',
] as const;

const NAV_BUTTONS = [
  { label: 'See the projects', href: '/projects', fill: true },
  { label: 'Writing', href: '/writing', fill: false },
  { label: 'Other', href: '/other', fill: false },
] as const;

function Avatar() {
  return (
    <div className="h-avatar" aria-hidden="true">
      S
    </div>
  );
}

function SendGlyph() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

export function Home() {
  const [asked, setAsked] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  const [draft, setDraft] = useState('');

  function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAsked(draft.trim() || EMPTY_SUBMIT_FALLBACK);
    setTurn((n) => n + 1);
    setDraft('');
  }

  // `turn` is 1-based once a submit has happened; clamp so the first reply
  // reads index 0 rather than wrapping to the end of the pool.
  const deflection = DEFLECTIONS[(Math.max(turn, 1) - 1) % DEFLECTIONS.length];

  return (
    <div className="hpage">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link href="/" className="h-word" style={{ color: 'var(--fg-strong)' }}>
          Swarnim Bagre
        </Link>
      </header>

      <div className="h-conv">
        <div className="h-qbubble">{QUESTION}</div>

        <div className="h-arow">
          <Avatar />
          <div style={{ flex: 1 }}>
            <div className="h-bio">
              <b>Yes, another one.</b> I do product and strategy at Dell by day,
              AI tinkering by night.
              <br />
              None of it is a business: no revenue model, no growth strategy,
              just answers to &ldquo;why not.&rdquo;
            </div>

            <div className="h-actions">
              {NAV_BUTTONS.map((button) => (
                <Link
                  key={button.href}
                  href={button.href}
                  className={`h-btn ${
                    button.fill ? 'h-btn--fill' : 'h-btn--outline'
                  }`}
                >
                  {button.label}
                </Link>
              ))}
            </div>

            <FindMeHere />
          </div>
        </div>

        {asked !== null && (
          <>
            <div className="h-qbubble">{asked}</div>
            <div className="h-arow">
              <Avatar />
              <div className="h-reply">{deflection}</div>
            </div>
          </>
        )}
      </div>

      <form className="h-form" onSubmit={submitChat}>
        <input
          className="h-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a follow-up…"
          aria-label="Ask a follow-up"
        />
        <button className="h-send" type="submit" aria-label="Send">
          <SendGlyph />
        </button>
      </form>
    </div>
  );
}
