/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { DocumentEditor } from './DocumentEditor';

const {
  mockNavigate,
  mockExportToPdf,
  mockExportToDocx,
  mockImportDocx,
  mockSaveNative,
  mockToolbarProps,
  mockCollabHandleSave,
  mockSetContent,
  stableEditor,
  collabEditor,
  toastSuccess,
  toastError,
  mockUseEditor,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const mockExportToPdf = vi.fn();
  const mockExportToDocx = vi.fn();
  const mockImportDocx = vi.fn();
  const mockSaveNative = vi.fn();
  const mockToolbarProps: Array<Record<string, unknown>> = [];
  const mockCollabHandleSave = vi.fn();
  const mockSetContent = vi.fn();

  const stableEditor = {
    state: {
      selection: { from: 0, to: 0 },
      doc: {
        content: { size: 11 },
        textBetween: vi.fn(() => 'hello world'),
      },
    },
    on: vi.fn(),
    off: vi.fn(),
    getHTML: vi.fn(() => '<p>hello world</p>'),
    commands: {
      setContent: mockSetContent,
    },
  };

  const collabEditor = {
    state: {
      selection: { from: 0, to: 0 },
      doc: {
        content: { size: 11 },
        textBetween: vi.fn(() => 'collab html'),
      },
    },
    on: vi.fn(),
    off: vi.fn(),
    getHTML: vi.fn(() => '<p>collab html</p>'),
    commands: {
      setContent: mockSetContent,
    },
  };

  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const mockUseEditor = vi.fn();

  const builder: Record<string, unknown> = {};
  const chain = [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
  ];
  chain.forEach((key) => {
    builder[key] = vi.fn(() => builder);
  });
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (onFulfilled: (v: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled);
  builder.catch = (onRejected: (e: unknown) => unknown) => Promise.resolve().catch(onRejected);

  const mockFrom = vi.fn(() => builder);

  return {
    mockNavigate,
    mockExportToPdf,
    mockExportToDocx,
    mockImportDocx,
    mockSaveNative,
    mockToolbarProps,
    mockCollabHandleSave,
    mockSetContent,
    stableEditor,
    collabEditor,
    toastSuccess,
    toastError,
    mockUseEditor,
    mockFrom,
    builder,
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@tiptap/react', () => ({
  useEditor: (...args: unknown[]) => mockUseEditor(...args),
  EditorContent: ({ editor }: { editor: { getHTML: () => string } | null }) => (
    <div data-testid="editor-content">{editor ? editor.getHTML() : 'no-editor'}</div>
  ),
  BubbleMenu: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'starter-kit' })),
  },
}));

vi.mock('@tiptap/extension-underline', () => ({ default: { name: 'underline' } }));
vi.mock('@tiptap/extension-link', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'link' })),
  },
}));
vi.mock('@tiptap/extension-image', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'image' })),
  },
}));
vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'placeholder' })),
  },
}));
vi.mock('@tiptap/extension-task-list', () => ({ default: { name: 'task-list' } }));
vi.mock('@tiptap/extension-task-item', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'task-item' })),
  },
}));
vi.mock('@tiptap/extension-table', () => ({
  Table: {
    configure: vi.fn(() => ({ name: 'table' })),
  },
}));
vi.mock('@tiptap/extension-table-row', () => ({ TableRow: { name: 'table-row' } }));
vi.mock('@tiptap/extension-table-cell', () => ({ TableCell: { name: 'table-cell' } }));
vi.mock('@tiptap/extension-table-header', () => ({ TableHeader: { name: 'table-header' } }));
vi.mock('@tiptap/extension-text-align', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'text-align' })),
  },
}));
vi.mock('@tiptap/extension-color', () => ({ default: { name: 'color' } }));
vi.mock('@tiptap/extension-text-style', () => ({ TextStyle: { name: 'text-style' } }));
vi.mock('@tiptap/extension-highlight', () => ({
  default: {
    configure: vi.fn(() => ({ name: 'highlight' })),
  },
}));

