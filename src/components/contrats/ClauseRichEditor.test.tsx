/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ClauseRichEditor } from "./ClauseRichEditor";

const {
  editorState,
  chainMethods,
  canMethods,
  mockUseEditor,
  mockPrompt,
} = vi.hoisted(() => {
  const editorState = {
    html: "<p>Initial</p>",
    text: "Initial",
    active: new Map<string, boolean>(),
    canUndo: true,
    canRedo: true,
    onUpdate: undefined as
      | ((payload: { editor: { getHTML: () => string } }) => void)
      | undefined,
    setContentCalls: [] as string[],
    toggleBoldCalls: 0,
    toggleItalicCalls: 0,
    toggleUnderlineCalls: 0,
    toggleBulletListCalls: 0,
    toggleOrderedListCalls: 0,
    undoCalls: 0,
    redoCalls: 0,
    setLinkCalls: [] as Array<{ href: string }>,
    toggleHeadingCalls: [] as Array<{ level: number }>,
    runCalls: 0,
  };

  const builder = {
    focus: vi.fn(() => builder),
    toggleBold: vi.fn(() => {
      editorState.toggleBoldCalls += 1;
      return builder;
    }),
    toggleItalic: vi.fn(() => {
      editorState.toggleItalicCalls += 1;
      return builder;
    }),
    toggleUnderline: vi.fn(() => {
      editorState.toggleUnderlineCalls += 1;
      return builder;
    }),
    toggleBulletList: vi.fn(() => {
      editorState.toggleBulletListCalls += 1;
      return builder;
    }),
    toggleOrderedList: vi.fn(() => {
      editorState.toggleOrderedListCalls += 1;
      return builder;
    }),
    toggleHeading: vi.fn((payload: { level: number }) => {
      editorState.toggleHeadingCalls.push(payload);
      return builder;
    }),
    setLink: vi.fn((payload: { href: string }) => {
      editorState.setLinkCalls.push(payload);
      return builder;
    }),
    undo: vi.fn(() => {
      editorState.undoCalls += 1;
      return builder;
    }),
    redo: vi.fn(() => {
      editorState.redoCalls += 1;
      return builder;
    }),
    run: vi.fn(() => {
      editorState.runCalls += 1;
      return true;
    }),
  };

  const canMethods = {
    undo: vi.fn(() => editorState.canUndo),
    redo: vi.fn(() => editorState.canRedo),
  };

  const mockUseEditor = vi.fn(
    (options: {
      content: string;
      editable: boolean;
      onUpdate?: (payload: { editor: { getHTML: () => string } }) => void;
    }) => {
      editorState.onUpdate = options.onUpdate;

      return {
        getHTML: () => editorState.html,
        getText: () => editorState.text,
        chain: () => builder,
        can: () => canMethods,
        isActive: (name: string, attrs?: { level?: number }) => {
          if (name === "heading" && attrs?.level) {
            return editorState.active.get(`heading-${attrs.level}`) ?? false;
          }
          return editorState.active.get(name) ?? false;
        },
        commands: {
          setContent: (value: string) => {
            editorState.html = value;
            editorState.setContentCalls.push(value);
          },
        },
      };
    }
  );

  const mockPrompt = vi.fn();

  return {
    editorState,
    chainMethods: builder,
    canMethods,
    mockUseEditor,
    mockPrompt,
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
      name: "underline-clause",
    })),
  },
}));

