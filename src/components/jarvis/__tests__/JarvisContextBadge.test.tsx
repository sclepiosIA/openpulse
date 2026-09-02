import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JarvisContextBadge } from '../JarvisContextBadge';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/jarvis/useJarvisFocus', () => ({
  useJarvisFocus: () => ({
    focusContext: { etablissement_id: null },
  }),
}));

const wrap = (ui: React.ReactElement, path = '/') =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe('JarvisContextBadge', () => {
  it('renders Contexte label', () => {
    wrap(<JarvisContextBadge />);
    expect(screen.getByText('Contexte:')).toBeInTheDocument();
  });

  it('shows Dashboard on root path', () => {
    wrap(<JarvisContextBadge />, '/');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows CRM on etablissements path', () => {
    wrap(<JarvisContextBadge />, '/etablissements');
    expect(screen.getByText('CRM')).toBeInTheDocument();
  });

  it('shows Emails on emails path', () => {
    wrap(<JarvisContextBadge />, '/emails');
    expect(screen.getByText('Emails')).toBeInTheDocument();
  });

  it('shows Équipe on people path', () => {
    wrap(<JarvisContextBadge />, '/people');
    expect(screen.getByText('Équipe')).toBeInTheDocument();
  });

  it('shows Trésorerie on tresorerie path', () => {
    wrap(<JarvisContextBadge />, '/tresorerie');
    expect(screen.getByText('Trésorerie')).toBeInTheDocument();
  });

  it('shows R&D on rd path', () => {
    wrap(<JarvisContextBadge />, '/rd');
    expect(screen.getByText('R&D')).toBeInTheDocument();
  });

  it('shows Support on support path', () => {
    wrap(<JarvisContextBadge />, '/support');
    expect(screen.getByText('Support')).toBeInTheDocument();
  });
});
