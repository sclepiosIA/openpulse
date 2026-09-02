import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RDMobileHeader } from '@/components/rd/RDMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn(), close: vi.fn() }),
}));

describe('RDMobileHeader', () => {
  const defaultProps = {
    onSearchClick: vi.fn(),
    onCreateProject: vi.fn(),
    onImport: vi.fn(),
  };

  it('should render R&D title', () => {
    render(<RDMobileHeader {...defaultProps} />);
    expect(screen.getByText('R&D')).toBeInTheDocument();
  });

  it('should render default subtitle without project', () => {
    render(<RDMobileHeader {...defaultProps} />);
    expect(screen.getByText('Gestion agile des projets')).toBeInTheDocument();
  });

  it('should render project name when provided', () => {
    render(<RDMobileHeader {...defaultProps} currentProjet={{ nom: 'Mon Projet', statut: 'actif' }} />);
    expect(screen.getByText('Mon Projet')).toBeInTheDocument();
  });

  it('should render project status badge', () => {
    render(<RDMobileHeader {...defaultProps} currentProjet={{ nom: 'P1', statut: 'actif' }} />);
    expect(screen.getByText('actif')).toBeInTheDocument();
  });

  it('should render toolbar when provided', () => {
    render(<RDMobileHeader {...defaultProps} toolbar={<div data-testid="toolbar">TB</div>} />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should render project selector when provided', () => {
    render(<RDMobileHeader {...defaultProps} projectSelector={<div data-testid="selector">PS</div>} />);
    expect(screen.getByTestId('selector')).toBeInTheDocument();
  });
});