vi.mock("@tiptap/extension-link", () => ({
  default: {
    extend: vi.fn(() => ({
      configure: vi.fn(() => ({ name: "link-clause" })),
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
    title,
    onClick,
    disabled,
    type,
    className,
  }: {
    children: React.ReactNode;
    title?: string;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    className?: string;
  }) => (
    <button
      type={type ?? "button"}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
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
  Separator: ({ className }: { className?: string }) => (
    <div data-testid="separator" className={className} />
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Bold: Icon,
    Italic: Icon,
    Underline: Icon,
    List: Icon,
    ListOrdered: Icon,
    Link: Icon,
    Heading1: Icon,
    Heading2: Icon,
    Heading3: Icon,
    Undo: Icon,
    Redo: Icon,
    Sparkles: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...parts: Array<string | undefined | false | null>) => parts.filter(Boolean).join(" "),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("ClauseRichEditor", () => {
  beforeEach(() => {
    editorState.html = "<p>Initial</p>";
    editorState.text = "Initial";
    editorState.active = new Map<string, boolean>();
    editorState.canUndo = true;
    editorState.canRedo = true;
    editorState.onUpdate = undefined;
    editorState.setContentCalls = [];
    editorState.toggleBoldCalls = 0;
    editorState.toggleItalicCalls = 0;
    editorState.toggleUnderlineCalls = 0;
    editorState.toggleBulletListCalls = 0;
    editorState.toggleOrderedListCalls = 0;
    editorState.undoCalls = 0;
    editorState.redoCalls = 0;
    editorState.setLinkCalls = [];
    editorState.toggleHeadingCalls = [];
    editorState.runCalls = 0;

    chainMethods.focus.mockClear();
    chainMethods.toggleBold.mockClear();
    chainMethods.toggleItalic.mockClear();
    chainMethods.toggleUnderline.mockClear();
    chainMethods.toggleBulletList.mockClear();
    chainMethods.toggleOrderedList.mockClear();
    chainMethods.toggleHeading.mockClear();
    chainMethods.setLink.mockClear();
    chainMethods.undo.mockClear();
    chainMethods.redo.mockClear();
    chainMethods.run.mockClear();
    canMethods.undo.mockClear();
    canMethods.redo.mockClear();
    mockUseEditor.mockClear();
    mockPrompt.mockReset();

    vi.stubGlobal("prompt", mockPrompt);
  });

  it("gère chargement puis succès puis erreur avec renderHook et QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const successHook = renderHook(
      () =>
        useQuery({
          queryKey: ["success"],
          queryFn: async () => "ok",
        }),
      { wrapper }
    );

    expect(successHook.result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(successHook.result.current.isSuccess).toBe(true);
    });

    expect(successHook.result.current.data).toBe("ok");

    const errorHook = renderHook(
      () =>
        useQuery({
          queryKey: ["error"],
          queryFn: async () => {
            throw new Error("x");
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(errorHook.result.current.isError).toBe(true);
    });

    expect(errorHook.result.current.error?.message).toBe("x");
  });

  it("affiche la toolbar, l'indicateur IA disponible et les variables détectées dédupliquées", async () => {
    editorState.html = "<p>Bonjour {{client}} et {{montant}}</p>";
    editorState.text = "Bonjour {{client}} et {{montant}} et {{client}}";

    render(
      <ClauseRichEditor
        value="<p>Bonjour {{client}} et {{montant}}</p>"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTitle("Gras (Ctrl+B)")).toBeInTheDocument();
    expect(screen.getByTitle("Italique (Ctrl+I)")).toBeInTheDocument();
    expect(screen.getByTitle("Souligné (Ctrl+U)")).toBeInTheDocument();
    expect(screen.getByText("IA disponible")).toBeInTheDocument();
    expect(screen.getByText("Variables détectées :")).toBeInTheDocument();
    expect(screen.getByText("{{client}}")).toBeInTheDocument();
    expect(screen.getByText("{{montant}}")).toBeInTheDocument();
    expect(screen.getAllByText("{{client}}")).toHaveLength(1);

    await waitFor(() => {
      expect(mockUseEditor).toHaveBeenCalledTimes(1);
    });
  });

  it("synchronise une nouvelle valeur externe via setContent", async () => {
    const onChange = vi.fn();
    editorState.html = "<p>Alpha</p>";

    const { rerender } = render(
      <ClauseRichEditor value="<p>Alpha</p>" onChange={onChange} />
    );

    expect(editorState.setContentCalls).toEqual([]);

    await act(async () => {
      rerender(<ClauseRichEditor value="<p>Beta</p>" onChange={onChange} />);
    });

    await waitFor(() => {
      expect(editorState.setContentCalls).toEqual(["<p>Beta</p>"]);
    });

    expect(editorState.html).toBe("<p>Beta</p>");
  });

  it("déclenche onChange avec le HTML métier réel lors d'une mise à jour éditeur", async () => {
    const onChange = vi.fn();

    render(<ClauseRichEditor value="<p>Init</p>" onChange={onChange} />);

    editorState.html = "<p>Clause mise à jour {{client}}</p>";

    await act(async () => {
      editorState.onUpdate?.({
        editor: {
          getHTML: () => "<p>Clause mise à jour {{client}}</p>",
        },
      });
    });

    expect(onChange).toHaveBeenCalledWith("<p>Clause mise à jour {{client}}</p>");
  });

  it("exécute les actions de formatage et de structure", () => {
    editorState.active.set("bold", true);
    editorState.active.set("underline", true);

    render(<ClauseRichEditor value="<p>Texte</p>" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTitle("Gras (Ctrl+B)"));
    fireEvent.click(screen.getByTitle("Italique (Ctrl+I)"));
    fireEvent.click(screen.getByTitle("Souligné (Ctrl+U)"));
    fireEvent.click(screen.getByTitle("Titre 1"));
    fireEvent.click(screen.getByTitle("Titre 2"));
    fireEvent.click(screen.getByTitle("Titre 3"));
    fireEvent.click(screen.getByTitle("Liste à puces"));
    fireEvent.click(screen.getByTitle("Liste numérotée"));

    expect(chainMethods.focus).toHaveBeenCalledTimes(8);
    expect(chainMethods.toggleBold).toHaveBeenCalledTimes(1);
    expect(chainMethods.toggleItalic).toHaveBeenCalledTimes(1);
    expect(chainMethods.toggleUnderline).toHaveBeenCalledTimes(1);
    expect(chainMethods.toggleHeading).toHaveBeenCalledWith({ level: 1 });
    expect(chainMethods.toggleHeading).toHaveBeenCalledWith({ level: 2 });
    expect(chainMethods.toggleHeading).toHaveBeenCalledWith({ level: 3 });
    expect(chainMethods.toggleBulletList).toHaveBeenCalledTimes(1);
    expect(chainMethods.toggleOrderedList).toHaveBeenCalledTimes(1);
    expect(chainMethods.run).toHaveBeenCalledTimes(8);
  });

  it("insère un lien quand une URL est fournie", () => {
    mockPrompt.mockReturnValue("https://site.test");

    render(<ClauseRichEditor value="<p>Lien</p>" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTitle("Insérer un lien"));

    expect(mockPrompt).toHaveBeenCalledWith("URL du lien:");
    expect(chainMethods.focus).toHaveBeenCalled();
    expect(chainMethods.setLink).toHaveBeenCalledWith({ href: "https://site.test" });
    expect(chainMethods.run).toHaveBeenCalled();
  });

  it("n'insère pas de lien quand le prompt est annulé", () => {
    mockPrompt.mockReturnValue("");

    render(<ClauseRichEditor value="<p>Lien</p>" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTitle("Insérer un lien"));

    expect(mockPrompt).toHaveBeenCalledWith("URL du lien:");
    expect(chainMethods.setLink).not.toHaveBeenCalled();
  });

  it("exécute undo et redo quand disponibles", () => {
    render(<ClauseRichEditor value="<p>Historique</p>" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTitle("Annuler (Ctrl+Z)"));
    fireEvent.click(screen.getByTitle("Rétablir (Ctrl+Y)"));

    expect(chainMethods.undo).toHaveBeenCalledTimes(1);
    expect(chainMethods.redo).toHaveBeenCalledTimes(1);
  });

  it("désactive undo/redo selon les capacités de l'éditeur", () => {
    editorState.canUndo = false;
    editorState.canRedo = false;

    render(<ClauseRichEditor value="<p>Historique</p>" onChange={vi.fn()} />);

    expect(screen.getByTitle("Annuler (Ctrl+Z)")).toBeDisabled();
    expect(screen.getByTitle("Rétablir (Ctrl+Y)")).toBeDisabled();
  });

  it("affiche l'état de chargement IA et désactive les boutons quand disabled=true", () => {
    render(
      <ClauseRichEditor
        value="<p>IA</p>"
        onChange={vi.fn()}
        disabled
        isProcessingAI
      />
    );

    expect(screen.getByText("IA en cours...")).toBeInTheDocument();
    expect(screen.getByText("Traitement IA en cours...")).toBeInTheDocument();
    expect(screen.getByTitle("Gras (Ctrl+B)")).toBeDisabled();
    expect(screen.getByTitle("Italique (Ctrl+I)")).toBeDisabled();
    expect(screen.getByTitle("Annuler (Ctrl+Z)")).toBeDisabled();
  });

  it("masque la toolbar IA quand showAIToolbar=false", () => {
    render(
      <ClauseRichEditor
        value="<p>Sans IA</p>"
        onChange={vi.fn()}
        showAIToolbar={false}
      />
    );

    expect(screen.queryByText("IA disponible")).not.toBeInTheDocument();
    expect(screen.queryByText("IA en cours...")).not.toBeInTheDocument();
  });

  it("retourne null si useEditor ne fournit pas d'éditeur (cas erreur)", () => {
    mockUseEditor.mockImplementationOnce(() => null);

    const { container } = render(
      <ClauseRichEditor value="<p>Erreur</p>" onChange={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});