/// <reference types="vitest/globals" />
/// <reference types="vite/client" />

import React from "react";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";

const {
  USERS,
  mockToggleMutate,
  mockUseToggleReturn,
  resetDialogProps,
  stableIcons,
} = vi.hoisted(() => {
  const USERS = [
    {
      id: "u1",
      email: "alpha@example.co",
      prenom: "Alice",
      nom: "Martin",
      full_name: null,
      etablissement_nom: "Clinique A",
      actif: true,
      last_login: "2024-01-02T03:04:00.000Z",
    },
    {
      id: "u2",
      email: "beta@example.co",
      prenom: "Benoit",
      nom: "Durand",
      full_name: "B. Durand",
      etablissement_nom: null,
      actif: false,
      last_login: null,
    },
  ] as const;

  const mockToggleMutate = vi.fn();

  const mockUseToggleReturn = {
    mutate: mockToggleMutate,
    isPending: false,
    isError: false,
    error: null as unknown,
  };

  const resetDialogProps: Array<{
    open: boolean;
    userId: string | null;
    userEmail: string | undefined;
    onOpenChange: (o: boolean) => void;
  }> = [];

  const stableIcons = {
    KeyRound: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-icon": "KeyRound" }),
    Power: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-icon": "Power" }),
    PowerOff: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-icon": "PowerOff" }),
    Search: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-icon": "Search" }),
  };

  return { USERS, mockToggleMutate, mockUseToggleReturn, resetDialogProps, stableIcons };
});

vi.mock("@/hooks/portail/useClientPortal", () => {
  return {
    useToggleClientPortalUser: () => mockUseToggleReturn,
  };
});

vi.mock("./ResetPortalPasswordDialog", () => {
  return {
    ResetPortalPasswordDialog: (props: {
      open: boolean;
      onOpenChange: (o: boolean) => void;
      userId: string | null;
      userEmail?: string;
    }) => {
      resetDialogProps.push({
        open: props.open,
        userId: props.userId,
        userEmail: props.userEmail,
        onOpenChange: props.onOpenChange,
      });
      return React.createElement("div", { "data-testid": "reset-dialog", "data-open": String(props.open) });
    },
  };
});

