import React from 'react';
import { render, screen, fireEvent, within, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const {
  ETABS,
  mockExportEtablissementsToCSV,
  mockToastFn,
  mockNavigateFn,
  mockFrom,
} = vi.hoisted(() => {
  const ETABS = [
    {
      id: 'e2',
      nom: 'Banana School',
      ville: 'VilleB',
      region: 'RegionB',
      type: 'Lycée',
      statut: 'Déploiement',
      dpi: 'DPI-2',
    },
    {
      id: 'e1',
      nom: 'Apple School',
      ville: 'VilleA',
      region: 'RegionA',
      type: 'Collège',
      statut: 'Production',
      dpi: null,
    },
  ];

  const mockExportEtablissementsToCSV = vi.fn();
  const mockToastFn = vi.fn();
  const mockNavigateFn = vi.fn();
  const mockFrom = vi.fn();

  return {
    ETABS,
    mockExportEtablissementsToCSV,
    mockToastFn,
    mockNavigateFn,
    mockFrom,
  };
});

// Mocks for UI primitives used by the component
vi.mock('@/components/ui/table', () => {
  const React = require('react');
  return {
    Table: ({ children, ...props }: { children: ReactNode }) => <table {...props}>{children}</table>,
    TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
    TableCell: ({ children, colSpan, className, onClick }: any) => <td className={className} colSpan={colSpan} onClick={onClick}>{children}</td>,
    TableHead: ({ children, className }: any) => <th className={className}>{children}</th>,
    TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
    TableRow: ({ children, ...rest }: any) => <tr {...rest}>{children}</tr>,
  };
});

vi.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: ({ children, onClick, variant, size, className, ...rest }: any) => (
      <button data-variant={variant} data-size={size} className={className} onClick={onClick} {...rest}>
        {children}
      </button>
    ),
  };
});

vi.mock('@/components/ui/badge', () => {
  const React = require('react');
  return {
    Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
  };
});

vi.mock('@/components/ui/checkbox', () => {
  const React = require('react');
  return {
    Checkbox: ({ checked, onCheckedChange, ...rest }: any) => {
      return (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => {
            const val = e.target.checked;
            onCheckedChange?.(val);
          }}
          {...rest}
        />
      );
    },
  };
});

vi.mock('lucide-react', () => {
  const React = require('react');
  return {
    ArrowUpDown: () => <span aria-hidden>↕</span>,
    Download: () => <span aria-hidden>↓</span>,
  };
});

vi.mock('react-router-dom', () => {
  return {
    useNavigate: () => mockNavigateFn,
  };
});

vi.mock('@/components/ui/card', () => {
  const React = require('react');
  return {
    Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  };
});

// GeoQuickActions: simple button containing id
vi.mock('./GeoQuickActions', () => {
  const React = require('react');
  return {
    GeoQuickActions: ({ etablissement }: any) => (
      <button data-testid={`geo-quick-${etablissement.id}`}>actions-{etablissement.id}</button>
    ),
  };
});

// BulkActionsBarGeo: expose selectedIds and allow clearing selection
vi.mock('./BulkActionsBarGeo', () => {
  const React = require('react');
  return {
    BulkActionsBarGeo: ({ selectedIds, onClearSelection, etablissements }: any) => (
      <div data-testid="bulk-bar">
        <div data-testid="bulk-selected">{JSON.stringify(selectedIds)}</div>
        <div data-testid="bulk-count">{etablissements.length}</div>
        <button onClick={onClearSelection}>Clear selection</button>
      </div>
    ),
  };
});

// export function mock
vi.mock('@/lib/analyseGeoUtils', () => {
  return {
    exportEtablissementsToCSV: mockExportEtablissementsToCSV,
  };
});

// useToast mock referring to hoisted mockToastFn
vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: mockToastFn }),
  };
});

// Supabase client mock (builder pattern), using hoisted mockFrom
vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    _table: null as any,
    select() { return this; },
    eq() { return this; },
    gte() { return this; },
    lte() { return this; },
    in() { return this; },
    order() { return this; },
    limit() { return this; },
    insert() { return this; },
    update() { return this; },
    delete() { return this; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(fn: any) { return Promise.resolve({ data: null, error: null }).then(fn); },
    catch(fn: any) { return Promise.resolve({ data: null, error: null }).catch(fn); },
  };
  return {
    supabase: {
      from: (table: string) => {
        mockFrom(table);
        return builder;
      },
    },
  };
});

