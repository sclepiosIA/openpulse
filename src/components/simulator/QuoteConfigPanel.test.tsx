/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuoteConfigPanel } from './QuoteConfigPanel';

const { CENTER_TYPES, DPI_TYPES, RESELLER_TYPES, formatEuro } = vi.hoisted(() => ({
  CENTER_TYPES: [
    { id: 'hospital', name: 'Centre hospitalier', prixPAU: 12 },
    { id: 'clinic', name: 'Clinique', prixPAU: 18 },
  ],
  DPI_TYPES: [
    { id: 'none', name: 'Sans DPI', baseFrais: 0 },
    { id: 'advanced', name: 'DPI avancé', baseFrais: 2500 },
  ],
  RESELLER_TYPES: [
    { id: 'silver', name: 'Silver Partner', markup: 0.1 },
    { id: 'gold', name: 'Gold Partner', markup: 0.2 },
  ],
  formatEuro: (value: number) => `${value.toLocaleString('fr-FR')} €`,
}));

vi.mock('@/lib/simulator-config', () => ({
  CENTER_TYPES,
  DPI_TYPES,
  RESELLER_TYPES,
  formatEuro,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-label="Revendeur partenaire"
      onClick={() => onCheckedChange?.(!checked)}
    >
      reseller-switch
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Building: () => <svg data-testid="icon-building" />,
  FileText: () => <svg data-testid="icon-filetext" />,
  Users: () => <svg data-testid="icon-users" />,
  Layers: () => <svg data-testid="icon-layers" />,
  Check: () => <svg data-testid="icon-check" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
}));

type QuoteConfiguration = {
  valorisationLevel: 'premier' | 'second';
  centerType: { id: string; name: string; prixPAU: number };
  dpiType: { id: string; name: string; baseFrais: number };
  resellerType: { id: string; name: string; markup: number } | null;
};

describe('QuoteConfigPanel', () => {
  const baseConfiguration: QuoteConfiguration = {
    valorisationLevel: 'second',
    centerType: CENTER_TYPES[0],
    dpiType: DPI_TYPES[0],
    resellerType: RESELLER_TYPES[1],
  };

  it('renders nothing when configuration is null', () => {
    const { container } = render(
      <QuoteConfigPanel configuration={null} onUpdateConfiguration={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the current business values from configuration', () => {
    render(
      <QuoteConfigPanel
        configuration={baseConfiguration}
        onUpdateConfiguration={vi.fn()}
      />
    );

    expect(screen.getByText('Configuration du devis')).toBeInTheDocument();
    expect(screen.getByText('Second niveau')).toBeInTheDocument();
    expect(screen.getByText('Recommandé')).toBeInTheDocument();
    expect(screen.getByText('Centre hospitalier')).toBeInTheDocument();
    expect(screen.getByText('12€/PAU')).toBeInTheDocument();
    expect(screen.getByText('Sans DPI')).toBeInTheDocument();
    expect(screen.getByText(formatEuro(0))).toBeInTheDocument();
    expect(screen.getByText('Gold Partner')).toBeInTheDocument();
    expect(screen.getByText('+20%')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Revendeur partenaire' })).toHaveAttribute('aria-checked', 'true');
  });

  it('updates valorisation level when clicking premier niveau', () => {
    const onUpdateConfiguration = vi.fn();

    render(
      <QuoteConfigPanel
        configuration={baseConfiguration}
        onUpdateConfiguration={onUpdateConfiguration}
      />
    );

    fireEvent.click(screen.getByText('Premier niveau'));

    expect(onUpdateConfiguration).toHaveBeenCalledWith({
      valorisationLevel: 'premier',
    });
  });

  it('updates center type with the selected business object', () => {
    const onUpdateConfiguration = vi.fn();

    render(
      <QuoteConfigPanel
        configuration={baseConfiguration}
        onUpdateConfiguration={onUpdateConfiguration}
      />
    );

    fireEvent.click(screen.getByText('Clinique'));

    expect(onUpdateConfiguration).toHaveBeenCalledWith({
      centerType: CENTER_TYPES[1],
    });
  });

  it('updates dpi type with the selected business object', () => {
    const onUpdateConfiguration = vi.fn();

    render(
      <QuoteConfigPanel
        configuration={baseConfiguration}
        onUpdateConfiguration={onUpdateConfiguration}
      />
    );

    fireEvent.click(screen.getByText('DPI avancé'));

    expect(onUpdateConfiguration).toHaveBeenCalledWith({
      dpiType: DPI_TYPES[1],
    });
  });

  it('disables reseller and clears resellerType when switch is turned off', () => {
    const onUpdateConfiguration = vi.fn();

    render(
      <QuoteConfigPanel
        configuration={baseConfiguration}
        onUpdateConfiguration={onUpdateConfiguration}
      />
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Revendeur partenaire' }));

    expect(onUpdateConfiguration).toHaveBeenCalledWith({
      resellerType: null,
    });
    expect(screen.queryByText('Silver Partner')).not.toBeInTheDocument();
    expect(screen.queryByText('Gold Partner')).not.toBeInTheDocument();
  });

  it('enables reseller and defaults to the first reseller type when initially absent', () => {
    const onUpdateConfiguration = vi.fn();
    const configurationWithoutReseller: QuoteConfiguration = {
      ...baseConfiguration,
      resellerType: null,
    };

    render(
      <QuoteConfigPanel
        configuration={configurationWithoutReseller}
        onUpdateConfiguration={onUpdateConfiguration}
      />
    );

    const switchButton = screen.getByRole('switch', { name: 'Revendeur partenaire' });
    expect(switchButton).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByText('Silver Partner')).not.toBeInTheDocument();

    fireEvent.click(switchButton);

    expect(onUpdateConfiguration).toHaveBeenCalledWith({
      resellerType: RESELLER_TYPES[0],
    });
    expect(screen.getByText('Silver Partner')).toBeInTheDocument();
    expect(screen.getByText('+10%')).toBeInTheDocument();
  });

  it('updates reseller type when clicking a reseller option', () => {
    const onUpdateConfiguration = vi.fn();

    render(
      <QuoteConfigPanel
        configuration={{
          ...baseConfiguration,
          resellerType: RESELLER_TYPES[0],
        }}
        onUpdateConfiguration={onUpdateConfiguration}
      />
    );

    fireEvent.click(screen.getByText('Gold Partner'));

    expect(onUpdateConfiguration).toHaveBeenCalledWith({
      resellerType: RESELLER_TYPES[1],
    });
  });
});