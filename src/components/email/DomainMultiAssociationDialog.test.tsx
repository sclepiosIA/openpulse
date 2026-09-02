/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { DomainMultiAssociationDialog } from "./DomainMultiAssociationDialog";

const {
  ETABS,
  FIXED_AUTH,
  mockFrom,
  mockFixMalformedEncoding,
} = vi.hoisted(() => ({
  ETABS: [
    { id: "etab-1", nom: "Hôpital Saint Pierre", ville: "Paris" },
    { id: "etab-2", nom: "Clinique du Lac", ville: "Lyon" },
    { id: "etab-3", nom: "Centre Hospitalier Nord", ville: "Lille" },
  ],
  FIXED_AUTH: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockFixMalformedEncoding: vi.fn((value: string) => value),
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
  useAuth: () => FIXED_AUTH,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => FIXED_AUTH,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => FIXED_AUTH,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/emailUtils", () => ({
  fixMalformedEncoding: mockFixMalformedEncoding,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
  }) => (
    <input
      aria-label="checkbox"
      type="checkbox"
      checked={Boolean(checked)}
      onChange={() => onCheckedChange?.()}
    />
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    placeholder,
    value,
    onChange,
    className,
  }: {
    id?: string;
    placeholder?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
  }) => (
    <input id={id} placeholder={placeholder} value={value} onChange={onChange} className={className} />
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
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

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="select-root">
      <select
        aria-label="Niveau de confiance"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="high">Élevé (vérifié manuellement)</option>
        <option value="medium">Moyen (probable)</option>
        <option value="low">Faible (à vérifier)</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children, id, className }: { children: React.ReactNode; id?: string; className?: string }) => (
    <div id={id} className={className}>
      {children}
    </div>
  ),
  SelectValue: () => <span />,
}));

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissements: vi.fn(),
}));

import { useEtablissements } from "@/hooks/crm/useEtablissements";

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

describe("DomainMultiAssociationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le loader pendant le chargement puis les établissements avec leurs valeurs métier", async () => {
    vi.mocked(useEtablissements).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useEtablissements>);

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <DomainMultiAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="example.org"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Associer le domaine example.org")).toBeInTheDocument();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    vi.mocked(useEtablissements).mockReturnValue({
      data: ETABS,
      isLoading: false,
    } as unknown as ReturnType<typeof useEtablissements>);

    rerender(
      <DomainMultiAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="example.org"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Hôpital Saint Pierre")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("Clinique du Lac")).toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
    expect(mockFixMalformedEncoding).toHaveBeenCalledWith("Hôpital Saint Pierre");
    expect(mockFixMalformedEncoding).toHaveBeenCalledWith("Paris");
  });

  it("filtre, sélectionne plusieurs établissements, change le niveau de confiance et confirme avec les bons arguments", () => {
    vi.mocked(useEtablissements).mockReturnValue({
      data: ETABS,
      isLoading: false,
    } as unknown as ReturnType<typeof useEtablissements>);

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DomainMultiAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="groupement.fr"
        onConfirm={onConfirm}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Nom ou ville...");
    fireEvent.change(searchInput, { target: { value: "lyon" } });

    expect(screen.getByText("Clinique du Lac")).toBeInTheDocument();
    expect(screen.queryByText("Hôpital Saint Pierre")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "" } });

    fireEvent.click(screen.getByText("Hôpital Saint Pierre"));
    fireEvent.click(screen.getByText("Clinique du Lac"));

    expect(screen.getByText("Établissements (2 sélectionnés)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Associer à 2 établissements" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Niveau de confiance"), {
      target: { value: "medium" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Associer à 2 établissements" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(["etab-1", "etab-2"], "medium");
    expect(screen.getByText("Établissements (0 sélectionné)")).toBeInTheDocument();
    expect((screen.getByPlaceholderText("Nom ou ville...") as HTMLInputElement).value).toBe("");
  });

  it("désactive les actions pendant isLoading et ferme le dialogue via Annuler", () => {
    vi.mocked(useEtablissements).mockReturnValue({
      data: ETABS,
      isLoading: false,
    } as unknown as ReturnType<typeof useEtablissements>);

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DomainMultiAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="hopital.fr"
        onConfirm={onConfirm}
        isLoading={true}
      />,
    );

    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Associer à 0 établissement/ })).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    render(
      <DomainMultiAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="hopital.fr"
        onConfirm={onConfirm}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Annuler" })[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("couvre un hook react-query en chargement puis succès avec wrapper QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["etablissements-test-success"],
          queryFn: async () => ETABS,
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(ETABS);
    expect(result.current.data?.[0].nom).toBe("Hôpital Saint Pierre");
    expect(result.current.data?.[1].ville).toBe("Lyon");
  });

  it("couvre un hook react-query en erreur avec wrapper QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["etablissements-test-error"],
          queryFn: async () => {
            const response: { data: null; error: { message: string } } = {
              data: null,
              error: { message: "x" },
            };
            throw new Error(response.error.message);
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("x");
  });
});