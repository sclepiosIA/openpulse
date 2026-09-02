import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TresoreriePrevisionnelTab } from '../TresoreriePrevisionnelTab';

vi.mock('../previsionnel/PrevisionnelSubTabs', () => ({
  PrevisionnelSubTabs: ({ value, onValueChange }: any) => (
    <div data-testid="sub-tabs">
      <button onClick={() => onValueChange('resume')}>Résumé</button>
      <button onClick={() => onValueChange('jour')}>Jour</button>
      <button onClick={() => onValueChange('previsionnel')}>Prévisionnel</button>
    </div>
  ),
}));

vi.mock('../previsionnel/PrevisionnelResume', () => ({
  PrevisionnelResume: () => <div data-testid="previsionnel-resume">Résumé content</div>,
}));

vi.mock('../previsionnel/TresorerieJour', () => ({
  TresorerieJour: () => <div data-testid="tresorerie-jour">Jour content</div>,
}));

vi.mock('../TresorerieAnalyseTab', () => ({
  TresorerieAnalyseTab: () => <div data-testid="analyse-tab">Analyse content</div>,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('TresoreriePrevisionnelTab', () => {
  it('renders sub-tabs', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresoreriePrevisionnelTab />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('sub-tabs')).toBeInTheDocument();
  });

  it('renders resume tab by default', () => {
    render(
      <QueryClientProvider client={qc}>
        <TresoreriePrevisionnelTab />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('previsionnel-resume')).toBeInTheDocument();
  });
});
