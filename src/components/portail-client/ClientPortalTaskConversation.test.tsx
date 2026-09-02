/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ClientPortalTaskConversation } from "./ClientPortalTaskConversation";
import {
  useClientPortalTaskMessages,
  useCreateClientPortalTaskMessage,
  useDeleteClientPortalTaskMessage,
} from "@/hooks/portail/useClientPortalTaskMessages";

const {
  AUTH_STATE,
  MESSAGES_ROWS,
  LOADING_STATE,
  EMPTY_STATE,
  ERROR_STATE,
  SUCCESS_STATE,
  CREATE_STATE,
  DELETE_STATE,
  mockUseAuth,
  mockUseClientPortalTaskMessages,
  mockUseCreateClientPortalTaskMessage,
  mockUseDeleteClientPortalTaskMessage,
  mockMutateAsync,
  mockDeleteMutate,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "staff@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const MESSAGES_ROWS = [
    {
      id: "m1",
      task_id: "task-1",
      content: "Bonjour établissement",
      is_internal: false,
      author_type: "marque",
      author_user_id: "u1",
      author_name: "Alice",
      created_at: "2024-01-02T10:30:00.000Z",
    },
    {
      id: "m2",
      task_id: "task-1",
      content: "Note privée staff",
      is_internal: true,
      author_type: "marque",
      author_user_id: "u2",
      author_name: null,
      created_at: "2024-01-03T11:45:00.000Z",
    },
    {
      id: "m3",
      task_id: "task-1",
      content: "Réponse établissement",
      is_internal: false,
      author_type: "facility",
      author_user_id: "ext-1",
      author_name: null,
      created_at: "2024-01-04T09:15:00.000Z",
    },
  ] as const;

  const LOADING_STATE = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  };

  const EMPTY_STATE = {
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  };

  const ERROR_STATE = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: "x" },
  };

  const SUCCESS_STATE = {
    data: MESSAGES_ROWS,
    isLoading: false,
    isError: false,
    error: null,
  };

  const mockMutateAsync = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockDeleteMutate = vi.fn();

  const CREATE_STATE = {
    mutateAsync: mockMutateAsync,
    isPending: false,
  };

  const DELETE_STATE = {
    mutate: mockDeleteMutate,
    isPending: false,
  };

  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockUseClientPortalTaskMessages = vi.fn(() => SUCCESS_STATE);
  const mockUseCreateClientPortalTaskMessage = vi.fn(() => CREATE_STATE);
  const mockUseDeleteClientPortalTaskMessage = vi.fn(() => DELETE_STATE);

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
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  const mockFrom = vi.fn(() => builder);

  return {
    AUTH_STATE,
    MESSAGES_ROWS,
    LOADING_STATE,
    EMPTY_STATE,
    ERROR_STATE,
    SUCCESS_STATE,
    CREATE_STATE,
    DELETE_STATE,
    mockUseAuth,
    mockUseClientPortalTaskMessages,
    mockUseCreateClientPortalTaskMessage,
    mockUseDeleteClientPortalTaskMessage,
    mockMutateAsync,
    mockDeleteMutate,
    mockFrom,
    builder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/hooks/portail/useClientPortalTaskMessages", () => ({
  useClientPortalTaskMessages: mockUseClientPortalTaskMessages,
  useCreateClientPortalTaskMessage: mockUseCreateClientPortalTaskMessage,
  useDeleteClientPortalTaskMessage: mockUseDeleteClientPortalTaskMessage,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    disabled,
    rows,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    className?: string;
  }) => (
    <textarea
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
    disabled,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      aria-label={id ?? "switch"}
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
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
    variant?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Loader2: Icon,
    Send: Icon,
    Trash2: Icon,
    Lock: Icon,
    MessageSquare: Icon,
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
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

describe("ClientPortalTaskConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH_STATE);
    mockUseClientPortalTaskMessages.mockReturnValue(SUCCESS_STATE);
    mockUseCreateClientPortalTaskMessage.mockReturnValue(CREATE_STATE);
    mockUseDeleteClientPortalTaskMessage.mockReturnValue(DELETE_STATE);
    mockFrom.mockReturnValue(builder);
  });

  it("utilise les hooks mockés avec renderHook dans un QueryClientProvider", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useClientPortalTaskMessages("task-1"), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(MESSAGES_ROWS);

    const { result: createResult } = renderHook(() => useCreateClientPortalTaskMessage(), { wrapper });
    expect(createResult.current.isPending).toBe(false);

    const { result: deleteResult } = renderHook(() => useDeleteClientPortalTaskMessage(), { wrapper });
    expect(typeof deleteResult.current.mutate).toBe("function");
  });

  it("affiche l'état de chargement et le compteur à zéro", () => {
    mockUseClientPortalTaskMessages.mockReturnValue(LOADING_STATE);

    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper: createWrapper() });

    expect(screen.getByText("Chargement…")).toBeInTheDocument();
    expect(screen.getByText("0 message")).toBeInTheDocument();
  });

  it("affiche les messages, les auteurs métiers, le badge interne et le bouton de suppression seulement pour l'auteur connecté", () => {
    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper: createWrapper() });

    expect(screen.getByText("3 messages")).toBeInTheDocument();
    expect(screen.getByText("Bonjour établissement")).toBeInTheDocument();
    expect(screen.getByText("Note privée staff")).toBeInTheDocument();
    expect(screen.getByText("Réponse établissement")).toBeInTheDocument();

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Établissement")).toBeInTheDocument();

    expect(screen.getByText("Interne")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /supprimer/i });
    expect(deleteButtons).toHaveLength(1);

    for (const message of MESSAGES_ROWS) {
      expect(screen.getByText(format(new Date(message.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr }))).toBeInTheDocument();
    }
  });

  it("affiche l'état vide quand aucun message n'existe", () => {
    mockUseClientPortalTaskMessages.mockReturnValue(EMPTY_STATE);

    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper: createWrapper() });

    expect(screen.getByText(/Aucun message pour le moment\./i)).toBeInTheDocument();
    expect(screen.getByText(/Démarrez la conversation avec l'établissement\./i)).toBeInTheDocument();
    expect(screen.getByText("0 message")).toBeInTheDocument();
  });

  it("permet d'envoyer un message, trim le contenu, réinitialise le formulaire et repasse la note interne à false", async () => {
    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper: createWrapper() });

    const textarea = screen.getByPlaceholderText("Écrire une réponse… (Ctrl/Cmd + Entrée pour envoyer)") as HTMLTextAreaElement;
    const internalSwitch = screen.getByLabelText("internal-note") as HTMLInputElement;
    const sendButton = screen.getByRole("button", { name: /envoyer/i });

    fireEvent.change(textarea, { target: { value: "   Réponse staff   " } });
    fireEvent.click(internalSwitch);

    expect(sendButton).not.toBeDisabled();
    expect(internalSwitch.checked).toBe(true);

    await act(async () => {
      fireEvent.click(sendButton);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      task_id: "task-1",
      content: "Réponse staff",
      is_internal: true,
    });

    await waitFor(() => {
      expect(textarea.value).toBe("");
      expect(internalSwitch.checked).toBe(false);
    });
  });

  it("envoie avec Ctrl+Entrée", async () => {
    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper: createWrapper() });

    const textarea = screen.getByPlaceholderText("Écrire une réponse… (Ctrl/Cmd + Entrée pour envoyer)");

    fireEvent.change(textarea, { target: { value: "Message clavier" } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      task_id: "task-1",
      content: "Message clavier",
      is_internal: false,
    });
  });

  it("ne permet pas d'envoyer un contenu vide et désactive le bouton si le contenu trim est vide", () => {
    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper: createWrapper() });

    const textarea = screen.getByPlaceholderText("Écrire une réponse… (Ctrl/Cmd + Entrée pour envoyer)");
    const sendButton = screen.getByRole("button", { name: /envoyer/i });

    expect(sendButton).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "   " } });

    expect(sendButton).toBeDisabled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("supprime un message avec le bon payload", () => {
    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper: createWrapper() });

    const deleteButton = screen.getByRole("button", { name: /supprimer/i });
    fireEvent.click(deleteButton);

    expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "m1", task_id: "task-1" });
  });

  it("gère un état d'erreur du hook de messages avec isError=true sans dépendre du réseau", () => {
    mockUseClientPortalTaskMessages.mockReturnValue(ERROR_STATE);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useClientPortalTaskMessages("task-1"), { wrapper });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });

    render(<ClientPortalTaskConversation taskId="task-1" />, { wrapper });

    expect(screen.getByText("0 message")).toBeInTheDocument();
    expect(screen.getByText(/Aucun message pour le moment\./i)).toBeInTheDocument();
  });
});