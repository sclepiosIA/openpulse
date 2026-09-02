import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EtablissementDocumentFolder } from '../EtablissementDocumentFolder';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etab = {
  id: 'e1', nom: 'CHU Lyon', ville: 'Lyon',
  logo_url: null, etablissement_logo_url: null,
  groupe_logo_url: null, groupe_nom: 'Groupe A',
  statut: 'production', document_count: 15,
};

const wrap = (ui: React.ReactElement) => <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;

describe('EtablissementDocumentFolder', () => {
  it('renders etablissement name', () => {
    render(wrap(<EtablissementDocumentFolder etablissement={etab} onClick={vi.fn()} />));
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders document count', () => {
    render(wrap(<EtablissementDocumentFolder etablissement={etab} onClick={vi.fn()} />));
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(wrap(<EtablissementDocumentFolder etablissement={etab} onClick={vi.fn()} />));
    expect(screen.getByText('Production')).toBeInTheDocument();
  });
});
