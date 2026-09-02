/* @vitest-environment jsdom */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PortalRequestsTable } from "./PortalRequestsTable";

const {
  REQUESTS,
  AUTH_STATE,
  UPDATE_MUTATE,
  UPDATE_HOOK_STATE,
  mockFrom,
} = vi.hoisted(() => {
  const REQUESTS = [
    {
      id: "r1",
      created_at: "2024-01-15T10:30:00.000Z",
      type: "contact",
      sujet: "Question contrat",
      statut: "nouveau",
      email: "client1@ex.co",
      message: "Bonjour, j'ai une question sur mon contrat.",
    },
    {
      id: "r2",
      created_at: "2024-02-20T14:45:00.000Z",
      type: "formation",
      sujet: "Besoin formation équipe",
      statut: "traite",
      email: "client2@ex.co",
      message: "Nous souhaitons organiser une formation.",
    },
    {
      id: "r3",
      created_at: "2024-03-05T08:15:00.000Z",
      type: "facture",
      sujet: "Facture manquante",
      statut: "ferme",
      email: "client3@ex.co",
      message: "Je ne retrouve pas la dernière facture.",
    },
  ] as const;

  const AUTH_STATE = {
    user: { id: "u1", email: "test@ex.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const UPDATE_MUTATE = vi.fn();
  const UPDATE_HOOK_STATE = {
    mutate: UPDATE_MUTATE,
    isPending: false,
    isError: false,
    error: null,
  };

  const mockFrom = vi.fn();

  return {
    REQUESTS,
    AUTH_STATE,
    UPDATE_MUTATE,
    UPDATE_HOOK_STATE,
    mockFrom,
  };
});

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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };

  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/portail/useClientPortal", () => ({
  useUpdateClientPortalRequest: vi.fn(() => UPDATE_HOOK_STATE),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableCell: ({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
    <td className={className} colSpan={colSpan}>
      {children}
    </td>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div data-open={open ? "true" : "false"}>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("lucide-react", () => ({
  CheckCircle2: () => <svg aria-hidden="true" />,
  RotateCcw: () => <svg aria-hidden="true" />,
  XCircle: () => <svg aria-hidden="true" />,
  Eye: () => <svg aria-hidden="true" />,
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

describe("PortalRequestsTable", () => {
  beforeEach(() => {
    UPDATE_MUTATE.mockClear();
    mockFrom.mockClear();
    UPDATE_HOOK_STATE.isPending = false;
    UPDATE_HOOK_STATE.isError = false;
    UPDATE_HOOK_STATE.error = null;
  });

  it("affiche l'état de chargement", () => {
    render(<PortalRequestsTable requests={[]} isLoading />);

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Sujet")).toBeInTheDocument();
    expect(screen.getByText("Statut")).toBeInTheDocument();
  });

  it("affiche un message vide quand aucune demande n'est disponible", () => {
    render(<PortalRequestsTable requests={[]} isLoading={false} />);

    expect(screen.getByText("Aucune demande")).toBeInTheDocument();
  });

  it("affiche les demandes avec les valeurs métier réelles et ouvre le détail", async () => {
    const user = userEvent.setup();

    render(<PortalRequestsTable requests={[...REQUESTS]} isLoading={false} />);

    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("Formation")).toBeInTheDocument();
    expect(screen.getByText("Facture")).toBeInTheDocument();

    expect(screen.getByText("Question contrat")).toBeInTheDocument();
    expect(screen.getByText("Besoin formation équipe")).toBeInTheDocument();
    expect(screen.getByText("Facture manquante")).toBeInTheDocument();

    expect(screen.getByText("Nouveau")).toBeInTheDocument();
    expect(screen.getByText("Traitée")).toBeInTheDocument();
    expect(screen.getByText("Fermée")).toBeInTheDocument();

    expect(screen.getByText(format(new Date(REQUESTS[0].created_at), "dd/MM/yyyy HH:mm", { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(format(new Date(REQUESTS[1].created_at), "dd/MM/yyyy HH:mm", { locale: fr }))).toBeInTheDocument();
    expect(screen.getByText(format(new Date(REQUESTS[2].created_at), "dd/MM/yyyy HH:mm", { locale: fr }))).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);

    expect(screen.getByRole("heading", { name: "Question contrat" })).toBeInTheDocument();
    expect(screen.getByText("client1@ex.co")).toBeInTheDocument();
    expect(screen.getByText("Bonjour, j'ai une question sur mon contrat.")).toBeInTheDocument();
  });

  it("déclenche la mutation correcte pour Traiter, Fermer et Rouvrir", async () => {
    const user = userEvent.setup();

    render(<PortalRequestsTable requests={[...REQUESTS]} isLoading={false} />);

    await user.click(screen.getByRole("button", { name: /Traiter/i }));
    expect(UPDATE_MUTATE).toHaveBeenCalledWith({ id: "r1", statut: "traite" });

    await user.click(screen.getByRole("button", { name: /Fermer/i }));
    expect(UPDATE_MUTATE).toHaveBeenCalledWith({ id: "r2", statut: "ferme" });

    await user.click(screen.getByRole("button", { name: /Rouvrir/i }));
    expect(UPDATE_MUTATE).toHaveBeenCalledWith({ id: "r3", statut: "nouveau" });
  });

  it("désactive les actions quand la mutation est en cours", () => {
    UPDATE_HOOK_STATE.isPending = true;

    render(<PortalRequestsTable requests={[...REQUESTS]} isLoading={false} />);

    expect(screen.getByRole("button", { name: /Traiter/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Fermer/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Rouvrir/i })).toBeDisabled();
  });

  it("permet de tester un hook react-query avec wrapper QueryClientProvider: succès puis erreur", async () => {
    const successHook = vi.fn(async () => ({ data: REQUESTS[0], error: null }));
    const errorHook = vi.fn(async () => ({ data: null, error: { message: "x" } }));

    function useFakePortalRequest(mode: "success" | "error") {
      const [state, setState] = React.useState<{
        isLoading: boolean;
        isError: boolean;
        data: (typeof REQUESTS)[number] | null;
        error: { message: string } | null;
      }>({
        isLoading: true,
        isError: false,
        data: null,
        error: null,
      });

      React.useEffect(() => {
        let active = true;
        const run = async () => {
          const result = mode === "success" ? await successHook() : await errorHook();
          if (!active) return;
          setState({
            isLoading: false,
            isError: !!result.error,
            data: result.data,
            error: result.error,
          });
        };
        void run();
        return () => {
          active = false;
        };
      }, [mode]);

      return state;
    }

    const wrapper = createWrapper();

    const { result, rerender } = renderHook(({ mode }: { mode: "success" | "error" }) => useFakePortalRequest(mode), {
      initialProps: { mode: "success" as const },
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.id).toBe("r1");
    expect(result.current.data?.sujet).toBe("Question contrat");

    await act(async () => {
      rerender({ mode: "error" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ message: "x" });
  });

  it("déclenche une mutation dans act avec assertion précise sur les paramètres", async () => {
    const wrapper = createWrapper();

    function useFakeMutation() {
      return {
        mutate: UPDATE_MUTATE,
      };
    }

    const { result } = renderHook(() => useFakeMutation(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: "r2", statut: "ferme" });
    });

    expect(UPDATE_MUTATE).toHaveBeenCalledWith({ id: "r2", statut: "ferme" });
  });

  it("affiche les bonnes actions selon le statut de chaque ligne", () => {
    render(<PortalRequestsTable requests={[...REQUESTS]} isLoading={false} />);

    const rows = screen.getAllByRole("row");

    const rowNouveau = rows.find((row) => within(row).queryByText("Question contrat"));
    const rowTraite = rows.find((row) => within(row).queryByText("Besoin formation équipe"));
    const rowFerme = rows.find((row) => within(row).queryByText("Facture manquante"));

    expect(rowNouveau).toBeDefined();
    expect(rowTraite).toBeDefined();
    expect(rowFerme).toBeDefined();

    if (rowNouveau) {
      expect(within(rowNouveau).getByRole("button", { name: /Traiter/i })).toBeInTheDocument();
      expect(within(rowNouveau).queryByRole("button", { name: /Fermer/i })).not.toBeInTheDocument();
      expect(within(rowNouveau).queryByRole("button", { name: /Rouvrir/i })).not.toBeInTheDocument();
    }

    if (rowTraite) {
      expect(within(rowTraite).getByRole("button", { name: /Fermer/i })).toBeInTheDocument();
      expect(within(rowTraite).queryByRole("button", { name: /Traiter/i })).not.toBeInTheDocument();
      expect(within(rowTraite).queryByRole("button", { name: /Rouvrir/i })).not.toBeInTheDocument();
    }

    if (rowFerme) {
      expect(within(rowFerme).getByRole("button", { name: /Rouvrir/i })).toBeInTheDocument();
      expect(within(rowFerme).queryByRole("button", { name: /Traiter/i })).not.toBeInTheDocument();
      expect(within(rowFerme).queryByRole("button", { name: /Fermer/i })).not.toBeInTheDocument();
    }
  });
});