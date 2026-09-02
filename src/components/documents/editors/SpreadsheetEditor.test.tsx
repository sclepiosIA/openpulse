import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { SpreadsheetEditor } from './SpreadsheetEditor';

const {
  stableAuth,
  mockSave,
  mockToastSuccess,
  mockToastError,
  mockLoadExcelLibs,
  mockLoadPdfLibs,
  mockWriteFile,
  mockBookAppendSheet,
  mockBookNew,
  mockAoaToSheet,
  mockEncodeCell,
  mockJsPdfCtor,
  mockJsPdfSave,
  mockJsPdfText,
  mockJsPdfSetFontSize,
  mockAutoTable,
  mockCreateObjectURL,
  mockRevokeObjectURL,
  mockAnchorClick,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: null, error: null });
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  chain.then.mockImplementation((resolve: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve(resolve({ data: null, error: null })),
  );
  chain.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  return {
    stableAuth: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockSave: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockLoadExcelLibs: vi.fn(),
    mockLoadPdfLibs: vi.fn(),
    mockWriteFile: vi.fn(),
    mockBookAppendSheet: vi.fn(),
    mockBookNew: vi.fn(() => ({ Sheets: {}, SheetNames: [] })),
    mockAoaToSheet: vi.fn(() => ({ A1: {}, B1: {} })),
    mockEncodeCell: vi.fn(({ r, c }: { r: number; c: number }) => `${String.fromCharCode(65 + c)}${r + 1}`),
    mockJsPdfCtor: vi.fn(),
    mockJsPdfSave: vi.fn(),
    mockJsPdfText: vi.fn(),
    mockJsPdfSetFontSize: vi.fn(),
    mockAutoTable: vi.fn(),
    mockCreateObjectURL: vi.fn(() => 'blob:test'),
    mockRevokeObjectURL: vi.fn(),
    mockAnchorClick: vi.fn(),
    builder: chain,
    mockFrom: vi.fn(() => chain),
  };
});

vi.mock('@/hooks/documents/useNativeDocumentSave', () => ({
  useNativeDocumentSave: vi.fn(() => ({
    save: mockSave,
    isSaving: false,
  })),
}));

vi.mock('@/lib/export/dynamicPdfImport', () => ({
  loadPdfLibs: mockLoadPdfLibs,
  loadExcelLibs: mockLoadExcelLibs,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    type,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
    return <input ref={ref} {...props} />;
  }),
}));

vi.mock('lucide-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('lucide-react')>()),
  Save: () => <svg aria-hidden="true" />,
  FileDown: () => <svg aria-hidden="true" />,
  FileUp: () => <svg aria-hidden="true" />,
  BarChart3: () => <svg aria-hidden="true" />,
  Palette: () => <svg aria-hidden="true" />,
  Search: () => <svg aria-hidden="true" />,
  History: () => <svg aria-hidden="true" />,
  Loader2: () => <svg aria-hidden="true" />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableAuth,
}));

