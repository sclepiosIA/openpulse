/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { QuoteExportButtons } from './QuoteExportButtons';

const {
  COMPANY_INFO,
  AUTH_STATE,
  mockExportDevisPDF,
  mockExportDevisExcel,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockUseCompanyInfo,
  mockFrom,
} = vi.hoisted(() => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    COMPANY_INFO: { name: 'Acme Conseil', email: 'contact@acme.test' },
    AUTH_STATE: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockExportDevisPDF: vi.fn(),
    mockExportDevisExcel: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockDebugError: vi.fn(),
    mockUseCompanyInfo: vi.fn(() => ({ data: COMPANY_INFO, isLoading: false, isError: false, error: null })),
    mockFrom: vi.fn(() => builder),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button type="button" onClick={onClick} className={className} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ orientation, className }: { orientation?: string; className?: string }) => (
    <div data-testid="separator" data-orientation={orientation} className={className} />
  ),
}));

vi.mock('lucide-react', () => ({
  FileDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-down" {...props} />,
  FileSpreadsheet: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-file-spreadsheet" {...props} />,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />,
}));

vi.mock('@/lib/simulator/exportDevisUtils', () => ({
  exportDevisPDF: mockExportDevisPDF,
  exportDevisExcel: mockExportDevisExcel,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/hooks/shared/useAppConfig', () => ({
  useCompanyInfo: mockUseCompanyInfo,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

type TestResults = {
  configuration: {
    valorisationLevel: 'premier' | 'deuxieme';
    resellerType: string | null;
  };
};

type TestParams = {
  customerName: string;
  employeeCount: number;
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const Wrapper = createWrapper();
  return render(ui, { wrapper: Wrapper });
}

const baseResults: TestResults = {
  configuration: {
    valorisationLevel: 'premier',
    resellerType: 'partner',
  },
};

const baseParams: TestParams = {
  customerName: 'Client Demo',
  employeeCount: 42,
};

describe('QuoteExportButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCompanyInfo.mockReturnValue({ data: COMPANY_INFO, isLoading: false, isError: false, error: null });
    mockExportDevisPDF.mockResolvedValue(undefined);
    mockExportDevisExcel.mockImplementation(() => undefined);
  });

  it('charge les données de company info via le hook mocké avec un wrapper QueryClientProvider', async () => {
    const Wrapper = createWrapper();
    const { result } = renderHook(() => mockUseCompanyInfo(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual(COMPANY_INFO);
    expect(result.current.data.name).toBe('Acme Conseil');
    expect(result.current.data.email).toBe('contact@acme.test');
  });

  it('affiche les 4 boutons quand un revendeur est configuré', () => {
    renderWithProviders(
      <QuoteExportButtons results={baseResults as never} params={baseParams as never} etablissementNom="Agence Paris" />
    );

    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pdf partenaire/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /excel partenaire/i })).toBeInTheDocument();
    expect(screen.getByTestId('separator')).toHaveAttribute('data-orientation', 'vertical');
  });

  it('masque les exports partenaire quand resellerType est null', () => {
    const noResellerResults: TestResults = {
      configuration: {
        valorisationLevel: 'premier',
        resellerType: null,
      },
    };

    renderWithProviders(
      <QuoteExportButtons results={noResellerResults as never} params={baseParams as never} etablissementNom="Agence Lyon" />
    );

    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pdf partenaire/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /excel partenaire/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('separator')).not.toBeInTheDocument();
  });

  it('exporte le PDF client avec les bonnes valeurs métier et affiche un toast de succès', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <QuoteExportButtons results={baseResults as never} params={baseParams as never} etablissementNom="Agence Marseille" />
    );

    await user.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => {
      expect(mockExportDevisPDF).toHaveBeenCalledTimes(1);
    });

    expect(mockExportDevisPDF).toHaveBeenCalledWith({
      results: baseResults,
      params: baseParams,
      etablissementNom: 'Agence Marseille',
      isPremierNiveau: true,
      isPartnerExport: false,
      footerConfig: {
        company_name: 'Acme Conseil',
        email: 'contact@acme.test',
      },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('PDF exporté avec succès');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('exporte le PDF partenaire avec isPartnerExport=true et le toast partenaire', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <QuoteExportButtons results={baseResults as never} params={baseParams as never} etablissementNom="Agence Lille" />
    );

    await user.click(screen.getByRole('button', { name: /pdf partenaire/i }));

    await waitFor(() => {
      expect(mockExportDevisPDF).toHaveBeenCalledTimes(1);
    });

    expect(mockExportDevisPDF).toHaveBeenCalledWith({
      results: baseResults,
      params: baseParams,
      etablissementNom: 'Agence Lille',
      isPremierNiveau: true,
      isPartnerExport: true,
      footerConfig: {
        company_name: 'Acme Conseil',
        email: 'contact@acme.test',
      },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('PDF partenaire exporté avec succès');
  });

  it('exporte l’Excel client avec les bonnes valeurs et affiche un toast de succès', async () => {
    const user = userEvent.setup();
    const secondLevelResults: TestResults = {
      configuration: {
        valorisationLevel: 'deuxieme',
        resellerType: 'partner',
      },
    };

    renderWithProviders(
      <QuoteExportButtons
        results={secondLevelResults as never}
        params={baseParams as never}
        etablissementNom="Agence Nantes"
      />
    );

    await user.click(screen.getByRole('button', { name: /export excel/i }));

    expect(mockExportDevisExcel).toHaveBeenCalledTimes(1);
    expect(mockExportDevisExcel).toHaveBeenCalledWith({
      results: secondLevelResults,
      params: baseParams,
      etablissementNom: 'Agence Nantes',
      isPremierNiveau: false,
      isPartnerExport: false,
      footerConfig: {
        company_name: 'Acme Conseil',
        email: 'contact@acme.test',
      },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Excel exporté avec succès');
  });

  it('exporte l’Excel partenaire avec le bon payload et le bon message', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <QuoteExportButtons results={baseResults as never} params={baseParams as never} etablissementNom="Agence Nice" />
    );

    await user.click(screen.getByRole('button', { name: /excel partenaire/i }));

    expect(mockExportDevisExcel).toHaveBeenCalledTimes(1);
    expect(mockExportDevisExcel).toHaveBeenCalledWith({
      results: baseResults,
      params: baseParams,
      etablissementNom: 'Agence Nice',
      isPremierNiveau: true,
      isPartnerExport: true,
      footerConfig: {
        company_name: 'Acme Conseil',
        email: 'contact@acme.test',
      },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Excel partenaire exporté avec succès');
  });

  it('gère une erreur sur export PDF avec debug.error et toast.error', async () => {
    const user = userEvent.setup();
    const pdfError = { message: 'x' };
    mockExportDevisPDF.mockRejectedValueOnce(pdfError);

    renderWithProviders(
      <QuoteExportButtons results={baseResults as never} params={baseParams as never} etablissementNom="Agence Toulouse" />
    );

    await user.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'export PDF");
    });

    expect(mockDebugError).toHaveBeenCalledWith('Erreur export PDF:', pdfError);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('gère une erreur sur export Excel avec debug.error et toast.error', async () => {
    const user = userEvent.setup();
    const excelError = { message: 'x' };
    mockExportDevisExcel.mockImplementationOnce(() => {
      throw excelError;
    });

    renderWithProviders(
      <QuoteExportButtons results={baseResults as never} params={baseParams as never} etablissementNom="Agence Bordeaux" />
    );

    await user.click(screen.getByRole('button', { name: /export excel/i }));

    expect(mockDebugError).toHaveBeenCalledWith('Erreur export Excel:', excelError);
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'export Excel");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('construit footerConfig à undefined si company info est absente', async () => {
    const user = userEvent.setup();
    mockUseCompanyInfo.mockReturnValueOnce({ data: undefined, isLoading: false, isError: false, error: null });

    renderWithProviders(
      <QuoteExportButtons results={baseResults as never} params={baseParams as never} etablissementNom="Agence Dijon" />
    );

    await user.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => {
      expect(mockExportDevisPDF).toHaveBeenCalledTimes(1);
    });

    expect(mockExportDevisPDF).toHaveBeenCalledWith({
      results: baseResults,
      params: baseParams,
      etablissementNom: 'Agence Dijon',
      isPremierNiveau: true,
      isPartnerExport: false,
      footerConfig: undefined,
    });
  });

  it('couvre un état d’erreur de hook type react-query via renderHook', () => {
    mockUseCompanyInfo.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => mockUseCompanyInfo(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ message: 'x' });
  });
});