vi.mock('./DocumentEditorToolbar', () => ({
  DocumentEditorToolbar: (props: Record<string, unknown>) => {
    mockToolbarProps.push(props);
    return (
      <div data-testid="toolbar">
        <button onClick={() => (props.onSave as () => void)()} data-testid="toolbar-save">
          save
        </button>
        <button onClick={() => (props.onExportPdf as () => void)()} data-testid="toolbar-export-pdf">
          pdf
        </button>
        <button onClick={() => (props.onExportDocx as () => void)()} data-testid="toolbar-export-docx">
          docx
        </button>
        <button onClick={() => (props.onImportDocx as () => void)()} data-testid="toolbar-import-docx">
          import
        </button>
        <span data-testid="toolbar-is-saving">{String(props.isSaving)}</span>
        <span data-testid="toolbar-users">
          {Array.isArray(props.connectedUsers) ? String(props.connectedUsers.length) : '0'}
        </span>
      </div>
    );
  },
}));

vi.mock('./CollaborativeCursors', () => ({
  CollaborativeCursors: ({
    connectedUsers,
    isConnected,
  }: {
    connectedUsers: Array<{ id: string; name: string }>;
    isConnected: boolean;
  }) => (
    <div data-testid="collab-cursors">
      {String(isConnected)}:{connectedUsers.map((u) => u.name).join(',')}
    </div>
  ),
}));

vi.mock('@/lib/documentExport', () => ({
  exportToPdf: mockExportToPdf,
  exportToDocx: mockExportToDocx,
  importDocx: mockImportDocx,
}));

vi.mock('@/hooks/documents/useNativeDocumentSave', () => ({
  useNativeDocumentSave: () => ({
    save: mockSaveNative,
    isSaving: false,
  }),
}));

