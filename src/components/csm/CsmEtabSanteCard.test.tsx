/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent, renderHook } from '@testing-library/react';
import { CsmEtabSanteCard } from './CsmEtabSanteCard';

const {
  AUTH_STATE,
  SANTE_SUCCESS,
  KPI_TRIM_SUCCESS,
  KPI_MENS_SUCCESS,
  ETAB_SUCCESS,
  ETAB_ERROR,
  mockFrom,
  mockUseCsmSante,
  mockUseCsmKpisTrimestriels,
  mockUseCsmKpisMensuels,
  editableCellProps,
  editableSelectCellProps,
  weatherSelectCellProps,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  SANTE_SUCCESS: {
    id: 's1',
    etablissement_id: 'etab-1',
    weather: 'sunny',
    taux_utilisation_trend: 'up',
    taux_uhcd_trend: 'down',
    taux_uhcd: 78,
    objectif_eme: '85%',
  },
  KPI_TRIM_SUCCESS: [
    { id: 't1', sort_order: 1, taux_satisfaction: 88 },
    { id: 't2', sort_order: 2, taux_satisfaction: 91 },
  ],
  KPI_MENS_SUCCESS: [
    {
      id: 'm1',
      sort_order: 2,
      passages_total: 100,
      dossiers_traites: 60,
      taux_uhcd_backend: 42,
      taux_uhcd_compte: 39,
    },
    {
      id: 'm2',
      sort_order: 1,
      passages_total: 200,
      dossiers_traites: 150,
      taux_uhcd_backend: 55,
      taux_uhcd_compte: 52,
    },
  ],
  ETAB_SUCCESS: {
    besoins_du_compte: 'standard',
    seuils_palliers: {
      palier_1: 20,
      palier_2: 40,
      palier_3: 60,
      palier_4: 80,
    },
  },
  ETAB_ERROR: { message: 'x' },
  mockFrom: vi.fn(),
  mockUseCsmSante: vi.fn(),
  mockUseCsmKpisTrimestriels: vi.fn(),
  mockUseCsmKpisMensuels: vi.fn(),
  editableCellProps: [] as Array<{ value: unknown; onSave: (value: unknown) => void }>,
  editableSelectCellProps: [] as Array<{ value: unknown; onSave: (value: unknown) => void }>,
  weatherSelectCellProps: [] as Array<{ value: unknown; onSave: (value: unknown) => void }>,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value ?? 0)} className={className} />
  ),
}));

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: ({ value, onSave }: { value: unknown; onSave: (value: unknown) => void }) => {
    editableCellProps.push({ value, onSave });
    return <button data-testid="editable-cell" onClick={() => onSave('90%')}>{String(value ?? '—')}</button>;
  },
}));

vi.mock('@/components/csm/EditableSelectCell', () => ({
  EditableSelectCell: ({ value, onSave }: { value: unknown; onSave: (value: unknown) => void }) => {
    editableSelectCellProps.push({ value, onSave });
    return <button data-testid="editable-select-cell" onClick={() => onSave('stable')}>{String(value)}</button>;
  },
}));

vi.mock('@/components/csm/WeatherSelectCell', () => ({
  WeatherSelectCell: ({ value, onSave }: { value: unknown; onSave: (value: unknown) => void }) => {
    weatherSelectCellProps.push({ value, onSave });
    return <button data-testid="weather-select-cell" onClick={() => onSave('cloudy')}>{String(value)}</button>;
  },
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/csm/useCsmSante', () => ({
  useCsmSante: mockUseCsmSante,
}));

vi.mock('@/hooks/csm/useCsmKpisTrimestriels', () => ({
  useCsmKpisTrimestriels: mockUseCsmKpisTrimestriels,
}));

