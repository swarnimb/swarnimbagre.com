import type { Config } from 'tailwindcss';
import { scopedPreflightStyles, isolateInsideOfContainer } from 'tailwindcss-scoped-preflight';

const config: Config = {
  content: [
    './app/(admin)/**/*.{ts,tsx}',
    './components/admin/**/*.{ts,tsx}',
    './components/ui/**/*.{ts,tsx}',
  ],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        bg: 'var(--admin-bg)',
        surface: 'var(--admin-surface)',
        fg: 'var(--admin-fg)',

        /* Shadcn semantic slots mapped to admin tokens (2026-05-12) */
        background: 'var(--admin-bg)',
        foreground: 'var(--admin-fg)',
        border: 'var(--admin-border)',
        input: 'var(--admin-border)',
        ring: 'var(--admin-accent)',
        card: {
          DEFAULT: 'var(--admin-surface)',
          foreground: 'var(--admin-fg)',
        },
        popover: {
          DEFAULT: 'var(--admin-surface)',
          foreground: 'var(--admin-fg)',
        },
        primary: {
          DEFAULT: 'var(--admin-accent)',
          foreground: 'var(--admin-bg)',
        },
        secondary: {
          DEFAULT: 'var(--admin-surface)',
          foreground: 'var(--admin-fg)',
        },
        muted: {
          DEFAULT: 'var(--admin-surface)',
          foreground: 'var(--admin-muted-fg)',
        },
        accent: {
          DEFAULT: 'var(--admin-surface)',
          foreground: 'var(--admin-fg)',
        },
        destructive: {
          DEFAULT: 'var(--admin-destructive)',
          foreground: 'var(--admin-destructive-fg)',
        },
      },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [
    scopedPreflightStyles({
      isolationStrategy: isolateInsideOfContainer('.admin-root'),
    }),
  ],
};

export default config;
