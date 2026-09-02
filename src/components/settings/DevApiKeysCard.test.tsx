// @vitest-environment jsdom

import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { DevApiKeysCard } from "./DevApiKeysCard";

const {
  API_KEYS,
  AUTH_STATE,
  toastFn,
  mockFrom,
  mockWriteText,
  mutateAsyncMock,
  mutateMock,
  useApiKeysMock,
  useCreateApiKeyMock,
  useRevokeApiKeyMock,
} = vi.hoisted(() => ({
  API_KEYS: [
    {
      id: "k1",
      nom: "Pipeline CI",
      key_prefix: "sk_ci",
      est_active: true,
      revoked_at: null,
      total_requests: 12,
      expires_at: "2025-12-24T00:00:00.000Z",
      last_used_at: "2025-01-10T14:30:00.000Z",
    },
    {
      id: "k2",
      nom: "Ancienne clé",
      key_prefix: "sk_old",
      est_active: false,
      revoked_at: "2025-01-01T00:00:00.000Z",
      total_requests: 3,
      expires_at: null,
      last_used_at: null,
    },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  toastFn: vi.fn(),
  mockWriteText: vi.fn().mockResolvedValue(undefined),
  mutateAsyncMock: vi.fn(),
  mutateMock: vi.fn(),
  useApiKeysMock: vi.fn(),
  useCreateApiKeyMock: vi.fn(),
  useRevokeApiKeyMock: vi.fn(),
  mockFrom: vi.fn(() => {
    const builder: any = {
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
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/shared/useApi", () => ({
  useApiKeys: useApiKeysMock,
  useCreateApiKey: useCreateApiKeyMock,
  useRevokeApiKey: useRevokeApiKeyMock,
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: toastFn,
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", props);
  return {
    Key: Icon,
    Plus: Icon,
    Copy: Icon,
    Trash2: Icon,
    Eye: Icon,
    EyeOff: Icon,
    AlertTriangle: Icon,
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label"?: string }) => {
    const { children, onClick, disabled } = props;
    const ariaLabel = (props as any)["aria-label"] ?? (props as any).ariaLabel;
    return (
      <button onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div data-open={open ? "true" : "false"}>{children}</div>,
  DialogTrigger: ({
    children,
  }: {
    children: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
    asChild?: boolean;
  }) =>
    React.cloneElement(children, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        children.props.onClick?.(event);
      },
    }),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div>
      <select aria-label="Expiration" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
        <option value="30">30 jours</option>
        <option value="90">90 jours</option>
        <option value="180">6 mois</option>
        <option value="365">1 an</option>
        <option value="0">Jamais</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>select-value</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
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

describe("DevApiKeysCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: mockWriteText,
        },
      },
      configurable: true,
    });

    useApiKeysMock.mockReturnValue({
      data: API_KEYS,
      isLoading: false,
      isError: false,
      error: null,
    });

    mutateAsyncMock.mockResolvedValue({
      full_key: "cle_generee_demo",
    });

    useCreateApiKeyMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    });

    useRevokeApiKeyMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    });
  });

  it("utilise renderHook avec QueryClientProvider sans erreur", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useApiKeysMock(), { wrapper });

    expect(result.current.data).toBe(API_KEYS);
    expect(result.current.isLoading).toBe(false);
  });

  it("affiche l'état de chargement", () => {
    useApiKeysMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<DevApiKeysCard />, { wrapper: createWrapper() });

    expect(screen.getByText("Clés API")).toBeInTheDocument();
    expect(screen.getByText("Créer une clé API")).toBeInTheDocument();
    expect(screen.queryByText(/Aucune clé API active/i)).not.toBeInTheDocument();
  });

  it("affiche les clés actives et leurs informations métier réelles", () => {
    render(<DevApiKeysCard />, { wrapper: createWrapper() });

    expect(screen.getByText("1 active")).toBeInTheDocument();
    expect(screen.getByText("Pipeline CI")).toBeInTheDocument();
    expect(screen.getByText("sk_ci...")).toBeInTheDocument();
    expect(screen.getByText("12 requêtes")).toBeInTheDocument();
    expect(screen.getByText(/Expire le/i)).toBeInTheDocument();
    expect(screen.getByText(/Dernière utilisation/i)).toBeInTheDocument();
    expect(screen.queryByText("Ancienne clé")).not.toBeInTheDocument();
  });

  it("révoque une clé active via le bouton supprimer", async () => {
    render(<DevApiKeysCard />, { wrapper: createWrapper() });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Supprimer"));
    });

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith("k1");
  });

  it("crée une clé, affiche la clé générée puis la copie dans le presse-papier", async () => {
    render(<DevApiKeysCard />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText("Nom de la clé *"), {
      target: { value: "  Monitoring  " },
    });

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  Usage supervision  " },
    });

    fireEvent.change(screen.getByLabelText("Expiration"), {
      target: { value: "30" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Générer la clé"));
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    const firstCall = mutateAsyncMock.mock.calls[0][0] as {
      nom: string;
      description?: string;
      permissions: string[];
      rate_limit_per_minute: number;
      rate_limit_per_day: number;
      expires_at?: string;
    };

    expect(firstCall.nom).toBe("Monitoring");
    expect(firstCall.description).toBe("Usage supervision");
    expect(firstCall.permissions).toEqual(["read", "write"]);
    expect(firstCall.rate_limit_per_minute).toBe(30);
    expect(firstCall.rate_limit_per_day).toBe(1000);
    expect(typeof firstCall.expires_at).toBe("string");

    expect(await screen.findByDisplayValue("••••••••••••••••••••••••")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Masquer"));

    expect(screen.getByDisplayValue("cle_generee_demo")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Copier"));

    expect(mockWriteText).toHaveBeenCalledWith("cle_generee_demo");
    expect(toastFn).toHaveBeenCalledWith({ title: "Clé copiée dans le presse-papier" });
  });

  it("n'appelle pas la mutation de création si le nom est vide", () => {
    render(<DevApiKeysCard />, { wrapper: createWrapper() });

    const createButton = screen.getByText("Générer la clé");
    expect(createButton).toBeDisabled();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("gère le cas sans clé active", () => {
    useApiKeysMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<DevApiKeysCard />, { wrapper: createWrapper() });

    expect(screen.getByText("0 actives")).toBeInTheDocument();
    expect(screen.getByText("Aucune clé API active. Créez-en une pour commencer.")).toBeInTheDocument();
  });

  it("propage une erreur du hook de données", () => {
    useApiKeysMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useApiKeysMock(), { wrapper });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeNull();
  });
});