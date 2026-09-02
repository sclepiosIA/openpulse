import { render, screen, fireEvent, act } from "@testing-library/react";
import { CopilotSidePanel } from "./CopilotSidePanel";
import { toast } from "sonner";

const { mockStart, mockStop, streamState } = vi.hoisted(() => ({
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  streamState: { isStreaming: false },
}));

vi.mock("./useCopilotStream", () => ({
  useCopilotStream: () => ({
    start: mockStart,
    stop: mockStop,
    isStreaming: streamState.isStreaming,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("dompurify", () => ({
  default: { sanitize: (html: string) => html },
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    variant: _v,
    size: _s,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    variant?: string;
    size?: string;
  }) => <button {...rest}>{children}</button>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

interface StartOpts {
  messages: Array<{ role: string; content: string }>;
  documentTitle?: string;
  documentHtml?: string;
  contextSummary?: string;
  documentId?: string | null;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

function lastStartOpts(): StartOpts {
  const calls = mockStart.mock.calls;
  return calls[calls.length - 1][0] as StartOpts;
}

beforeAll(() => {
  window.HTMLElement.prototype.scrollTo = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  streamState.isStreaming = false;
});

describe("CopilotSidePanel", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    documentTitle: "Mon document",
    documentHtml: "<p>contenu</p>",
    documentId: "doc-1",
  };

  it("affiche le titre et les suggestions quand il n'y a pas de messages", () => {
    render(<CopilotSidePanel {...baseProps} />);
    expect(screen.getByText("Copilot IA")).toBeInTheDocument();
    expect(screen.getByText("Résume ce document en 5 puces")).toBeInTheDocument();
    expect(
      screen.getByText("Génère un plan pour compléter ce document"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Contexte : le contenu du document et son titre sont partagés avec l'IA.",
      ),
    ).toBeInTheDocument();
  });

  it("ne rend rien quand open=false", () => {
    render(<CopilotSidePanel {...baseProps} open={false} />);
    expect(screen.queryByText("Copilot IA")).not.toBeInTheDocument();
  });

  it("envoie une suggestion cliquée via start avec le contexte du document", () => {
    render(<CopilotSidePanel {...baseProps} />);
    fireEvent.click(screen.getByText("Résume ce document en 5 puces"));
    expect(mockStart).toHaveBeenCalledTimes(1);
    const opts = lastStartOpts();
    expect(opts.messages).toEqual([
      { role: "user", content: "Résume ce document en 5 puces" },
    ]);
    expect(opts.documentTitle).toBe("Mon document");
    expect(opts.documentHtml).toBe("<p>contenu</p>");
    expect(opts.documentId).toBe("doc-1");
    expect(screen.getByText("Résume ce document en 5 puces")).toBeInTheDocument();
  });

  it("envoie le texte saisi avec la touche Entrée", () => {
    render(<CopilotSidePanel {...baseProps} />);
    const textarea = screen.getByPlaceholderText("Question sur ce document…");
    fireEvent.change(textarea, { target: { value: "  Quelle est la conclusion ?  " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(lastStartOpts().messages).toEqual([
      { role: "user", content: "Quelle est la conclusion ?" },
    ]);
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("n'envoie rien si l'entrée est vide", () => {
    render(<CopilotSidePanel {...baseProps} />);
    const textarea = screen.getByPlaceholderText("Question sur ce document…");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("affiche le contenu streamé puis le message assistant final via onDelta/onDone", async () => {
    render(<CopilotSidePanel {...baseProps} />);
    fireEvent.click(screen.getByText("Résume ce document en 5 puces"));
    const opts = lastStartOpts();
    await act(async () => {
      opts.onDelta("Voici le ");
      opts.onDelta("résumé.");
    });
    expect(screen.getByText("Voici le résumé.")).toBeInTheDocument();
    await act(async () => {
      opts.onDone();
    });
    expect(screen.getByText("Voici le résumé.")).toBeInTheDocument();
    expect(screen.getByText("Copier")).toBeInTheDocument();
  });

  it("affiche un toast d'erreur via onError", async () => {
    render(<CopilotSidePanel {...baseProps} />);
    fireEvent.click(screen.getByText("Résume ce document en 5 puces"));
    const opts = lastStartOpts();
    await act(async () => {
      opts.onError("Quota dépassé");
    });
    expect(toast.error).toHaveBeenCalledWith("Quota dépassé");
  });

  it("copie le contenu d'un message assistant dans le presse-papier", async () => {
    render(<CopilotSidePanel {...baseProps} />);
    fireEvent.click(screen.getByText("Résume ce document en 5 puces"));
    const opts = lastStartOpts();
    await act(async () => {
      opts.onDelta("Réponse IA");
      opts.onDone();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Copier"));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Réponse IA");
    expect(toast.success).toHaveBeenCalledWith("Copié");
  });

  it("insère le markdown converti en HTML via onInsertAtCursor", async () => {
    const onInsertAtCursor = vi.fn();
    render(<CopilotSidePanel {...baseProps} onInsertAtCursor={onInsertAtCursor} />);
    fireEvent.click(screen.getByText("Résume ce document en 5 puces"));
    const opts = lastStartOpts();
    await act(async () => {
      opts.onDelta("## Titre\n- point **fort**");
      opts.onDone();
    });
    fireEvent.click(screen.getByText("Insérer dans le document"));
    expect(onInsertAtCursor).toHaveBeenCalledWith(
      "<h2>Titre</h2><ul><li>point <strong>fort</strong></li></ul>",
    );
    expect(toast.success).toHaveBeenCalledWith("Inséré dans le document");
  });

  it("désactive la saisie et affiche le bouton Arrêter pendant le streaming", () => {
    streamState.isStreaming = true;
    render(<CopilotSidePanel {...baseProps} />);
    const textarea = screen.getByPlaceholderText("Question sur ce document…");
    expect(textarea).toBeDisabled();
    const stopBtn = screen.getByTitle("Arrêter");
    fireEvent.click(stopBtn);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle("Envoyer (Entrée)")).not.toBeInTheDocument();
  });

  it("efface la conversation avec le bouton Nouveau chat", async () => {
    render(<CopilotSidePanel {...baseProps} />);
    fireEvent.click(screen.getByText("Résume ce document en 5 puces"));
    const opts = lastStartOpts();
    await act(async () => {
      opts.onDelta("Réponse");
      opts.onDone();
    });
    fireEvent.click(screen.getByTitle("Nouveau chat"));
    expect(screen.queryByText("Réponse")).not.toBeInTheDocument();
    expect(screen.getByText("Résume ce document en 5 puces")).toBeInTheDocument();
  });

  it("appelle onOpenChange(false) au clic sur Fermer", () => {
    const onOpenChange = vi.fn();
    render(<CopilotSidePanel {...baseProps} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTitle("Fermer"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});