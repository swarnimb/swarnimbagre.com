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
        accent: 'var(--admin-accent)',
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
