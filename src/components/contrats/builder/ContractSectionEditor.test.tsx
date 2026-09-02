// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContractSectionEditor } from "./ContractSectionEditor";

const {
  SECTION,
  LOCKED_SECTION,
  mockUseEditor,
  mockSetContent,
  mockGetHTML,
  mockGetText,
  mockChainFocus,
  mockToggleBold,
  mockToggleItalic,
  mockToggleUnderline,
  mockToggleBulletList,
  mockToggleOrderedList,
  mockToggleBlockquote,
  mockToggleHeading,
  mockUndo,
  mockRedo,
  mockRun,
  mockIsActive,
  mockCanUndo,
  mockCanRedo,
  latestEditorOptions,
} = vi.hoisted(() => {
  const section = {
    id: "sec-1",
    titre: "Clause de paiement",
    contenu_html: "<p>Bonjour {{client}} et {{montant}}</p>",
    type: "payment",
    clause_source_id: "src-1",
    is_locked: false,
  };

  const lockedSection = {
    id: "sec-2",
    titre: "Section verrouillée",
    contenu_html: "<p>Texte fixe</p>",
    type: "legal",
    clause_source_id: null,
    is_locked: true,
  };

  const latest = { current: null as null | Record<string, unknown> };

  const run = vi.fn();
  const toggleBold = vi.fn(() => ({ run }));
  const toggleItalic = vi.fn(() => ({ run }));
  const toggleUnderline = vi.fn(() => ({ run }));
  const toggleBulletList = vi.fn(() => ({ run }));
  const toggleOrderedList = vi.fn(() => ({ run }));
  const toggleBlockquote = vi.fn(() => ({ run }));
  const toggleHeading = vi.fn(() => ({ run }));
  const undo = vi.fn(() => ({ run }));
  const redo = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    toggleHeading,
    undo,
    redo,
    run,
  }));

  const setContent = vi.fn();
  const getHTML = vi.fn(() => section.contenu_html);
  const getText = vi.fn(() => "Bonjour {{client}} et {{montant}} puis {{client}}");
  const isActive = vi.fn(() => false);
  const canUndo = vi.fn(() => true);
  const canRedo = vi.fn(() => false);

  const useEditor = vi.fn((options: Record<string, unknown>) => {
    latest.current = options;
    return {
      commands: { setContent },
      getHTML,
      getText,
      chain: () => ({ focus }),
      isActive,
      can: () => ({ undo: canUndo, redo: canRedo }),
    };
  });

  return {
    SECTION: section,
    LOCKED_SECTION: lockedSection,
    mockUseEditor: useEditor,
    mockSetContent: setContent,
    mockGetHTML: getHTML,
    mockGetText: getText,
    mockChainFocus: focus,
    mockToggleBold: toggleBold,
    mockToggleItalic: toggleItalic,
    mockToggleUnderline: toggleUnderline,
    mockToggleBulletList: toggleBulletList,
    mockToggleOrderedList: toggleOrderedList,
    mockToggleBlockquote: toggleBlockquote,
    mockToggleHeading: toggleHeading,
    mockUndo: undo,
    mockRedo: redo,
    mockRun: run,
    mockIsActive: isActive,
    mockCanUndo: canUndo,
    mockCanRedo: canRedo,
    latestEditorOptions: latest,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
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
      then: (resolve: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
      catch: (reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(reject),
    };
    return builder;
  };

  return {
    supabase: {
      from: vi.fn(() => createBuilder()),
    },
  };
});

vi.mock("@tiptap/react", () => ({
  useEditor: mockUseEditor,
  EditorContent: ({ className }: { className?: string }) => (
    <div data-testid="editor-content" className={className}>
      editor
    </div>
  ),
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: {
    configure: vi.fn(() => ({ name: "starter-kit" })),
  },
}));

vi.mock("@tiptap/extension-underline", () => ({
  default: {
    extend: vi.fn(() => ({
      name: "underline-contract",
    })),
  },
}));

vi.mock("@tiptap/extension-link", () => ({
  default: {
    extend: vi.fn(() => ({
      configure: vi.fn(() => ({ name: "link-contract" })),
    })),
  },
}));

