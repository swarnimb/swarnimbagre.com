import { renderMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  it('parses basic Markdown', () => {
    const output = renderMarkdown('**bold**');
    expect(output).toContain('<strong>bold</strong>');
  });

  it('strips <script> tags', () => {
    const output = renderMarkdown('hello <script>alert(1)</script> world');
    expect(output).not.toContain('<script');
  });

  it('strips inline event handlers', () => {
    const output = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(output).not.toContain('onerror');
  });

  it('strips javascript: protocol on links', () => {
    const output = renderMarkdown('[click](javascript:alert(1))');
    expect(output).not.toContain('javascript:');
  });

  it('preserves https: links', () => {
    const output = renderMarkdown('[ok](https://example.com)');
    expect(output).toContain('href="https://example.com"');
  });

  it('renders without errors when md is empty', () => {
    expect(() => renderMarkdown('')).not.toThrow();
  });
});