// Safe default for other potential @/... imports
vi.mock('@/hooks/use-some-auth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 't@t.co' }, isLoading: false }) }), { virtual: true });

// Import the component under test after mocks
import { GeographicTableView } from './GeographicTableView';

describe('GeographicTableView', () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  it('renderHook with QueryClientProvider wrapper works (sanity)', () => {
    const { result } = renderHook(() => true, { wrapper });
    expect(result.current).toBe(true);
  });

  it('renders empty state when no etablissements', () => {
    render(<GeographicTableView etablissements={[]} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
    expect(screen.getByText('Aucun établissement trouvé')).toBeInTheDocument();
    expect(screen.getByText('Exporter CSV')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-count').textContent).toBe('0');
    expect(screen.getByTestId('bulk-selected').textContent).toBe('[]');
  });

  it('renders list of etablissements, badges variants and dpi placeholder', () => {
    render(<GeographicTableView etablissements={ETABS} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });

    // Names
    expect(screen.getByText('Banana School')).toBeInTheDocument();
    expect(screen.getByText('Apple School')).toBeInTheDocument();

    // City / region
    expect(screen.getByText('VilleB')).toBeInTheDocument();
    expect(screen.getByText('RegionA')).toBeInTheDocument();

    // Types
    expect(screen.getByText('Lycée')).toBeInTheDocument();
    expect(screen.getByText('Collège')).toBeInTheDocument();

    // Status badges: our Badge mock renders data-variant on the element itself
    const statutBanana = screen.getByText('Déploiement');
    expect(statutBanana.getAttribute('data-variant')).toBe('secondary');

    const statutApple = screen.getByText('Production');
    expect(statutApple.getAttribute('data-variant')).toBe('default');

    // DPI placeholder
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('DPI-2')).toBeInTheDocument();
  });

  it('sorts by name when clicking Nom button and toggles direction', () => {
    const { container } = render(<GeographicTableView etablissements={ETABS} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });

    const getFirstRowName = () => {
      const rows = screen.getAllByRole('link');
      if (rows.length === 0) throw new Error('No data rows found');
      const nameCell = rows[0].querySelector('td.font-medium');
      return nameCell?.textContent?.trim() ?? '';
    };

    // initial order as provided: Banana first
    expect(getFirstRowName()).toBe('Banana School');

    // Click Nom -> should sort asc (Apple first)
    fireEvent.click(screen.getByText('Nom'));
    expect(getFirstRowName()).toBe('Apple School');

    // Click Nom again -> desc (Banana first)
    fireEvent.click(screen.getByText('Nom'));
    expect(getFirstRowName()).toBe('Banana School');
  });

  it('selects a row checkbox and clear selection via BulkActionsBarGeo', () => {
    render(<GeographicTableView etablissements={ETABS} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });

    const appleRow = screen.getByLabelText('Ouvrir la fiche établissement Apple School');
    const checkbox = within(appleRow).getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(screen.getByTestId('bulk-selected').textContent).toContain('e1');

    const clearBtn = screen.getByText('Clear selection');
    fireEvent.click(clearBtn);

    expect(screen.getByTestId('bulk-selected').textContent).toBe('[]');
    expect(checkbox.checked).toBe(false);
  });

  it('navigates to etablissement page when clicking a row (excluding checkbox)', () => {
    render(<GeographicTableView etablissements={ETABS} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });

    const bananaRow = screen.getByLabelText('Ouvrir la fiche établissement Banana School');
    fireEvent.click(bananaRow);
    expect(mockNavigateFn).toHaveBeenCalledWith('/etablissements/e2');
  });

  it('exports to CSV and shows toast with count when clicking Exporter CSV', () => {
    render(<GeographicTableView etablissements={ETABS} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });

    const exportBtn = screen.getByText('Exporter CSV');
    fireEvent.click(exportBtn);

    expect(mockExportEtablissementsToCSV).toHaveBeenCalledWith(ETABS, 'analyse-geographique');
    expect(mockToastFn).toHaveBeenCalledWith({ title: '2 établissement(s) exporté(s)' });
  });

  it('stops propagation when clicking checkbox inside row so navigation is not triggered', () => {
    render(<GeographicTableView etablissements={ETABS} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });

    const bananaRow = screen.getByLabelText('Ouvrir la fiche établissement Banana School');
    const checkbox = within(bananaRow).getByRole('checkbox') as HTMLInputElement;

    mockNavigateFn.mockClear();
    fireEvent.click(checkbox);
    expect(mockNavigateFn).not.toHaveBeenCalled();
  });

  it('renders GeoQuickActions for each etablissement', () => {
    render(<GeographicTableView etablissements={ETABS} />, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });

    expect(screen.getByTestId('geo-quick-e2')).toBeInTheDocument();
    expect(screen.getByTestId('geo-quick-e1')).toBeInTheDocument();
  });
});