vi.mock('@/hooks/csm/useCsmKpisMensuels', () => ({
  useCsmKpisMensuels: mockUseCsmKpisMensuels,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Heart: Icon,
    Info: Icon,
    Activity: Icon,
    Users: Icon,
    Target: Icon,
    Layers: Icon,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('CsmEtabSanteCard', () => {
  beforeEach(() => {
    editableCellProps.length = 0;
    editableSelectCellProps.length = 0;
    weatherSelectCellProps.length = 0;
    mockUseCsmSante.mockReset();
    mockUseCsmKpisTrimestriels.mockReset();
    mockUseCsmKpisMensuels.mockReset();
    mockFrom.mockReset();

    mockUseCsmSante.mockReturnValue({
      single: SANTE_SUCCESS,
      upsert: vi.fn(),
    });
    mockUseCsmKpisTrimestriels.mockReturnValue({
      data: KPI_TRIM_SUCCESS,
    });
    mockUseCsmKpisMensuels.mockReturnValue({
      data: KPI_MENS_SUCCESS,
    });
    mockFrom.mockImplementation(() => createBuilder({ data: ETAB_SUCCESS, error: null }));
  });

  it('passe par le chargement de la query et affiche les valeurs métier calculées', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        CsmEtabSanteCard({
          etablissementId: 'etab-1',
        }),
      { wrapper },
    );

    expect(result.current).toBeTruthy();

    render(<CsmEtabSanteCard etablissementId="etab-1" />, { wrapper });

    expect(screen.getByText('Santé du compte')).toBeInTheDocument();
    expect(screen.getByText('Utilisation')).toBeInTheDocument();
    expect(screen.getByText('UHCD')).toBeInTheDocument();
    expect(screen.getByText('Satisfaction')).toBeInTheDocument();
    expect(screen.getByText('Obj. EME')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Palier 3')).toBeInTheDocument();
      expect(screen.getByText('(≥60%)')).toBeInTheDocument();
    });

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars[0]).toHaveAttribute('data-value', '75');
    expect(progressBars[1]).toHaveAttribute('data-value', '91');

    expect(weatherSelectCellProps[0]?.value).toBe('sunny');
    expect(editableSelectCellProps[0]?.value).toBe('up');
    expect(editableSelectCellProps[1]?.value).toBe('down');
    expect(editableCellProps[0]?.value).toBe('85%');
  });

  it('déclenche les mutations via les callbacks onSave avec les payloads attendus', async () => {
    const upsert = vi.fn();
    mockUseCsmSante.mockReturnValue({
      single: SANTE_SUCCESS,
      upsert,
    });

    const wrapper = createWrapper();
    render(<CsmEtabSanteCard etablissementId="etab-1" />, { wrapper });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('weather-select-cell'));
    expect(upsert).toHaveBeenCalledWith({
      ...SANTE_SUCCESS,
      etablissement_id: 'etab-1',
      weather: 'cloudy',
    });

    fireEvent.click(screen.getAllByTestId('editable-select-cell')[0]);
    expect(upsert).toHaveBeenCalledWith({
      ...SANTE_SUCCESS,
      etablissement_id: 'etab-1',
      taux_utilisation_trend: 'stable',
    });

    fireEvent.click(screen.getAllByTestId('editable-select-cell')[1]);
    expect(upsert).toHaveBeenCalledWith({
      ...SANTE_SUCCESS,
      etablissement_id: 'etab-1',
      taux_uhcd_trend: 'stable',
    });

    fireEvent.click(screen.getByTestId('editable-cell'));
    expect(upsert).toHaveBeenCalledWith({
      ...SANTE_SUCCESS,
      etablissement_id: 'etab-1',
      objectif_eme: '90%',
    });
  });

  it('remonte une erreur react-query quand la requête etablissement échoue', async () => {
    mockFrom.mockImplementation(() => createBuilder({ data: null, error: ETAB_ERROR }));

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        CsmEtabSanteCard({
          etablissementId: 'etab-1',
        }),
      { wrapper },
    );

    expect(result.current).toBeTruthy();

    render(<CsmEtabSanteCard etablissementId="etab-1" />, { wrapper });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    await waitFor(() => {
      expect(screen.queryByText('Palier 3')).not.toBeInTheDocument();
    });

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});