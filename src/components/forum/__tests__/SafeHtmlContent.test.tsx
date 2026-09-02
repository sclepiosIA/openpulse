import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SafeHtmlContent } from '../SafeHtmlContent';

describe('SafeHtmlContent', () => {
  it('renders safe HTML content', () => {
    render(<SafeHtmlContent html="<p>Hello <strong>World</strong></p>" />);
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('strips script tags', () => {
    const { container } = render(<SafeHtmlContent html='<p>Safe</p><script>alert("xss")</script>' />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('strips onclick attributes', () => {
    const { container } = render(<SafeHtmlContent html='<p onclick="alert(1)">Click</p>' />);
    expect(container.querySelector('[onclick]')).toBeNull();
  });

  it('allows links with href', () => {
    const { container } = render(<SafeHtmlContent html='<a href="https://example.com">Link</a>' />);
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute('href')).toBe('https://example.com');
  });

  it('strips iframe tags', () => {
    const { container } = render(<SafeHtmlContent html='<iframe src="evil.com"></iframe><p>OK</p>' />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SafeHtmlContent html="<p>Test</p>" className="my-class" />);
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });
});
