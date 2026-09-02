import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

type ActionLike = {
  id: string;
  label: string;
  needsSelection?: boolean;
  insertAtCursor?: boolean;
  structured?: boolean;
};

type FloatingSelectionBarProps = {
  editor: Editor | null;
  isRunning: boolean;
  onRunAction: (action: ActionLike, opts?: { language?: string; prompt?: string }) => void | Promise<void>;
};

type SlashCommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: string;
  hasSelection: boolean;
  onSelectAction: (action: ActionLike, opts?: { language?: string; prompt?: string }) => void | Promise<void>;
  onFreePrompt: (prompt: string) => void;
};

type CopilotSidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle?: string;
  documentHtml: string;
  contextSummary: string;
  documentId: string | null;
  onInsertAtCursor: (html: string) => void;
};

type AIDiffOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionLabel: string;
  originalText: string;
  proposal: string;
  proposalIsHtml: boolean;
  onAccept: () => void;
  onReject: () => void;
};

type TransactionalActionsDialogProps = {
  action: string;
  parsed: Record<string, unknown>;
  onClose: () => void;
};

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
};

type ChildrenProps = {
  children?: ReactNode;
  className?: string;
};

const {
  ACTION_REWRITE,
  ACTION_DRAFT,
  ACTION_HEADLINE,
  DOC_CONTEXT_RESULT,
  mockCopilotTransformReturn,
  mockRun,
  mockSanitize,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => {
  const rewrite = {
    id: 'rewrite',
    label: 'Réécrire',
    needsSelection: true,
    insertAtCursor: false,
    structured: false,
  };

  const draft = {
    id: 'draft_from_prompt',
    label: 'Rédiger',
    needsSelection: false,
    insertAtCursor: true,
    structured: false,
  };

  const headline = {
    id: 'headline_suggest',
    label: 'Suggérer des titres',
    needsSelection: false,
    insertAtCursor: false,
    structured: true,
  };

  const run = vi.fn();
  const sanitize = vi.fn((html: string) => `clean:${html}`);
  const transformReturn = { run, isLoading: false };
  const docContext = { summary: 'Résumé du document courant' };

  return {
    ACTION_REWRITE: rewrite,
    ACTION_DRAFT: draft,
    ACTION_HEADLINE: headline,
    DOC_CONTEXT_RESULT: docContext,
    mockCopilotTransformReturn: transformReturn,
    mockRun: run,
    mockSanitize: sanitize,
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  };
});

