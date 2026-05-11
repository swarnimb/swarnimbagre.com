export type SocialKind = 'email' | 'x' | 'linkedin' | 'reddit' | 'substack' | 'youtube';

export const SOCIAL_LINKS: Record<SocialKind, string> = {
  email: 'mailto:bagreswarnim@gmail.com',
  x: 'https://x.com/BagreSwarnim',
  linkedin: 'https://www.linkedin.com/in/swarnim-bagre/',
  reddit: 'https://www.reddit.com/user/SwarnimBagre/',
  substack: 'https://substack.com/@swarnimbagre',
  youtube: '#',
};