describe('SpreadsheetEditor', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  };

  const renderEditor = (editor: React.ReactElement) =>
    render(editor, { wrapper: createWrapper() });

  beforeEach(() => {
    vi.clearAllMocks();

    mockAoaToSheet.mockReturnValue({ A1: {}, B1: {} });
    mockBookNew.mockReturnValue({ Sheets: {}, SheetNames: [] });

    mockLoadExcelLibs.mockResolvedValue({
      XLSX: {
        utils: {
          aoa_to_sheet: mockAoaToSheet,
          encode_cell: mockEncodeCell,
          encode_range: vi.fn(() => 'A1:B1'),
          book_new: mockBookNew,
          book_append_sheet: mockBookAppendSheet,
        },
        writeFile: mockWriteFile,
      },
    });

    mockJsPdfCtor.mockImplementation((options?: { orientation?: string }) => ({
      options,
      setFontSize: mockJsPdfSetFontSize,
      text: mockJsPdfText,
      save: mockJsPdfSave,
    }));

    mockLoadPdfLibs.mockResolvedValue({
      jsPDF: mockJsPdfCtor,
      autoTable: mockAutoTable,
    });

    mockSave.mockResolvedValue(undefined);

    Object.defineProperty(URL, 'createObjectURL', {
      value: mockCreateObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: mockRevokeObjectURL,
      writable: true,
      configurable: true,
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mockAnchorClick);
  });

  it('renders header actions and selected-cell formula bar from initial content', () => {
    const initialContent = JSON.stringify({
      data: {
        A1: { value: '2' },
        B1: { value: '3' },
        C1: { value: '', formula: '=A1+B1' },
      },
      colCount: 26,
      rowCount: 100,
      colWidths: {},
    });

    renderEditor(<SpreadsheetEditor documentName="Budget.xlsx" initialContent={initialContent} />);

    expect(screen.getByText('Budget.xlsx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^xlsx$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pdf$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^csv$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/entrez une valeur/i)).toHaveValue('');
  });

  it('saves successfully on button click and shows success state', async () => {
    renderEditor(<SpreadsheetEditor documentName="Tableur test" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    const firstArg = mockSave.mock.calls[0][0];
    expect(firstArg).toBeInstanceOf(Blob);
    expect(mockToastSuccess).toHaveBeenCalledWith('Tableur enregistré');
    await waitFor(() => {
      expect(screen.getByText(/enregistré à/i)).toBeInTheDocument();
    });
  });

  it('handles save error and shows error toast', async () => {
    mockSave.mockRejectedValueOnce(new Error('x'));

    renderEditor(<SpreadsheetEditor documentName="Tableur erreur" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la sauvegarde");
    });
  });

  it('exports csv with correct filename and success toast', async () => {
    const initialContent = JSON.stringify({
      data: {
        A1: { value: 'Nom' },
        B1: { value: 'Age' },
        A2: { value: 'Alice' },
        B2: { value: '30' },
      },
      colCount: 26,
      rowCount: 100,
      colWidths: {},
    });

    renderEditor(<SpreadsheetEditor documentName="contacts.xlsx" initialContent={initialContent} />);

    fireEvent.click(screen.getByRole('button', { name: /^csv$/i }));

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(mockAnchorClick).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test');
      expect(mockToastSuccess).toHaveBeenCalledWith('CSV exporté');
    });
  });

  it('exports xlsx with numeric conversion, widths and styles', async () => {
    const initialContent = JSON.stringify({
      data: {
        A1: { value: '12', format: { bold: true, align: 'center', bgColor: '#ff0000', textColor: '#00ff00' } },
        B1: { value: 'Texte' },
      },
      colCount: 26,
      rowCount: 100,
      colWidths: { 0: 140, 1: 70 },
    });

    renderEditor(<SpreadsheetEditor documentName="report.json" initialContent={initialContent} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^xlsx$/i }));
    });

    await waitFor(() => {
      expect(mockLoadExcelLibs).toHaveBeenCalledTimes(1);
      expect(mockBookAppendSheet).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(Object), 'report.xlsx');
      expect(mockToastSuccess).toHaveBeenCalledWith('XLSX exporté (formules & styles conservés)');
    });

    const sheetArg = mockBookAppendSheet.mock.calls[0][1] as Record<string, unknown>;
    expect(sheetArg['!cols']).toEqual([{ wch: 20 }, { wch: 10 }]);
    expect(sheetArg['A1']).toEqual({
      t: 'n',
      v: 12,
      s: {
        font: {
          bold: true,
          italic: false,
          color: { rgb: '00ff00' },
        },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'ff0000' } },
      },
    });
    expect(sheetArg['B1']).toEqual({ t: 's', v: 'Texte' });
    expect(sheetArg['!ref']).toBe('A1:B1');
  });

  it('handles xlsx export error', async () => {
    mockLoadExcelLibs.mockRejectedValueOnce(new Error('x'));

    renderEditor(<SpreadsheetEditor documentName="broken.xlsx" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^xlsx$/i }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'export XLSX");
    });
  });

  it('exports pdf with portrait orientation for small sheet', async () => {
    const initialContent = JSON.stringify({
      data: {
        A1: { value: 'Produit' },
        B1: { value: '10' },
      },
      colCount: 26,
      rowCount: 100,
      colWidths: {},
    });

    renderEditor(<SpreadsheetEditor documentName="facture.csv" initialContent={initialContent} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }));
    });

    await waitFor(() => {
      expect(mockLoadPdfLibs).toHaveBeenCalledTimes(1);
      expect(mockJsPdfCtor).toHaveBeenCalledWith({ orientation: 'portrait' });
      expect(mockJsPdfSetFontSize).toHaveBeenCalledWith(16);
      expect(mockJsPdfText).toHaveBeenCalledWith('facture', 14, 18);
      expect(mockAutoTable).toHaveBeenCalledWith(
        expect.objectContaining({
          setFontSize: mockJsPdfSetFontSize,
          text: mockJsPdfText,
          save: mockJsPdfSave,
        }),
        expect.objectContaining({
          startY: 25,
          head: [['A', 'B']],
          body: [['Produit', '10']],
          theme: 'grid',
        }),
      );
      expect(mockJsPdfSave).toHaveBeenCalledWith('facture.pdf');
      expect(mockToastSuccess).toHaveBeenCalledWith('PDF exporté avec succès');
    });
  });

  it('handles pdf export error', async () => {
    mockLoadPdfLibs.mockRejectedValueOnce(new Error('x'));

    renderEditor(<SpreadsheetEditor documentName="broken.pdf" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'export PDF");
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();

    renderEditor(<SpreadsheetEditor documentName="Close me" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /fermer/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saves with Ctrl+S keyboard shortcut', async () => {
    renderEditor(<SpreadsheetEditor documentName="Shortcut test" />);

    await act(async () => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith('Tableur enregistré');
    });
  });

  it('provides a valid QueryClientProvider wrapper for renderHook usage', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => 42, { wrapper });

    expect(result.current).toBe(42);
  });
});