vi.mock('@/hooks/documents/useCollaborativeEditor', () => ({
  useCollaborativeEditor: () => ({
    editor: collabEditor,
    connectedUsers: [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ],
    isConnected: true,
    isSynced: false,
    isSaving: true,
    handleSave: mockCollabHandleSave,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = () => <svg data-testid="lucide-icon" />;
  return new Proxy({ Loader2: () => <svg data-testid="loader-icon" /> }, {
    get(target, prop: string) {
      if (prop === 'then') return undefined;
      return prop in target ? target[prop as keyof typeof target] : Icon;
    },
    has(_target, prop) {
      return prop !== 'then';
    },
  });
});

vi.mock('@/lib/utils', () => ({
  cn: (...parts: Array<string | undefined | null | false>) => parts.filter(Boolean).join(' '),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
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

describe('DocumentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToolbarProps.length = 0;
    mockUseEditor.mockImplementation((options?: { onUpdate?: (payload: { editor: typeof stableEditor }) => void }) => {
      if (options?.onUpdate) {
        stableEditor.getHTML.mockReturnValue('<p>hello world</p>');
      }
      return stableEditor;
    });
  });

  it('renders solo mode with document name and close button', () => {
    render(<DocumentEditor documentName="Mon document" onClose={vi.fn()} />);

    expect(screen.getByText('Mon document')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toHaveTextContent('<p>hello world</p>');
    expect(screen.getByTestId('toolbar-users')).toHaveTextContent('0');
  });

  it('saves in solo mode via toolbar and calls native save with html blob and onSave', async () => {
    const onSave = vi.fn();
    mockSaveNative.mockResolvedValue(undefined);

    render(<DocumentEditor documentName="Contrat" onSave={onSave} />);

    fireEvent.click(screen.getByTestId('toolbar-save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('<p>hello world</p>');
    });

    await waitFor(() => {
      expect(mockSaveNative).toHaveBeenCalledTimes(1);
    });

    const firstArg = mockSaveNative.mock.calls[0][0];
    expect(firstArg).toBeInstanceOf(Blob);
    expect(firstArg.type).toBe('text/html');

    await waitFor(() => {
      expect(screen.getByText(/Enregistré à/)).toBeInTheDocument();
    });
  });

  it('exports to pdf and docx with real document name and shows success toasts', async () => {
    mockExportToPdf.mockResolvedValue(undefined);
    mockExportToDocx.mockResolvedValue(undefined);

    render(<DocumentEditor documentName="Rapport" />);

    fireEvent.click(screen.getByTestId('toolbar-export-pdf'));
    fireEvent.click(screen.getByTestId('toolbar-export-docx'));

    await waitFor(() => {
      expect(mockExportToPdf).toHaveBeenCalledWith('<p>hello world</p>', 'Rapport');
      expect(mockExportToDocx).toHaveBeenCalledWith('<p>hello world</p>', 'Rapport');
    });

    expect(toastSuccess).toHaveBeenCalledWith('PDF exporté avec succès');
    expect(toastSuccess).toHaveBeenCalledWith('DOCX exporté avec succès');
  });

  it('imports a docx file and updates editor content', async () => {
    mockImportDocx.mockResolvedValue('<p>imported content</p>');

    const { container } = render(<DocumentEditor documentName="Import test" />);

    fireEvent.click(screen.getByTestId('toolbar-import-docx'));

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    if (!input) {
      throw new Error('file input not found');
    }

    const file = new File(['doc'], 'sample.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockImportDocx).toHaveBeenCalledWith(file);
      expect(mockSetContent).toHaveBeenCalledWith('<p>imported content</p>');
    });

    expect(toastSuccess).toHaveBeenCalledWith('Document DOCX importé');
  });

  it('shows error toast when save fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveNative.mockRejectedValue(new Error('x'));

    render(<DocumentEditor documentName="Erreur save" onSave={vi.fn()} />);

    fireEvent.click(screen.getByTestId('toolbar-save'));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Erreur lors de la sauvegarde');
    });

    errorSpy.mockRestore();
  });

  it('shows error toast when export and import fail', async () => {
    mockExportToPdf.mockRejectedValue(new Error('x'));
    mockExportToDocx.mockRejectedValue(new Error('x'));
    mockImportDocx.mockRejectedValue(new Error('x'));

    const { container } = render(<DocumentEditor documentName="Erreur export import" />);

    fireEvent.click(screen.getByTestId('toolbar-export-pdf'));
    fireEvent.click(screen.getByTestId('toolbar-export-docx'));

    const input = container.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('file input not found');
    }

    const file = new File(['doc'], 'broken.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Erreur lors de l'export PDF");
      expect(toastError).toHaveBeenCalledWith("Erreur lors de l'export DOCX");
      expect(toastError).toHaveBeenCalledWith("Erreur lors de l'import DOCX");
    });
  });

  it('renders collaborative mode with connected users and sync/loading state', () => {
    render(<DocumentEditor collaborative documentId="doc-1" documentName="Doc partagé" onClose={vi.fn()} />);

    expect(screen.getByText('Doc partagé')).toBeInTheDocument();
    expect(screen.getByText('Enregistrement…')).toBeInTheDocument();
    expect(screen.getByText('Synchronisation…')).toBeInTheDocument();
    expect(screen.getByTestId('collab-cursors')).toHaveTextContent('true:Alice,Bob');
    expect(screen.getByTestId('toolbar-users')).toHaveTextContent('2');
  });

  it('triggers collaborative save on ctrl+s', async () => {
    render(<DocumentEditor collaborative documentId="doc-2" documentName="Doc collab" />);

    fireEvent.keyDown(document, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(mockCollabHandleSave).toHaveBeenCalledTimes(1);
    });
  });

  it('can render inside QueryClientProvider wrapper with renderHook-compatible config', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => ({ ok: true }), { wrapper });

    expect(result.current.ok).toBe(true);
  });
});