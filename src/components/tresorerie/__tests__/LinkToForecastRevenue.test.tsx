import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LinkToForecastRevenue } from '../LinkToForecastRevenue';

describe('LinkToForecastRevenue', () => {
  const credit = {
    id: 'op1',
    montant: 5000,
    date_operation: '2026-03-01',
    reference: 'VIR-001',
    contrepartie: 'CHU Lyon',
    statut: 'completed',
    linked_recette_ids: [] as string[],
  };

  const forecastRevenus = [
    {
      id: 'r1',
      mois: '2026-03',
      montant_prevu: 5000,
      montant_paye: null,
      statut: 'prevu',
      etablissement_nom: 'CHU Lyon',
      notes: null,
    },
  ];

  it('renders link button', () => {
    const { container } = render(
      <LinkToForecastRevenue
        credit={credit as any}
        forecastRevenus={forecastRevenus as any}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
        isLinking={false}
      />
    );
    expect(container.querySelector('button')).toBeInTheDocument();
  });
});
