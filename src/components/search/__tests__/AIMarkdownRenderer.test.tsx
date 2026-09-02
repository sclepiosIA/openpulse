import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AIMarkdownRenderer } from '../AIMarkdownRenderer';

// Mock hover card components
vi.mock('../AIEmailHoverCard', () => ({ AIEmailHoverCard: ({ children }: any) => <>{children}</> }));
vi.mock('../AIEstablishmentHoverCard', () => ({ AIEstablishmentHoverCard: ({ children }: any) => <>{children}</> }));
vi.mock('../AIContactHoverCard', () => ({ AIContactHoverCard: ({ children }: any) => <>{children}</> }));
vi.mock('../AITaskHoverCard', () => ({ AITaskHoverCard: ({ children }: any) => <>{children}</> }));
vi.mock('../AIEventHoverCard', () => ({ AIEventHoverCard: ({ children }: any) => <>{children}</> }));

describe('AIMarkdownRenderer', () => {
  const wrap = (content: string, onLinkClick?: () => void) =>
    render(
      <MemoryRouter>
        <AIMarkdownRenderer content={content} onLinkClick={onLinkClick} />
      </MemoryRouter>
    );

  it('renders simple text', () => {
    wrap('Hello world');
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders bold text', () => {
    wrap('**important**');
    expect(screen.getByText('important')).toBeInTheDocument();
  });

  it('renders headings', () => {
    wrap('# Title');
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('renders code blocks', () => {
    wrap('`code`');
    expect(screen.getByText('code')).toBeInTheDocument();
  });

  it('renders external links with target blank', () => {
    wrap('[Google](https://google.com)');
    const link = screen.getByText('Google').closest('a');
    expect(link).toHaveAttribute('href', 'https://google.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders lists', () => {
    wrap('- Item 1\n- Item 2');
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders blockquotes', () => {
    wrap('> Quote text');
    expect(screen.getByText('Quote text')).toBeInTheDocument();
  });
});