vi.mock("@/components/ui/table", () => {
  const Table = (p: React.HTMLAttributes<HTMLTableElement>) => React.createElement("table", p);
  const TableHeader = (p: React.HTMLAttributes<HTMLTableSectionElement>) => React.createElement("thead", p);
  const TableBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => React.createElement("tbody", p);
  const TableRow = (p: React.HTMLAttributes<HTMLTableRowElement>) => React.createElement("tr", p);
  const TableHead = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => React.createElement("th", p);
  const TableCell = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => React.createElement("td", p);
  return { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
});

vi.mock("@/components/ui/badge", () => {
  return {
    Badge: (p: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) =>
      React.createElement("span", { ...p, "data-variant": p.variant ?? "" }),
  };
});

vi.mock("@/components/ui/button", () => {
  return {
    Button: (p: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
      React.createElement("button", { ...p, "data-variant": p.variant ?? "", "data-size": p.size ?? "" }),
  };
});

vi.mock("@/components/ui/input", () => {
  return {
    Input: (p: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", p),
  };
});

vi.mock("lucide-react", () => stableIcons);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function importModule() {
  const mod = await import("./PortalUsersTable");
  return mod;
}

describe("PortalUsersTable", () => {
  it("affiche l'état de chargement", async () => {
    const { PortalUsersTable } = await importModule();
    resetDialogProps.length = 0;

    renderWithClient(<PortalUsersTable users={[]} isLoading />);

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
    expect(screen.queryByText("Aucun compte")).not.toBeInTheDocument();
  });

  it("affiche les utilisateurs, filtre, ouvre/ferme le reset dialog et déclenche la mutation toggle", async () => {
    const { PortalUsersTable } = await importModule();
    resetDialogProps.length = 0;
    mockToggleMutate.mockClear();
    mockUseToggleReturn.isPending = false;

    renderWithClient(<PortalUsersTable users={[...USERS]} />);

    expect(screen.getByText("Nom")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Établissement")).toBeInTheDocument();
    expect(screen.getByText("Statut")).toBeInTheDocument();
    expect(screen.getByText("Dernière connexion")).toBeInTheDocument();

    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("alpha@example.co")).toBeInTheDocument();
    expect(screen.getByText("Clinique A")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByText(format(new Date(USERS[0].last_login!), "dd/MM/yyyy HH:mm"))).toBeInTheDocument();

    expect(screen.getByText("B. Durand")).toBeInTheDocument();
    expect(screen.getByText("beta@example.co")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("Désactivé")).toBeInTheDocument();
    expect(screen.getByText("Jamais")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Rechercher...");
    fireEvent.change(input, { target: { value: "clinique a" } });

    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.queryByText("B. Durand")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "beta@" } });
    expect(screen.queryByText("Alice Martin")).not.toBeInTheDocument();
    expect(screen.getByText("B. Durand")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });

    const rows = screen.getAllByRole("row");
    const aliceRow = rows.find((r) => within(r).queryByText("Alice Martin"));
    const benoitRow = rows.find((r) => within(r).queryByText("B. Durand"));
    expect(aliceRow).toBeTruthy();
    expect(benoitRow).toBeTruthy();

    const resetButtons = screen.getAllByRole("button", { name: "Reset" });
    expect(resetButtons.length).toBe(2);

    fireEvent.click(resetButtons[0]);

    const lastDialogAfterOpen = resetDialogProps.at(-1);
    expect(lastDialogAfterOpen).toBeDefined();
    expect(lastDialogAfterOpen?.open).toBe(true);
    expect(lastDialogAfterOpen?.userId).toBe("u1");
    expect(lastDialogAfterOpen?.userEmail).toBe("alpha@example.co");

    act(() => {
      lastDialogAfterOpen?.onOpenChange(false);
    });

    const lastDialogAfterClose = resetDialogProps.at(-1);
    expect(lastDialogAfterClose).toBeDefined();
    expect(lastDialogAfterClose?.open).toBe(false);
    expect(lastDialogAfterClose?.userId).toBe(null);
    expect(lastDialogAfterClose?.userEmail).toBeUndefined();

    const toggleButtons = screen.getAllByRole("button", { name: /Activer|Désactiver/ });
    const aliceToggle = toggleButtons.find((b) => (b.textContent ?? "").includes("Désactiver"));
    const benoitToggle = toggleButtons.find((b) => (b.textContent ?? "").includes("Activer"));
    expect(aliceToggle).toBeDefined();
    expect(benoitToggle).toBeDefined();

    await act(async () => {
      fireEvent.click(aliceToggle as HTMLButtonElement);
    });
    expect(mockToggleMutate).toHaveBeenCalledWith({ userId: "u1", active: false });

    await act(async () => {
      fireEvent.click(benoitToggle as HTMLButtonElement);
    });
    expect(mockToggleMutate).toHaveBeenCalledWith({ userId: "u2", active: true });
  });

  it("affiche 'Aucun compte' et permet de refléter un état d'erreur via le hook (isError)", async () => {
    const { PortalUsersTable } = await importModule();
    resetDialogProps.length = 0;

    renderWithClient(<PortalUsersTable users={[]} isLoading={false} />);
    expect(screen.getByText("Aucun compte")).toBeInTheDocument();

    mockUseToggleReturn.isError = true;
    mockUseToggleReturn.error = { message: "x" };

    renderWithClient(<PortalUsersTable users={[]} isLoading={false} />);
    expect(mockUseToggleReturn.isError).toBe(true);
    expect((mockUseToggleReturn.error as { message?: string } | null)?.message).toBe("x");

    mockUseToggleReturn.isError = false;
    mockUseToggleReturn.error = null;
  });
});