import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';

/**
 * T41 — `app/robots.ts`.
 *
 * `robots()` is pure, synchronous, and takes no arguments, so it has no
 * throwing failure mode to exercise. Its real failure mode is a WRONG but
 * perfectly valid document: a robots.txt that indexes the admin panel, or one
 * whose `Sitemap:` line is relative (crawlers silently ignore a relative
 * sitemap directive — nothing errors, the sitemap just never gets read). The
 * "error case" group below covers exactly those, which is the useful reading
 * of TS-01 here.
 */

const SITE_ORIGIN = 'https://swarnimbagre.com';

/** Normalize the `disallow` field, which the type allows to be a bare string. */
function disallowList(rules: ReturnType<typeof robots>['rules']): string[] {
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = rule?.disallow ?? [];
  return Array.isArray(disallow) ? disallow : [disallow];
}

describe('robots()', () => {
  describe('happy path', () => {
    it('allows every crawler at the site root', () => {
      const result = robots();
      const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

      expect(rule?.userAgent).toBe('*');
      expect(rule?.allow).toBe('/');
    });

    it('points at the absolute sitemap URL', () => {
      const result = robots();

      expect(result.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
      expect(result.host).toBe(SITE_ORIGIN);
    });
  });

  describe('misconfiguration guards', () => {
    it('disallows the admin panel and the API surface', () => {
      const disallow = disallowList(robots().rules);

      expect(disallow).toContain('/admin');
      expect(disallow).toContain('/api');
    });

    it('never allows a private prefix through the allow directive', () => {
      const result = robots();
      const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
      const allow = Array.isArray(rule?.allow) ? rule.allow : [rule?.allow];

      expect(allow).not.toContain('/admin');
      expect(allow).not.toContain('/api');
    });

    it('does not emit a relative sitemap directive', () => {
      const sitemap = robots().sitemap;
      const first = Array.isArray(sitemap) ? sitemap[0] : sitemap;

      expect(typeof first).toBe('string');
      expect(String(first).startsWith('https://')).toBe(true);
    });
  });
});