vi.mock("@tiptap/extension-placeholder", () => ({
  default: {
    configure: vi.fn(() => ({ name: "placeholder" })),
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: { className?: string }) => <div data-testid="separator" className={className} />,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Bold: Icon,
    Italic: Icon,
    Underline: Icon,
    List: Icon,
    ListOrdered: Icon,
    Heading1: Icon,
    Heading2: Icon,
    Heading3: Icon,
    Quote: Icon,
    Undo: Icon,
    Redo: Icon,
    Sparkles: Icon,
    Loader2: Icon,
    Variable: Icon,
    History: Icon,
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("./ContractAIToolbar", () => ({
  ContractAIToolbar: ({
    content,
    sectionTitle,
    onApply,
    onClose,
  }: {
    content: string;
    sectionTitle: string;
    onApply: (content: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="ai-toolbar">
      <span>{content}</span>
      <span>{sectionTitle}</span>
      <button type="button" onClick={() => onApply("<p>Contenu IA</p>")}>
        apply-ai
      </button>
      <button type="button" onClick={onClose}>
        close-ai
      </button>
    </div>
  ),
}));

vi.mock("./SectionVersionsDialog", () => ({
  SectionVersionsDialog: ({
    open,
    sectionId,
    sectionTitle,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sectionId?: string;
    sectionTitle?: string;
  }) =>
    open ? (
      <div data-testid="versions-dialog">
        {sectionId}-{sectionTitle}
      </div>
    ) : null,
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

describe("ContractSectionEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHTML.mockReturnValue(SECTION.contenu_html);
    mockGetText.mockReturnValue("Bonjour {{client}} et {{montant}} puis {{client}}");
    mockCanUndo.mockReturnValue(true);
    mockCanRedo.mockReturnValue(false);
  });

  it("affiche l'état vide quand aucune section n'est sélectionnée", () => {
    render(<ContractSectionEditor section={undefined} onUpdate={vi.fn()} />, { wrapper: createWrapper() });

    expect(screen.getByText("Sélectionnez une section")).toBeInTheDocument();
    expect(screen.getByText("pour commencer à éditer")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Titre de la section")).not.toBeInTheDocument();
  });

  it("affiche les données métier de la section et les variables détectées", () => {
    render(<ContractSectionEditor section={SECTION} onUpdate={vi.fn()} isSaving />, { wrapper: createWrapper() });

    expect(screen.getByDisplayValue("Clause de paiement")).toBeInTheDocument();
    expect(screen.getByText("payment")).toBeInTheDocument();
    expect(screen.getByText("Depuis bibliothèque")).toBeInTheDocument();
    expect(screen.getByText("{{client}}")).toBeInTheDocument();
    expect(screen.getByText("{{montant}}")).toBeInTheDocument();
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("met à jour le titre au blur avec une valeur trimmée", () => {
    const onUpdate = vi.fn();
    render(<ContractSectionEditor section={SECTION} onUpdate={onUpdate} />, { wrapper: createWrapper() });

    const input = screen.getByDisplayValue("Clause de paiement");
    fireEvent.change(input, { target: { value: "  Nouveau titre  " } });
    fireEvent.blur(input);

    expect(onUpdate).toHaveBeenCalledWith({ titre: "Nouveau titre" });
  });

  it("ne met pas à jour le titre si inchangé ou vide après trim", () => {
    const onUpdate = vi.fn();
    render(<ContractSectionEditor section={SECTION} onUpdate={onUpdate} />, { wrapper: createWrapper() });

    const input = screen.getByDisplayValue("Clause de paiement");
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("déclenche la mise à jour du contenu après debounce via onUpdate de l'éditeur", async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();

    render(<ContractSectionEditor section={SECTION} onUpdate={onUpdate} />, { wrapper: createWrapper() });

    const options = latestEditorOptions.current as { onUpdate?: (payload: { editor: { getHTML: () => string } }) => void };
    mockGetHTML.mockReturnValue("<p>Texte modifié</p>");

    await act(async () => {
      options.onUpdate?.({
        editor: {
          getHTML: () => "<p>Texte modifié</p>",
        },
      });
      vi.advanceTimersByTime(1000);
    });

    expect(onUpdate).toHaveBeenCalledWith({ contenu_html: "<p>Texte modifié</p>" });
    vi.useRealTimers();
  });

  it("synchronise le contenu de l'éditeur quand la section change", async () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<ContractSectionEditor section={SECTION} onUpdate={onUpdate} />, {
      wrapper: createWrapper(),
    });

    mockGetHTML.mockReturnValue("<p>Ancien contenu</p>");

    rerender(<ContractSectionEditor section={{ ...SECTION, id: "sec-9", contenu_html: "<p>Nouveau</p>" }} onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(mockSetContent).toHaveBeenCalledWith("<p>Nouveau</p>");
    });
  });

  it("active les actions de toolbar formatting", () => {
    render(<ContractSectionEditor section={SECTION} onUpdate={vi.fn()} />, { wrapper: createWrapper() });

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);

    expect(mockChainFocus).toHaveBeenCalled();
    expect(mockToggleBold).toHaveBeenCalled();
    expect(mockToggleItalic).toHaveBeenCalled();
    expect(mockToggleUnderline).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
  });

  it("ouvre l'historique et la toolbar IA puis applique le contenu IA", () => {
    const onUpdate = vi.fn();
    render(<ContractSectionEditor section={SECTION} onUpdate={onUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText("Historique"));
    expect(screen.getByTestId("versions-dialog")).toHaveTextContent("sec-1-Clause de paiement");

    fireEvent.click(screen.getByText("IA"));
    expect(screen.getByTestId("ai-toolbar")).toHaveTextContent("Clause de paiement");

    fireEvent.click(screen.getByText("apply-ai"));

    expect(mockSetContent).toHaveBeenCalledWith("<p>Contenu IA</p>");
    expect(onUpdate).toHaveBeenCalledWith({ contenu_html: "<p>Contenu IA</p>" });
  });

  it("masque la toolbar d'édition et désactive le titre pour une section verrouillée", () => {
    render(<ContractSectionEditor section={LOCKED_SECTION} onUpdate={vi.fn()} />, { wrapper: createWrapper() });

    expect(screen.getByDisplayValue("Section verrouillée")).toBeDisabled();
    expect(screen.getByText("Verrouillé")).toBeInTheDocument();
    expect(screen.queryByText("IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Historique")).not.toBeInTheDocument();
  });
});