import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ProjectMedia } from '@/components/public/ProjectMedia';

afterEach(() => {
  cleanup();
});

describe('ProjectMedia — branching on URL props', () => {
  it('renders before/after slider when both imageUrl and imageAfterUrl are present', () => {
    const { container } = render(
      <ProjectMedia
        imageUrl="https://example.com/before.jpg"
        imageAfterUrl="https://example.com/after.jpg"
        title="tennis-elbow"
      />,
    );
    // BeforeAfterMedia renders the draggable wrapper with cursor:ew-resize.
    const slider = container.querySelector('[style*="ew-resize"]');
    expect(slider).not.toBeNull();
    // Both images render — before and after.
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toBe('https://example.com/before.jpg');
    expect(images[1].getAttribute('src')).toBe('https://example.com/after.jpg');
  });

  it('renders a single still <img> when only imageUrl is present', () => {
    const { container } = render(
      <ProjectMedia imageUrl="https://example.com/only.jpg" title="putt-or-not" />,
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('https://example.com/only.jpg');
    expect(images[0].getAttribute('alt')).toBe('putt-or-not');
  });

  it('renders nothing when neither URL is present', () => {
    const { container } = render(<ProjectMedia title="agentless" />);
    expect(container.firstChild).toBeNull();
  });

  it('falls back to still <img> when imageAfterUrl is set without imageUrl (defensive)', () => {
    // The slider requires both URLs. With only after, the still branch
    // returns null because primary imageUrl is absent.
    const { container } = render(
      <ProjectMedia imageAfterUrl="https://example.com/after.jpg" title="drumlog" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('uses the project title as the alt attribute on the still image', () => {
    const { container } = render(
      <ProjectMedia imageUrl="https://example.com/x.jpg" title="afford.lunch" />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('afford.lunch');
  });
});
