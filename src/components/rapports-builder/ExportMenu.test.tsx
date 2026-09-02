/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExportMenu } from './ExportMenu';

const {
  mockInvokeEdge,
  toastSuccess,
  toastError,
  openMock,
} = vi.hoisted(() => ({
  mockInvokeEdge: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    disabled,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string; className?: string }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Download: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-download" {...props} />,
  FileText: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-text" {...props} />,
  FileSpreadsheet: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-spreadsheet" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

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

describe('ExportMenu', () => {
  const dashboard = {
    id: 'dash-1',
    name: 'Dashboard ventes',
  } as unknown as import('@/types/report').CustomDashboard;

  const filters = {
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31',
    siteIds: ['site-1'],
  } as unknown as import('@/types/report').DashboardFilters;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'open', {
      writable: true,
      value: openMock,
    });
  });

  it('affiche le bouton et les options d’export', () => {
    render(<ExportMenu dashboard={dashboard} filters={filters} />, { wrapper: createWrapper() });

    expect(screen.getByRole('button', { name: /exporter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
    expect(screen.getByTestId('icon-download')).toBeInTheDocument();
  });

  it('passe en état occupé pendant un export puis ouvre l’url et affiche un toast de succès pour PDF', async () => {
    let resolveExport: ((value: { url?: string }) => void) | undefined;
    mockInvokeEdge.mockImplementation(
      () =>
        new Promise<{ url?: string }>((resolve) => {
          resolveExport = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<ExportMenu dashboard={dashboard} filters={filters} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith('report-export', {
        dashboard_id: 'dash-1',
        format: 'pdf',
        filters,
      });
    });

    expect(screen.getByRole('button', { name: /exporter/i })).toBeDisabled();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();

    if (resolveExport) {
      resolveExport({ url: 'https://example.test/export.pdf' });
    }

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        'https://example.test/export.pdf',
        '_blank',
        'noopener,noreferrer',
      );
    });

    expect(toastSuccess).toHaveBeenCalledWith('Export PDF prêt');
    expect(toastError).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exporter/i })).not.toBeDisabled();
    });
  });

  it('exporte en xlsx avec les bonnes données métier', async () => {
    mockInvokeEdge.mockResolvedValue({ url: 'https://example.test/export.xlsx' });

    const user = userEvent.setup();
    render(<ExportMenu dashboard={dashboard} filters={filters} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export excel/i }));

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith('report-export', {
        dashboard_id: 'dash-1',
        format: 'xlsx',
        filters,
      });
    });

    expect(openMock).toHaveBeenCalledWith(
      'https://example.test/export.xlsx',
      '_blank',
      'noopener,noreferrer',
    );
    expect(toastSuccess).toHaveBeenCalledWith('Export XLSX prêt');
  });

  it('affiche une erreur si l’url d’export est absente', async () => {
    mockInvokeEdge.mockResolvedValue({});

    const user = userEvent.setup();
    render(<ExportMenu dashboard={dashboard} filters={filters} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith('report-export', {
        dashboard_id: 'dash-1',
        format: 'pdf',
        filters,
      });
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("URL d'export indisponible");
    });

    expect(openMock).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('affiche le message d’erreur remonté par le service', async () => {
    mockInvokeEdge.mockRejectedValue(new Error("échec export"));

    const user = userEvent.setup();
    render(<ExportMenu dashboard={dashboard} filters={filters} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: /export excel/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('échec export');
    });

    expect(openMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exporter/i })).not.toBeDisabled();
    });
  });
});