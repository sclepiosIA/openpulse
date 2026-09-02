import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { JarvisSourceBadge } from '../JarvisSourceBadge';
import type { JarvisKBSource } from '@/types/jarvis';

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

const makeSource = (overrides: Partial<JarvisKBSource> = {}): JarvisKBSource => ({
  id: 's1',
  titre: 'Guide utilisateur',
  base_type: 'solution',
  excerpt: 'Ceci est un extrait de documentation...',
  relevance_score: 0.95,
  ...overrides,
} as JarvisKBSource);

describe('JarvisSourceBadge', () => {
  it('renders compact badge with label', () => {
    wrap(<JarvisSourceBadge source={makeSource()} compact />);
    expect(screen.getByText('Solution')).toBeInTheDocument();
  });

  it('renders full badge with title', () => {
    wrap(<JarvisSourceBadge source={makeSource()} />);
    expect(screen.getByText('Guide utilisateur')).toBeInTheDocument();
    expect(screen.getByText('Solution')).toBeInTheDocument();
  });

  it('renders excerpt in full mode', () => {
    wrap(<JarvisSourceBadge source={makeSource()} />);
    expect(screen.getByText('Ceci est un extrait de documentation...')).toBeInTheDocument();
  });

  it('renders internal type', () => {
    wrap(<JarvisSourceBadge source={makeSource({ base_type: 'internal' })} compact />);
    expect(screen.getByText('Interne')).toBeInTheDocument();
  });

  it('renders internal type', () => {
    wrap(<JarvisSourceBadge source={makeSource({ base_type: 'internal', titre: 'Doc interne' })} compact />);
    expect(screen.getByText('Interne')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = wrap(<JarvisSourceBadge source={makeSource()} onClick={onClick} />);
    container.querySelector('[class*="rounded-xl"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalled();
  });
});
