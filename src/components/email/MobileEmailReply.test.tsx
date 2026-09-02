/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MobileEmailReply } from "./MobileEmailReply";

const {
  mockToastSuccess,
  mockToastError,
  mockToastWarning,
  mockInvokeEdge,
  mockBuildQuotedBody,
  mockSanitizeSupabaseError,
  mockDebugError,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
  mockInvokeEdge: vi.fn(),
  mockBuildQuotedBody: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning,
  },
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock("@/lib/emailQuotedBody", () => ({
  buildQuotedBody: mockBuildQuotedBody,
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    className,
    autoFocus,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
  }) => (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <label className={className}>{children}</label>,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  Send: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="send-icon" {...props} />,
}));

describe("MobileEmailReply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildQuotedBody.mockReturnValue("");
    mockSanitizeSupabaseError.mockReturnValue("Erreur nettoyée");
  });

  it("affiche les informations du destinataire et l'état initial désactivé tant que le message est vide", () => {
    const onCancel = vi.fn();
    const onSent = vi.fn();

    render(
      <MobileEmailReply
        threadId="thread-1"
        accountId="acc-1"
        toAddress="dest@example.com"
        replyAll
        onCancel={onCancel}
        onSent={onSent}
      />,
    );

    expect(screen.getByText("dest@example.com")).toBeInTheDocument();
    expect(screen.getByText("+ tous les destinataires")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Votre réponse...")).toHaveValue("");

    const sendButton = screen.getByRole("button", { name: /envoyer/i });
    expect(sendButton).toBeDisabled();

    const cancelButton = screen.getByRole("button", { name: /annuler/i });
    expect(cancelButton).toBeEnabled();
  });

  it("appelle onCancel au clic sur Annuler", () => {
    const onCancel = vi.fn();
    const onSent = vi.fn();

    render(
      <MobileEmailReply
        threadId="thread-1"
        accountId="acc-1"
        toAddress="dest@example.com"
        onCancel={onCancel}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("envoie une réponse avec corps cité et références, puis déclenche le succès", async () => {
    const onCancel = vi.fn();
    const onSent = vi.fn();

    mockBuildQuotedBody.mockReturnValue("Le 1 janv. Alice a écrit :\n> Bonjour");
    mockInvokeEdge.mockResolvedValue({ ok: true });

    render(
      <MobileEmailReply
        threadId="thread-42"
        accountId="acc-9"
        toAddress="dest@example.com"
        onCancel={onCancel}
        onSent={onSent}
        lastMessageId="msg-last"
        allMessageIds={["msg-1", "msg-2"]}
        threadMessages={[
          {
            from_name: "Alice",
            from_address: "alice@example.com",
            body_text: "Bonjour",
            sent_date: "2024-01-01T10:00:00Z",
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Merci pour votre message" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith("send-email-reply", {
        account_id: "acc-9",
        thread_id: "thread-42",
        to: "dest@example.com",
        subject: "Re: Thread",
        body: "Merci pour votre message\n\nLe 1 janv. Alice a écrit :\n> Bonjour",
        in_reply_to: "msg-last",
        references: ["msg-1", "msg-2"],
      });
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Réponse envoyée");
    });

    expect(onSent).toHaveBeenCalledTimes(1);
    expect(mockToastWarning).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("affiche l'état de chargement pendant l'envoi puis revient à l'état normal", async () => {
    const onSent = vi.fn();
    let resolvePromise: ((value: { ok: boolean }) => void) | undefined;

    mockInvokeEdge.mockImplementation(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    render(
      <MobileEmailReply
        threadId="thread-1"
        accountId="acc-1"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={onSent}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Message en cours" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    expect(screen.getByRole("button", { name: /envoi/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /annuler/i })).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    if (resolvePromise) {
      resolvePromise({ ok: true });
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /envoyer/i })).toBeEnabled();
    });

    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("refuse l'envoi si le message est vide", async () => {
    render(
      <MobileEmailReply
        threadId="thread-1"
        accountId="acc-1"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText("Votre réponse...");
    fireEvent.change(textarea, { target: { value: "   " } });

    const sendButton = screen.getByRole("button", { name: /envoyer/i });
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);

    expect(mockToastError).not.toHaveBeenCalledWith("Le message ne peut pas être vide");
    expect(mockInvokeEdge).not.toHaveBeenCalled();
  });

  it("affiche une erreur si accountId est absent", async () => {
    render(
      <MobileEmailReply
        threadId="thread-1"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Bonjour" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    expect(mockToastError).toHaveBeenCalledWith("Impossible de déterminer le compte email à utiliser");
    expect(mockInvokeEdge).not.toHaveBeenCalled();
  });

  it("affiche une erreur si accountId vaut all", async () => {
    render(
      <MobileEmailReply
        threadId="thread-1"
        accountId="all"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Bonjour" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    expect(mockToastError).toHaveBeenCalledWith("Impossible de déterminer le compte email à utiliser");
    expect(mockInvokeEdge).not.toHaveBeenCalled();
  });

  it("gère le succès partiel smtp envoyé mais stockage DB échoué", async () => {
    const onSent = vi.fn();
    mockInvokeEdge.mockResolvedValue({ smtp_sent: true, db_stored: false });

    render(
      <MobileEmailReply
        threadId="thread-1"
        accountId="acc-1"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={onSent}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Réponse partielle" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith("Email envoyé mais non enregistré dans vos envoyés");
    });

    expect(onSent).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("gère un warning renvoyé par la fonction edge", async () => {
    const onSent = vi.fn();
    mockInvokeEdge.mockResolvedValue({ warning: "Stockage différé" });

    render(
      <MobileEmailReply
        threadId="thread-2"
        accountId="acc-2"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={onSent}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Réponse avec avertissement" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith("Réponse envoyée avec avertissement: Stockage différé");
    });

    expect(onSent).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("sanitise et affiche l'erreur en cas d'échec d'envoi", async () => {
    const onSent = vi.fn();
    const error = new Error("boom");
    mockInvokeEdge.mockRejectedValue(error);
    mockSanitizeSupabaseError.mockReturnValue("Erreur lisible");

    render(
      <MobileEmailReply
        threadId="thread-3"
        accountId="acc-3"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={onSent}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Réponse qui échoue" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith("Error sending reply:", error);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(error);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lisible");
    });

    expect(onSent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /envoyer/i })).toBeEnabled();
  });

  it("n'ajoute ni quoted body ni références quand absents", async () => {
    mockBuildQuotedBody.mockReturnValue("");
    mockInvokeEdge.mockResolvedValue({ ok: true });

    render(
      <MobileEmailReply
        threadId="thread-5"
        accountId="acc-5"
        toAddress="dest@example.com"
        onCancel={vi.fn()}
        onSent={vi.fn()}
        allMessageIds={[]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Votre réponse..."), {
      target: { value: "Message simple" },
    });

    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith("send-email-reply", {
        account_id: "acc-5",
        thread_id: "thread-5",
        to: "dest@example.com",
        subject: "Re: Thread",
        body: "Message simple",
        in_reply_to: undefined,
        references: undefined,
      });
    });
  });
});