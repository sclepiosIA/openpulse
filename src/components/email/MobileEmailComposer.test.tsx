// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MobileEmailComposer } from "./MobileEmailComposer";

const {
  AUTH_STATE,
  mockFrom,
  mockInvoke,
  upsertMock,
  deleteMock,
  eqMock,
  debugErrorMock,
  toastSuccessMock,
  toastErrorMock,
  toastWarningMock,
} = vi.hoisted(() => {
  const upsert = vi.fn();
  const del = vi.fn();
  const eq = vi.fn();
  const from = vi.fn();
  const invoke = vi.fn();
  const debugError = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const toastWarning = vi.fn();

  const authState = {
    user: { id: "user-1", email: "user@test.co" },
    session: { user: { id: "user-1" } },
    isLoading: false,
  };

  return {
    AUTH_STATE: authState,
    mockFrom: from,
    mockInvoke: invoke,
    upsertMock: upsert,
    deleteMock: del,
    eqMock: eq,
    debugErrorMock: debugError,
    toastSuccessMock: toastSuccess,
    toastErrorMock: toastError,
    toastWarningMock: toastWarning,
  };
});

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    warning: toastWarningMock,
  },
}));

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    className,
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Loader2: Icon,
    Send: Icon,
    Paperclip: Icon,
    X: Icon,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("MobileEmailComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    eqMock.mockResolvedValue({ data: null, error: null });

    deleteMock.mockReturnValue({
      eq: eqMock,
      then: (resolve: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: null, error: null })),
      catch: () => Promise.resolve({ data: null, error: null }),
    });

    upsertMock.mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: deleteMock,
      upsert: upsertMock,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: null, error: null })),
      catch: () => Promise.resolve({ data: null, error: null }),
    }));

    mockInvoke.mockResolvedValue({
      data: { smtp_sent: true, db_stored: true },
      error: null,
    });
  });

  it("préremplit le brouillon initial et affiche les champs Cc/Bcc", () => {
    renderWithProviders(
      <MobileEmailComposer
        accountId="acc-1"
        onCancel={vi.fn()}
        onSent={vi.fn()}
        initialDraft={{
          id: "draft-1",
          account_id: "acc-1",
          to_addresses: "to@test.co",
          cc_addresses: "cc@test.co",
          bcc_addresses: "bcc@test.co",
          subject: "Sujet initial",
          body: "Corps initial",
          user_id: "user-1",
        }}
      />
    );

    expect(screen.getByPlaceholderText("À")).toHaveValue("to@test.co");
    expect(screen.getByPlaceholderText("Cc")).toHaveValue("cc@test.co");
    expect(screen.getByPlaceholderText("Bcc")).toHaveValue("bcc@test.co");
    expect(screen.getByPlaceholderText("Objet")).toHaveValue("Sujet initial");
    expect(screen.getByPlaceholderText("Votre message...")).toHaveValue("Corps initial");
  });

  it("sauvegarde un brouillon manuellement avec les valeurs attendues", async () => {
    renderWithProviders(
      <MobileEmailComposer accountId="acc-42" onCancel={vi.fn()} onSent={vi.fn()} />
    );

    fireEvent.change(screen.getByPlaceholderText("À"), {
      target: { value: "dest@test.co" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cc" }));
    fireEvent.change(screen.getByPlaceholderText("Cc"), {
      target: { value: "copie@test.co" },
    });
    fireEvent.change(screen.getByPlaceholderText("Objet"), {
      target: { value: "Mon sujet" },
    });
    fireEvent.change(screen.getByPlaceholderText("Votre message..."), {
      target: { value: "Bonjour mobile" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Brouillon" }));
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_drafts");
    });

    expect(upsertMock).toHaveBeenCalledWith({
      account_id: "acc-42",
      to_addresses: "dest@test.co",
      cc_addresses: "copie@test.co",
      bcc_addresses: null,
      subject: "Mon sujet",
      body: "Bonjour mobile",
      user_id: "user-1",
    });
  });

  it("envoie l'email, transforme le body en HTML et supprime le brouillon existant", async () => {
    const onSent = vi.fn();

    renderWithProviders(
      <MobileEmailComposer
        accountId="acc-9"
        onCancel={vi.fn()}
        onSent={onSent}
        initialDraft={{
          id: "draft-9",
          account_id: "acc-9",
          to_addresses: "old@test.co",
          cc_addresses: null,
          bcc_addresses: null,
          subject: "Old",
          body: "Old body",
          user_id: "user-1",
        }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("À"), {
      target: { value: "receiver@test.co" },
    });
    fireEvent.change(screen.getByPlaceholderText("Objet"), {
      target: { value: "Sujet neuf" },
    });
    fireEvent.change(screen.getByPlaceholderText("Votre message..."), {
      target: { value: "Ligne 1\n<hello> & ok" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Envoyer/i }));
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("send-email", {
        body: {
          account_id: "acc-9",
          user_id: "user-1",
          to: "receiver@test.co",
          cc: undefined,
          subject: "Sujet neuf",
          html_body: "Ligne 1<br>&lt;hello&gt; &amp; ok",
        },
      });
    });

    expect(mockFrom).toHaveBeenCalledWith("email_drafts");
    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "draft-9");
    expect(toastSuccessMock).toHaveBeenCalledWith("Email envoyé");
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("désactive le bouton envoyer tant que destinataire ou objet sont vides", () => {
    renderWithProviders(
      <MobileEmailComposer accountId="acc-1" onCancel={vi.fn()} onSent={vi.fn()} />
    );

    const sendButton = screen.getByRole("button", { name: /Envoyer/i });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Objet"), {
      target: { value: "Sujet" },
    });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("À"), {
      target: { value: "dest@test.co" },
    });
    expect(sendButton).not.toBeDisabled();
  });

  it("gère l'erreur de la fonction d'envoi et affiche le message retourné", async () => {
    mockInvoke.mockRejectedValue(new Error("envoi impossible"));

    renderWithProviders(
      <MobileEmailComposer accountId="acc-1" onCancel={vi.fn()} onSent={vi.fn()} />
    );

    fireEvent.change(screen.getByPlaceholderText("À"), {
      target: { value: "dest@test.co" },
    });
    fireEvent.change(screen.getByPlaceholderText("Objet"), {
      target: { value: "Sujet erreur" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Envoyer/i }));
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("envoi impossible");
    });

    expect(debugErrorMock).toHaveBeenCalled();
  });

  it("gère le succès partiel SMTP sans suppression de brouillon", async () => {
    const onSent = vi.fn();

    mockInvoke.mockResolvedValue({
      data: { smtp_sent: true, db_stored: false },
      error: null,
    });

    renderWithProviders(
      <MobileEmailComposer
        accountId="acc-7"
        onCancel={vi.fn()}
        onSent={onSent}
        initialDraft={{
          id: "draft-7",
          account_id: "acc-7",
          to_addresses: "",
          cc_addresses: null,
          bcc_addresses: null,
          subject: "",
          body: "",
          user_id: "user-1",
        }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("À"), {
      target: { value: "dest@test.co" },
    });
    fireEvent.change(screen.getByPlaceholderText("Objet"), {
      target: { value: "Sujet partiel" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Envoyer/i }));
    });

    await waitFor(() => {
      expect(toastWarningMock).toHaveBeenCalledWith(
        "Email envoyé mais non enregistré dans vos envoyés"
      );
    });

    expect(onSent).toHaveBeenCalledTimes(1);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("ajoute puis retire une pièce jointe via le sélecteur de fichier", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const createdInput = originalCreateElement("input");
    const clickSpy = vi.spyOn(createdInput, "click").mockImplementation(() => {});

    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string): HTMLElement => {
        if (tagName === "input") {
          return createdInput;
        }
        return originalCreateElement(tagName);
      });

    renderWithProviders(
      <MobileEmailComposer accountId="acc-1" onCancel={vi.fn()} onSent={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Joindre un fichier" }));
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(["hello"], "piece.txt", { type: "text/plain" });

    await act(async () => {
      Object.defineProperty(createdInput, "files", {
        configurable: true,
        value: [file],
      });

      if (typeof createdInput.onchange === "function") {
        createdInput.onchange({
          target: createdInput,
        } as unknown as Event);
      }
    });

    expect(screen.getByText("piece.txt")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    });

    await waitFor(() => {
      expect(screen.queryByText("piece.txt")).not.toBeInTheDocument();
    });

    createElementSpy.mockRestore();
  });
});