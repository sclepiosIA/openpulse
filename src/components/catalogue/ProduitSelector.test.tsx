/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProduitSelector } from "./ProduitSelector";

const { PRODUITS, hookState, TYPE_LABELS } = vi.hoisted(() => ({
  PRODUITS: [
    {
      id: "p1",
      code: "SERV-001",
      nom: "Audit",
      description: "Audit complet",
      type: "service",
      prix_unitaire_ht: 120,
      unite: "heure",
      taux_tva: 20,
    },
    {
      id: "p2",
      code: "PROD-002",
      nom: "Licence",
      description: "Abonnement annuel",
      type: "produit",
      prix_unitaire_ht: 49.9,
      unite: "pièce",
      taux_tva: 20,
    },
    {
      id: "p3",
      code: "SERV-003",
      nom: "Maintenance",
      description: "Support prioritaire",
      type: "service",
      prix_unitaire_ht: 89.5,
      unite: "mois",
      taux_tva: 10,
    },
  ],
  hookState: {
    produits: [] as Array<{
      id: string;
      code: string;
      nom: string;
      description?: string;
      type: string;
      prix_unitaire_ht: number;
      unite: string;
      taux_tva: number;
    }>,
    isLoading: false,
  },
  TYPE_LABELS: {
    service: "Service",
    produit: "Produit",
  },
}));

vi.mock("@/hooks/catalogue/useCatalogueProduits", () => ({
  useCatalogueProduits: () => hookState,
}));

vi.mock("@/types/facturation", () => ({
  PRODUIT_TYPE_LABELS: TYPE_LABELS,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Check: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-testid": "check-icon" }),
  ChevronsUpDown: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-testid": "chevrons-icon" }),
  Package: (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", { ...props, "data-testid": "package-icon" }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
    React.createElement("button", props, children),
}));

vi.mock("@/components/ui/popover", () => {
  const PopoverContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null>(null);

  return {
    Popover: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children?: React.ReactNode;
    }) =>
      React.createElement(PopoverContext.Provider, { value: { open, onOpenChange } }, children),
    PopoverTrigger: ({
      children,
    }: {
      asChild?: boolean;
      children?: React.ReactElement;
    }) => {
      const ctx = React.useContext(PopoverContext);
      if (!ctx || !React.isValidElement(children)) return null;
      return React.cloneElement(children, {
        onClick: () => ctx.onOpenChange(!ctx.open),
      });
    },
    PopoverContent: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => {
      const ctx = React.useContext(PopoverContext);
      if (!ctx?.open) return null;
      return React.createElement("div", props, children);
    },
  };
});

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children?: React.ReactNode; shouldFilter?: boolean }) =>
    React.createElement("div", null, children),
  CommandEmpty: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  CommandGroup: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  CommandInput: ({
    value,
    onValueChange,
    placeholder,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) =>
    React.createElement("input", {
      value,
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value),
    }),
  CommandItem: ({
    children,
    onSelect,
    value,
    className,
  }: {
    children?: React.ReactNode;
    onSelect?: (value: string) => void;
    value: string;
    className?: string;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        className,
        onClick: () => onSelect?.(value),
      },
      children
    ),
  CommandList: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("ProduitSelector", () => {
  beforeEach(() => {
    hookState.produits = PRODUITS;
    hookState.isLoading = false;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("affiche le placeholder puis la sélection courante", () => {
    const onSelect = vi.fn();
    const wrapper = createWrapper();

    const { rerender } = render(<ProduitSelector onSelect={onSelect} />, { wrapper });

    expect(screen.getByRole("combobox")).toHaveTextContent("Sélectionner un produit…");

    rerender(
      React.createElement(
        wrapper,
        null,
        React.createElement(ProduitSelector, { value: "p1", onSelect })
      )
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("SERV-001 — Audit");
  });

  it("désactive le bouton pendant le chargement", () => {
    hookState.isLoading = true;
    const onSelect = vi.fn();

    render(<ProduitSelector onSelect={onSelect} />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("filtre par type et permet de sélectionner un produit avec ses informations formatées", async () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();

    render(<ProduitSelector onSelect={onSelect} filterType="service" />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByText("SERV-001")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
    expect(screen.getByText(/Service · 120,00 €/)).toBeInTheDocument();
    expect(screen.getByText(/TVA 20%/)).toBeInTheDocument();
    expect(screen.queryByText("PROD-002")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Rechercher (code, nom)…"), {
      target: { value: "maintenance" },
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("SERV-003")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.queryByText("SERV-001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Maintenance"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(PRODUITS[2]);
    expect(screen.queryByPlaceholderText("Rechercher (code, nom)…")).not.toBeInTheDocument();
  });

  it("propose d'effacer la sélection et renvoie null", () => {
    const onSelect = vi.fn();

    render(<ProduitSelector value="p1" onSelect={onSelect} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Effacer la sélection"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("affiche le message vide quand aucun produit ne correspond à la recherche", async () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();

    render(<ProduitSelector onSelect={onSelect} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("SERV-001")).toBeInTheDocument();
    expect(screen.getByText("PROD-002")).toBeInTheDocument();
    expect(screen.getByText("SERV-003")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Rechercher (code, nom)…"), {
      target: { value: "introuvable" },
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText("SERV-001")).not.toBeInTheDocument();
    expect(screen.queryByText("PROD-002")).not.toBeInTheDocument();
    expect(screen.queryByText("SERV-003")).not.toBeInTheDocument();
    expect(screen.getByText("Aucun produit trouvé")).toBeInTheDocument();
  });
});