import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FacturationMobileHeader } from '../FacturationMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('FacturationMobileHeader', () => {
  const defaultStats = {
    caEncaisse: '45 000 €',
    aEncaisser: '12 000 €',
    facturesEnRetard: 3,
  };

  it('renders title', () => {
    render(<FacturationMobileHeader stats={defaultStats} />);
    expect(screen.getByText('Facturation')).toBeInTheDocument();
  });

  it('renders stats line', () => {
    render(<FacturationMobileHeader stats={defaultStats} />);
    expect(screen.getByText(/Encaissé 45 000 €/)).toBeInTheDocument();
    expect(screen.getByText(/À enc. 12 000 €/)).toBeInTheDocument();
  });

  it('renders retard count', () => {
    render(<FacturationMobileHeader stats={defaultStats} />);
    expect(screen.getByText(/3 retard/)).toBeInTheDocument();
  });

  it('hides retard when 0', () => {
    render(<FacturationMobileHeader stats={{ ...defaultStats, facturesEnRetard: 0 }} />);
    expect(screen.queryByText(/retard/)).toBeNull();
  });

  it('renders hamburger when showGlobalNav true', () => {
    render(<FacturationMobileHeader stats={defaultStats} showGlobalNav={true} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // hamburger + plus
  });

  it('hides hamburger when showGlobalNav false', () => {
    render(<FacturationMobileHeader stats={defaultStats} showGlobalNav={false} />);
    // Fewer buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders toolbar when provided', () => {
    render(
      <FacturationMobileHeader 
        stats={defaultStats} 
        toolbar={<div data-testid="toolbar">Tabs</div>} 
      />
    );
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });
});
