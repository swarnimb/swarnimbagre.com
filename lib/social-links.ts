export type SocialKind =
  | 'email'
  | 'github'
  | 'x'
  | 'linkedin'
  | 'reddit'
  | 'substack'
  | 'youtube';

/**
 * Single source of truth for every off-site link.
 *
 * Only the three in HOME_SOCIALS (components/public/home/SocialIcons.tsx) are
 * rendered today; the rest are kept here so adding one later is a display
 * change rather than a data hunt.
 *
 * NOTE (T46, 2026-08-04): the linkedin slug is `swarnim-bagre`, hyphenated.
 * Confirmed by the builder after a conflicting unhyphenated value came up
 * mid-session. Do not "tidy" the hyphen away.
 */
export const SOCIAL_LINKS: Record<SocialKind, string> = {
  email: 'mailto:bagreswarnim@gmail.com',
  github: 'https://github.com/swarnimb',
  x: 'https://x.com/BagreSwarnim',
  linkedin: 'https://www.linkedin.com/in/swarnim-bagre/',
  reddit: 'https://www.reddit.com/user/SwarnimBagre/',
  substack: 'https://substack.com/@swarnimbagre',
  youtube: '#',
};