vi.mock('dompurify', () => ({
  default: {
    sanitize: mockSanitize,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock('./useCopilotStream', () => ({
  useCopilotTransform: () => mockCopilotTransformReturn,
}));

vi.mock('./useDocContext', () => ({
  useDocContext: () => DOC_CONTEXT_RESULT,
}));

vi.mock('./actions', () => ({
  getActionById: (id: string) => (id === 'draft_from_prompt' ? ACTION_DRAFT : undefined),
}));

vi.mock('./FloatingSelectionBar', () => ({
  FloatingSelectionBar: ({ editor, isRunning, onRunAction }: FloatingSelectionBarProps) => (
    <div
      data-testid="floating-bar"
      data-has-editor={String(Boolean(editor))}
      data-running={String(isRunning)}
    >
      <button type="button" data-testid="floating-run" onClick={() => onRunAction(ACTION_REWRITE)}>
        Lancer réécriture
      </button>
    </div>
  ),
}));

vi.mock('./SlashCommandMenu', () => ({
  SlashCommandMenu: ({
    open,
    onOpenChange,
    surface,
    hasSelection,
    onSelectAction,
    onFreePrompt,
  }: SlashCommandMenuProps) => (
    <div
      data-testid="slash-menu"
      data-open={String(open)}
      data-surface={surface}
      data-selection={String(hasSelection)}
    >
      <button type="button" data-testid="slash-close" onClick={() => onOpenChange(false)}>
        Fermer slash
      </button>
      <button type="button" data-testid="slash-free-prompt" onClick={() => onFreePrompt('Plan de réunion')}>
        Prompt libre
      </button>
      <button type="button" data-testid="slash-structured" onClick={() => onSelectAction(ACTION_HEADLINE)}>
        Titres
      </button>
    </div>
  ),
}));

vi.mock('./CopilotSidePanel', () => ({
  CopilotSidePanel: ({
    open,
    onOpenChange,
    documentTitle,
    documentHtml,
    contextSummary,
    documentId,
    onInsertAtCursor,
  }: CopilotSidePanelProps) => (
    <div
      data-testid="side-panel"
      data-open={String(open)}
      data-title={documentTitle ?? ''}
      data-html={documentHtml}
      data-context={contextSummary}
      data-document-id={documentId ?? ''}
    >
      <button type="button" data-testid="panel-close" onClick={() => onOpenChange(false)}>
        Fermer panel
      </button>
      <button
        type="button"
        data-testid="panel-insert"
        onClick={() => onInsertAtCursor('<p>Insertion depuis le chat</p>')}
      >
        Insérer
      </button>
    </div>
  ),
}));

vi.mock('./AIDiffOverlay', () => ({
  AIDiffOverlay: ({
    open,
    onOpenChange,
    actionLabel,
    originalText,
    proposal,
    proposalIsHtml,
    onAccept,
    onReject,
  }: AIDiffOverlayProps) =>
    open ? (
      <div
        data-testid="ai-diff-overlay"
        data-html={String(proposalIsHtml)}
        data-original={originalText}
      >
        <div data-testid="diff-label">{actionLabel}</div>
        <div data-testid="diff-proposal">{proposal}</div>
        <button type="button" data-testid="diff-close" onClick={() => onOpenChange(false)}>
          Fermer diff
        </button>
        <button type="button" data-testid="diff-accept" onClick={onAccept}>
          Accepter
        </button>
        <button type="button" data-testid="diff-reject" onClick={onReject}>
          Rejeter
        </button>
      </div>
    ) : null,
}));

vi.mock('./TransactionalActionsDialog', () => ({
  TransactionalActionsDialog: ({ action, parsed, onClose }: TransactionalActionsDialogProps) => (
    <div data-testid="transactional-dialog" data-action={action}>
      <pre>{JSON.stringify(parsed)}</pre>
      <button type="button" onClick={onClose}>
        Fermer transaction
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: DialogProps) => (open === false ? null : <div data-testid="dialog">{children}</div>),
  DialogContent: ({ children, className }: ChildrenProps) => (
    <section data-testid="dialog-content" className={className}>
      {children}
    </section>
  ),
  DialogDescription: ({ children }: ChildrenProps) => <p>{children}</p>,
  DialogFooter: ({ children }: ChildrenProps) => <footer>{children}</footer>,
  DialogHeader: ({ children }: ChildrenProps) => <header>{children}</header>,
  DialogTitle: ({ children }: ChildrenProps) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: ChildrenProps) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

import { useDocumentCopilot } from './useDocumentCopilot';

type ChainMock = {
  focus: ReturnType<typeof vi.fn>;
  setTextSelection: ReturnType<typeof vi.fn>;
  deleteSelection: ReturnType<typeof vi.fn>;
  insertContent: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
};

type EditorMockResult = {
  editor: Editor;
  chain: ChainMock;
  textBetween: ReturnType<typeof vi.fn>;
  getHTML: ReturnType<typeof vi.fn>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createEditorMock({
  textContent = 'Bonjour sélection utile pour le document',
  html = '<p>Bonjour sélection utile pour le document</p>',
  from = 8,
  to = 17,
  selectedText = 'sélection',
}: {
  textContent?: string;
  html?: string;
  from?: number;
  to?: number;
  selectedText?: string;
} = {}): EditorMockResult {
  const chain = {} as ChainMock;

  chain.focus = vi.fn(() => chain);
  chain.setTextSelection = vi.fn(() => chain);
  chain.deleteSelection = vi.fn(() => chain);
  chain.insertContent = vi.fn(() => chain);
  chain.run = vi.fn(() => true);

  const textBetween = vi.fn((start: number, end: number) => {
    if (selectedText.length > 0) return selectedText;
    return textContent.slice(start, end);
  });

  const getHTML = vi.fn(() => html);

  const editor = {
    state: {
      selection: { from, to },
      doc: {
        textContent,
        textBetween,
      },
    },
    getHTML,
    chain: vi.fn(() => chain),
  } as unknown as Editor;

  return { editor, chain, textBetween, getHTML };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockRun.mockReset();
  mockRun.mockResolvedValue({ result: 'Résultat par défaut' });
  mockCopilotTransformReturn.isLoading = false;
  mockSanitize.mockClear();
  mockSanitize.mockImplementation((html: string) => `clean:${html}`);
  mockToastError.mockClear();
  mockToastSuccess.mockClear();
});

describe('useDocumentCopilot', () => {
  it('expose l’état de chargement du transform et le transmet à la barre flottante', () => {
    mockCopilotTransformReturn.isLoading = true;
    const { editor } = createEditorMock();

    const { result } = renderHook(
      () =>
        useDocumentCopilot({
          editor,
          documentId: 'doc-1',
          documentName: 'Compte rendu',
          folderId: 'folder-1',
          surface: 'document',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isRunning).toBe(true);

    render(result.current.bridge);

    expect(screen.getByTestId('floating-bar').getAttribute('data-running')).toBe('true');
    expect(screen.getByTestId('floating-bar').getAttribute('data-has-editor')).toBe('true');
    expect(screen.getByTestId('side-panel').getAttribute('data-context')).toBe('Résumé du document courant');
    expect(screen.getByTestId('side-panel').getAttribute('data-title')).toBe('Compte rendu');
  });

  it('ouvre la palette slash et le panneau latéral via les commandes exposées et les raccourcis', () => {
    const { editor } = createEditorMock();

    const { result } = renderHook(
      () =>
        useDocumentCopilot({
          editor,
          documentId: 'doc-1',
          documentName: 'Note client',
          folderId: null,
          surface: 'document',
        }),
      { wrapper: createWrapper() },
    );

    const preventSlashDefault = vi.fn();
    const slashEvent = {
      metaKey: true,
      ctrlKey: false,
      key: 'k',
      preventDefault: preventSlashDefault,
    } as unknown as ReactKeyboardEvent;

    act(() => {
      result.current.handleKeyDown(slashEvent);
    });

    const preventPanelDefault = vi.fn();
    const panelEvent = {
      metaKey: false,
      ctrlKey: true,
      key: 'J',
      preventDefault: preventPanelDefault,
    } as unknown as ReactKeyboardEvent;

    act(() => {
      result.current.handleKeyDown(panelEvent);
    });

    render(result.current.bridge);

    expect(preventSlashDefault).toHaveBeenCalledTimes(1);
    expect(preventPanelDefault).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('slash-menu').getAttribute('data-open')).toBe('true');
    expect(screen.getByTestId('slash-menu').getAttribute('data-selection')).toBe('true');
    expect(screen.getByTestId('side-panel').getAttribute('data-open')).toBe('true');
  });

  it('lance une action avec la sélection, affiche la proposition, puis accepte en remplaçant la plage sélectionnée', async () => {
    mockRun.mockResolvedValue({ result: '<strong>Texte amélioré</strong>' });

    const { editor, chain, textBetween } = createEditorMock({
      textContent: 'Bonjour sélection utile pour le document',
      html: '<p>Bonjour sélection utile pour le document</p>',
      from: 8,
      to: 17,
      selectedText: 'sélection',
    });

    const { result } = renderHook(
      () =>
        useDocumentCopilot({
          editor,
          documentId: 'doc-1',
          documentName: 'Note de réunion',
          folderId: 'folder-1',
          surface: 'document',
        }),
      { wrapper: createWrapper() },
    );

    const view = render(result.current.bridge);

    await act(async () => {
      fireEvent.click(screen.getByTestId('floating-run'));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    expect(textBetween).toHaveBeenCalledWith(8, 17, '\n');
    expect(mockRun).toHaveBeenCalledWith({
      action: 'rewrite',
      selection: 'sélection',
      fullText: 'Bonjour sélection utile pour le document',
      language: undefined,
      documentId: 'doc-1',
      surface: 'document',
    });

    view.rerender(result.current.bridge);

    expect(screen.getByTestId('diff-label').textContent).toBe('Réécrire');
    expect(screen.getByTestId('diff-proposal').textContent).toBe('<strong>Texte amélioré</strong>');
    expect(screen.getByTestId('ai-diff-overlay').getAttribute('data-html')).toBe('true');
    expect(screen.getByTestId('ai-diff-overlay').getAttribute('data-original')).toBe('sélection');

    await act(async () => {
      fireEvent.click(screen.getByTestId('diff-accept'));
      await Promise.resolve();
    });

    expect(mockSanitize).toHaveBeenCalledWith('<strong>Texte amélioré</strong>');
    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.setTextSelection).toHaveBeenCalledWith({ from: 8, to: 17 });
    expect(chain.deleteSelection).toHaveBeenCalledTimes(1);
    expect(chain.insertContent).toHaveBeenCalledWith('clean:<strong>Texte amélioré</strong>');
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('signale une erreur métier si une action nécessitant une sélection est lancée sans texte sélectionné', async () => {
    const { editor } = createEditorMock({
      textContent: 'Texte sans sélection active',
      html: '<p>Texte sans sélection active</p>',
      from: 5,
      to: 5,
      selectedText: '',
    });

    const { result } = renderHook(
      () =>
        useDocumentCopilot({
          editor,
          documentId: 'doc-1',
          documentName: 'Brouillon',
          folderId: null,
          surface: 'document',
        }),
      { wrapper: createWrapper() },
    );

    render(result.current.bridge);

    await act(async () => {
      fireEvent.click(screen.getByTestId('floating-run'));
      await Promise.resolve();
    });

    expect(mockToastError).toHaveBeenCalledWith("Sélectionnez d'abord du texte");
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('affiche un résultat structuré non transactionnel avec les titres retournés', async () => {
    mockRun.mockResolvedValue({
      result: '',
      parsed: {
        titles: ['Titre court', 'Titre orienté action'],
      },
    });

    const { editor } = createEditorMock({
      textContent: 'Contenu long utilisé pour proposer des titres',
      html: '<h1>Contenu long utilisé pour proposer des titres</h1>',
      from: 0,
      to: 0,
      selectedText: '',
    });

    const { result } = renderHook(
      () =>
        useDocumentCopilot({
          editor,
          documentId: undefined,
          documentName: 'Article',
          folderId: null,
          surface: 'document',
        }),
      { wrapper: createWrapper() },
    );

    const view = render(result.current.bridge);

    await act(async () => {
      fireEvent.click(screen.getByTestId('slash-structured'));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    expect(mockRun).toHaveBeenCalledWith({
      action: 'headline_suggest',
      selection: '',
      fullText: 'Contenu long utilisé pour proposer des titres',
      language: undefined,
      documentId: null,
      surface: 'document',
    });

    view.rerender(result.current.bridge);

    expect(screen.getByText('Suggestions de titres').textContent).toBe('Suggestions de titres');
    expect(screen.getByText('Titre court').textContent).toBe('Titre court');
    expect(screen.getByText('Titre orienté action').textContent).toBe('Titre orienté action');
  });

  it('insère depuis le chat latéral en nettoyant le HTML avant insertion au curseur', () => {
    const { editor, chain } = createEditorMock();

    const { result } = renderHook(
      () =>
        useDocumentCopilot({
          editor,
          documentId: 'doc-1',
          documentName: 'Document chat',
          folderId: null,
          surface: 'document',
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.openPanel();
    });

    render(result.current.bridge);

    expect(screen.getByTestId('side-panel').getAttribute('data-open')).toBe('true');

    act(() => {
      fireEvent.click(screen.getByTestId('panel-insert'));
    });

    expect(mockSanitize).toHaveBeenCalledWith('<p>Insertion depuis le chat</p>');
    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.insertContent).toHaveBeenCalledWith('clean:<p>Insertion depuis le chat</p>');
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('rédige depuis un prompt libre et échappe les paragraphes texte avant insertion', async () => {
    mockRun.mockResolvedValue({ result: 'A 2 < 3\n\nC & D' });

    const { editor, chain } = createEditorMock({
      textContent: 'Document initial',
      html: '<p>Document initial</p>',
      from: 0,
      to: 0,
      selectedText: '',
    });

    const { result } = renderHook(
      () =>
        useDocumentCopilot({
          editor,
          documentId: 'doc-1',
          documentName: 'Prompt libre',
          folderId: null,
          surface: 'document',
        }),
      { wrapper: createWrapper() },
    );

    const view = render(result.current.bridge);

    await act(async () => {
      fireEvent.click(screen.getByTestId('slash-free-prompt'));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    expect(mockRun).toHaveBeenCalledWith({
      action: 'draft_from_prompt',
      selection: 'Plan de réunion',
      fullText: 'Document initial',
      language: undefined,
      documentId: 'doc-1',
      surface: 'document',
    });

    view.rerender(result.current.bridge);

    expect(screen.getByTestId('diff-label').textContent).toBe('Rédiger');
    expect(screen.getByTestId('ai-diff-overlay').getAttribute('data-html')).toBe('false');
    expect(screen.getByTestId('ai-diff-overlay').getAttribute('data-original')).toBe('Plan de réunion');

    await act(async () => {
      fireEvent.click(screen.getByTestId('diff-accept'));
      await Promise.resolve();
    });

    expect(mockSanitize).not.toHaveBeenCalled();
    expect(chain.insertContent).toHaveBeenCalledWith('<p>A 2 &lt; 3</p><p>C &amp; D</p>');
    expect(chain.run).toHaveBeenCalledTimes(1);
  });
});