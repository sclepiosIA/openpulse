import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/card', async () => {
  const ReactMod = await import('react');
  const make = (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      ReactMod.createElement('div', { 'data-testid': testId }, children);
  return {
    Card: make('card'),
    CardContent: make('card-content'),
    CardHeader: make('card-header'),
    CardTitle: make('card-title'),
  };
});

vi.mock('@/components/ui/progress', async () => {
  const ReactMod = await import('react');
  return {
    Progress: ({ value }: { value?: number }) =>
      ReactMod.createElement('div', {
        'data-testid': 'progress',
        'data-value': String(value),
      }),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

import { ForecastKPIs } from './ForecastKPIs';
import type { ForecastKpis, ForecastPreviousPeriod } from '@/hooks/crm/useSalesForecast';

const normalize = (s: string) => s.replace(/[\u202F\u00A0]/g, ' ');

const currencyMatcher = (expected: string) => (content: string) =>
  normalize(content) === expected;

const spanTextMatcher = (expected: string) => (_: string, el: Element | null) =>
  el !== null && el.tagName === 'SPAN' && normalize(el.textContent ?? '') === expected;

const KPIS = {
  pipeline_raw: 120000,
  pipeline_weighted: 50000,
  current_quarter: 30000,
  current_quarter_target: 60000,
  won_total: 10000,
} as ForecastKpis;

const PREVIOUS = {
  pipeline_raw: 100000,
  pipeline_weighted: 50000,
  won_total: 0,
} as ForecastPreviousPeriod;

describe('ForecastKPIs', () => {
  it('affiche les 4 cartes avec libellés et valeurs formatées en EUR', () => {
    render(<ForecastKPIs kpis={KPIS} />);

    expect(screen.getByText('Pipeline brut')).toBeTruthy();
    expect(screen.getByText('Pipeline pondéré')).toBeTruthy();
    expect(screen.getByText('Forecast trimestre courant')).toBeTruthy();
    expect(screen.getByText('Gagné (cumulé)')).toBeTruthy();

    expect(screen.getByText(currencyMatcher('120 000 €'))).toBeTruthy();
    expect(screen.getByText(currencyMatcher('50 000 €'))).toBeTruthy();
    expect(screen.getByText(currencyMatcher('30 000 €'))).toBeTruthy();
    expect(screen.getByText(currencyMatcher('10 000 €'))).toBeTruthy();

    expect(screen.getByText('Somme des opportunités non gagnées')).toBeTruthy();
    expect(screen.getByText('Valeur × probabilité de closing')).toBeTruthy();
    expect(screen.getByText('Deals 100% (production / vendu)')).toBeTruthy();
  });

  it('affiche les deltas : hausse en %, stable, et "Nouveau" quand previous=0', () => {
    render(<ForecastKPIs kpis={KPIS} previous={PREVIOUS} />);

    // pipeline_raw : (120000 - 100000) / 100000 = +20%
    expect(screen.getByText(spanTextMatcher('+20%'))).toBeTruthy();
    // pipeline_weighted : 50000 vs 50000 → stable
    expect(screen.getByText('stable')).toBeTruthy();
    // won_total : previous 0, current 10000 → Nouveau
    expect(screen.getByText('Nouveau')).toBeTruthy();
  });

  it('affiche un delta négatif quand la valeur baisse', () => {
    const previous = {
      pipeline_raw: 200000,
      pipeline_weighted: 50000,
      won_total: 0,
    } as ForecastPreviousPeriod;

    render(<ForecastKPIs kpis={KPIS} previous={previous} />);

    // (120000 - 200000) / 200000 = -40%
    expect(screen.getByText(spanTextMatcher('-40%'))).toBeTruthy();
  });

  it('affiche la progression vers l’objectif trimestriel quand un target > 0 est défini', () => {
    render(<ForecastKPIs kpis={KPIS} />);

    // 30000 / 60000 = 50%
    const progress = screen.getByTestId('progress');
    expect(progress.getAttribute('data-value')).toBe('50');

    expect(screen.getByText(currencyMatcher('Objectif 60 000 €'))).toBeTruthy();
  });

  it('plafonne la progression à 100 quand le forecast dépasse l’objectif', () => {
    const kpis = {
      ...KPIS,
      current_quarter: 90000,
      current_quarter_target: 60000,
    } as ForecastKpis;

    render(<ForecastKPIs kpis={kpis} />);

    const progress = screen.getByTestId('progress');
    expect(progress.getAttribute('data-value')).toBe('100');
  });

  it('n’affiche pas de barre de progression et montre le hint par défaut quand target = 0', () => {
    const kpis = { ...KPIS, current_quarter_target: 0 } as ForecastKpis;

    render(<ForecastKPIs kpis={kpis} />);

    expect(screen.queryByTestId('progress')).toBeNull();
    expect(screen.getByText('Pondéré, closing prévu Q en cours')).toBeTruthy();
  });

  it('n’affiche aucun delta quand previous est absent', () => {
    render(<ForecastKPIs kpis={KPIS} />);

    expect(screen.queryByText('Nouveau')).toBeNull();
    expect(screen.queryByText('stable')).toBeNull();
    expect(screen.queryByText(spanTextMatcher('+20%'))).toBeNull();
  });

  it('formate les valeurs nulles ou à zéro en 0 €', () => {
    const kpis = {
      pipeline_raw: 0,
      pipeline_weighted: 0,
      current_quarter: 0,
      current_quarter_target: 0,
      won_total: 0,
    } as ForecastKpis;

    render(<ForecastKPIs kpis={kpis} />);

    const zeros = screen.getAllByText(currencyMatcher('0 €'));
    expect(zeros).toHaveLength(4);
  });
});