// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, renderHook } from "@testing-library/react";
import { act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { EmailReplyAll } from "./EmailReplyAll";

const {
  mockFrom,
  mockInvokeEdge,
  mockToastSuccess,
  mockToastError,
  mockToastWarning,
  mockSanitizeSupabaseError,
  mockBuildQuotedBody,
  mockOnSent,
  mockOnCancel,
  stableSignatureData,
  mockDebugLog,
  mockDebugError,
  stableSupabaseResult,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInvokeEdge: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockBuildQuotedBody: vi.fn(),
  mockOnSent: vi.fn(),
  mockOnCancel: vi.fn(),
  stableSignatureData: { signature: "Cordialement,<br>Jean" },
  mockDebugLog: vi.fn(),
  mockDebugError: vi.fn(),
  stableSupabaseResult: { data: null, error: null },
}));

vi.mock("@/integrations/supabase/client", () => {
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
    single: vi.fn(async () => stableSupabaseResult),
    maybeSingle: vi.fn(async () => stableSupabaseResult),
    then: (resolve: (value: typeof stableSupabaseResult) => unknown) =>
      Promise.resolve(stableSupabaseResult).then(resolve),
    catch: (reject: (reason: unknown) => unknown) =>
      Promise.resolve(stableSupabaseResult).catch(reject),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const label = props["aria-label"];
    return (
      <button {...props} aria-label={label}>
        {props.children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{props.children}</div>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-icon" {...props} />,
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("./RichTextEditor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    disabled,
    placeholder,
  }: {
    content: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <input
      data-testid="rich-text-editor"
      value={content}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("./EmailAIAssistant", () => ({
  EmailAIAssistant: ({
    onIcsGenerated,
    onAnimationStateChange,
  }: {
    onIcsGenerated: (ics: string) => void;
    onAnimationStateChange: (animating: boolean, processing: boolean) => void;
  }) => (
    <div>
      <button type="button" data-testid="generate-ics" onClick={() => onIcsGenerated("BEGIN:VCALENDAR\nEND:VCALENDAR")}>
        Generate ICS
      </button>
      <button type="button" data-testid="ai-busy" onClick={() => onAnimationStateChange(true, true)}>
        AI Busy
      </button>
      <button type="button" data-testid="ai-idle" onClick={() => onAnimationStateChange(false, false)}>
        AI Idle
      </button>
    </div>
  ),
}));

vi.mock("./TemplateSelector", () => ({
  TemplateSelector: ({
    onInsert,
  }: {
    onInsert: (content: string) => void;
    currentSubject: string;
    currentBody: string;
  }) => (
    <button type="button" data-testid="insert-template" onClick={() => onInsert("Bonjour équipe")}>
      Insert Template
    </button>
  ),
}));

vi.mock("@/hooks/email/useEmailSignature", () => ({
  useEmailSignature: () => stableSignatureData,
}));

vi.mock("./EmailRecipientInput", () => ({
  EmailRecipientInput: ({
    label,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    value: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <div>
      <label>{label}</label>
      <input
        aria-label={label}
        data-testid={`recipient-${label}`}
        value={value.join(",")}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          )
        }
      />
    </div>
  ),
}));

vi.mock("./EmailSendProgress", () => ({
  EmailSendProgress: ({ isSending }: { isSending: boolean }) =>
    isSending ? <div data-testid="send-progress">Sending...</div> : null,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: mockDebugLog,
    error: mockDebugError,
  },
}));

vi.mock("@/lib/emailQuotedBody", () => ({
  buildQuotedBody: mockBuildQuotedBody,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { Wrapper, queryClient };
}

const defaultProps = {
  threadId: "thread-1",
  accountId: "account-1",
  toAddresses: ["alice@example.com"],
  ccAddresses: ["bob@example.com"],
  subject: "Point hebdo",
  onCancel: mockOnCancel,
  onSent: mockOnSent,
  threadParticipants: [{ email: "alice@example.com", name: "Alice" }],
  threadMessages: [
    {
      from_name: "Alice",
      from_address: "alice@example.com",
      body_text: "Dernier message",
      sent_date: "2024-02-01T10:00:00Z",
    },
  ],
  lastMessageId: "msg-last",
  allMessageIds: ["msg-1", "msg-last"],
};

describe("EmailReplyAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeSupabaseError.mockReturnValue("erreur nettoyée");
    mockBuildQuotedBody.mockReturnValue("Le 1 févr. Alice a écrit:\nDernier message");
  });

  it("utilise renderHook avec QueryClientProvider et la config requise", () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => {
      const qc = useQueryClient();
      const state = React.useState("ok");
      return { qc, state };
    }, { wrapper: Wrapper });

    expect(result.current.state[0]).toBe("ok");
    expect(result.current.qc).toBeDefined();
  });

  it("affiche le chargement pendant l'envoi puis envoie avec les données métier attendues", async () => {
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    let resolveSend: ((value: { id: string }) => void) | undefined;
    mockInvokeEdge.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve as (value: { id: string }) => void;
        })
    );

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<EmailReplyAll {...defaultProps} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId("insert-template"));
    fireEvent.click(screen.getByTestId("generate-ics"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    expect(screen.getByTestId("send-progress")).toBeInTheDocument();
    expect(mockDebugLog).toHaveBeenCalledWith("[EmailReplyAll] Sending with ICS:", "YES");

    await act(async () => {
      if (resolveSend) {
        resolveSend({ id: "sent-1" });
      }
    });

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledTimes(1);
    });

    expect(mockInvokeEdge).toHaveBeenCalledWith("send-email-reply", {
      thread_id: "thread-1",
      account_id: "account-1",
      to: ["alice@example.com"],
      cc: ["bob@example.com"],
      subject: "Re: Point hebdo",
      body:
        'Bonjour équipe<br><br>Cordialement,<br>Jean<br><br><div style="border-left:2px solid #ccc;padding-left:8px;color:#555;">Le 1 févr. Alice a écrit:<br>Dernier message</div>',
      ics_content: "BEGIN:VCALENDAR\nEND:VCALENDAR",
      in_reply_to: "msg-last",
      references: ["msg-1", "msg-last"],
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Email envoyé avec succès");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["threads-enriched-data"] });
      expect(mockOnSent).toHaveBeenCalledTimes(1);
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const eventArg = dispatchSpy.mock.calls[0][0];
    expect(eventArg).toBeInstanceOf(CustomEvent);
    expect((eventArg as CustomEvent).type).toBe("email-thread-updated");
    expect((eventArg as CustomEvent).detail).toEqual({ threadId: "thread-1" });
  });

  it("affiche une erreur si le message est vide", async () => {
    const { Wrapper } = createWrapper();

    render(<EmailReplyAll {...defaultProps} />, { wrapper: Wrapper });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Le message ne peut pas être vide");
    });

    expect(mockInvokeEdge).not.toHaveBeenCalled();
  });

  it("affiche une erreur si la liste des destinataires est vide", async () => {
    const { Wrapper } = createWrapper();

    render(<EmailReplyAll {...defaultProps} toAddresses={["alice@example.com"]} />, { wrapper: Wrapper });

    fireEvent.change(screen.getByTestId("recipient-À:"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("insert-template"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Vous devez avoir au moins un destinataire");
    });

    expect(mockInvokeEdge).not.toHaveBeenCalled();
  });

  it("affiche une erreur si accountId est invalide", async () => {
    const { Wrapper } = createWrapper();

    render(<EmailReplyAll {...defaultProps} accountId="all" />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId("insert-template"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Impossible de déterminer le compte email à utiliser");
    });

    expect(mockInvokeEdge).not.toHaveBeenCalled();
  });

  it("gère l'erreur d'envoi et sanitise le message", async () => {
    const { Wrapper } = createWrapper();
    mockInvokeEdge.mockRejectedValue({ message: "x" });

    render(<EmailReplyAll {...defaultProps} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId("insert-template"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalled();
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: "x" });
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'envoi de l'email: erreur nettoyée");
    });

    expect(mockOnSent).not.toHaveBeenCalled();
  });

  it("gère le cas d'erreur de type réponse null avec message x", async () => {
    const { Wrapper } = createWrapper();
    mockSanitizeSupabaseError.mockReturnValue("x");
    mockInvokeEdge.mockRejectedValue({ data: null, error: { message: "x" } });

    render(<EmailReplyAll {...defaultProps} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId("insert-template"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ data: null, error: { message: "x" } });
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'envoi de l'email: x");
    });
  });

  it("affiche un warning si la réponse contient un avertissement", async () => {
    const { Wrapper } = createWrapper();
    mockInvokeEdge.mockResolvedValue({ warning: "stockage partiel" });

    render(<EmailReplyAll {...defaultProps} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId("insert-template"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith("Email envoyé avec avertissement: stockage partiel");
      expect(mockOnSent).toHaveBeenCalledTimes(1);
    });
  });

  it("appelle onCancel via le bouton Fermer et le bouton Annuler", () => {
    const { Wrapper } = createWrapper();

    render(<EmailReplyAll {...defaultProps} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(mockOnCancel).toHaveBeenCalledTimes(2);
  });

  it("bascule en mode texte et envoie avec saut de ligne et sujet déjà préfixé", async () => {
    const { Wrapper } = createWrapper();
    mockBuildQuotedBody.mockReturnValue("Citation texte");
    mockInvokeEdge.mockResolvedValue({ ok: true });

    render(<EmailReplyAll {...defaultProps} subject="Re: Déjà répondu" />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "Mode Texte" }));
    fireEvent.change(screen.getByPlaceholderText("Composez votre réponse ici..."), {
      target: { value: "Réponse simple" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer à tous" }));
    });

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledTimes(1);
    });

    expect(mockInvokeEdge).toHaveBeenCalledWith("send-email-reply", {
      thread_id: "thread-1",
      account_id: "account-1",
      to: ["alice@example.com"],
      cc: ["bob@example.com"],
      subject: "Re: Déjà répondu",
      body: "Réponse simple\n\nCordialement,<br>Jean\n\nCitation texte",
      ics_content: undefined,
      in_reply_to: "msg-last",
      references: ["msg-1", "msg-last"],
    });
  });

  it("désactive l'éditeur quand l'IA est en cours d'animation ou de traitement", () => {
    const { Wrapper } = createWrapper();

    render(<EmailReplyAll {...defaultProps} />, { wrapper: Wrapper });

    const editor = screen.getByTestId("rich-text-editor");
    expect(editor).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("ai-busy"));
    expect(screen.getByTestId("rich-text-editor")).toBeDisabled();

    fireEvent.click(screen.getByTestId("ai-idle"));
    expect(screen.getByTestId("rich-text-editor")).not.toBeDisabled();
  });
});