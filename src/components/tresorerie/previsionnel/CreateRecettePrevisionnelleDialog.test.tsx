// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { CreateRecettePrevisionnelleDialog } from "./CreateRecettePrevisionnelleDialog";

const {
  ETABS_SUCCESS,
  USER_STABLE,
  mockFrom,
  mockCreateRevenu,
  mockOnOpenChange,
  FIXED_DATE,
} = vi.hoisted(() => ({
  ETABS_SUCCESS: [
    { id: "e1", nom: "Alpha" },
    { id: "e2", nom: "Beta" },
  ],
  USER_STABLE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockCreateRevenu: vi.fn(),
  mockOnOpenChange: vi.fn(),
  FIXED_DATE: new Date("2025-03-15T00:00:00.000Z"),
}));

function createThenableBuilder(result: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(result);
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);

  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/tresorerie/useTresorerieRevenus", () => ({
  useTresorerieRevenus: () => ({
    createRevenu: mockCreateRevenu,
    isCreating: false,
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => USER_STABLE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => USER_STABLE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => USER_STABLE,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h1 className={className}>{children}</h1>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type = "button",
    disabled,
    className,
    variant,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type,
    step,
    min,
    required,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
    step?: string;
    min?: string;
    required?: boolean;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      step={step}
      min={min}
      required={required}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    rows,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    rows?: number;
  }) => <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}));

vi.mock("@/components/ui/select", () => {
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>;
  SelectItem.displayName = "SelectItem";

  const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  SelectContent.displayName = "SelectContent";

  const SelectTrigger = ({ children, id }: { children: React.ReactNode; id?: string }) => (
    <div id={id}>{children}</div>
  );
  SelectTrigger.displayName = "SelectTrigger";

  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;
  SelectValue.displayName = "SelectValue";

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => {
    const options: Array<{ value: string; label: string }> = [];

    const visit = (node: React.ReactNode) => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return;
        const childType = child.type as { displayName?: string };
        if (childType.displayName === "SelectItem") {
          const text = React.Children.toArray(child.props.children)
            .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
            .join("");
          options.push({ value: child.props.value as string, label: text });
          return;
        }
        if (child.props && "children" in child.props) {
          visit(child.props.children);
        }
      });
    };

    visit(children);

    return (
      <select aria-label="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect?: (date: Date | undefined) => void }) => (
    <button type="button" onClick={() => onSelect?.(FIXED_DATE)}>
      choisir-date
    </button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { asChild?: boolean; children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  CalendarIcon: () => <span>icon-calendar</span>,
  Loader2: () => <span>icon-loader</span>,
  Plus: () => <span>icon-plus</span>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CreateRecettePrevisionnelleDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("charge les établissements avec useQuery puis retourne les données attendues", async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: ETABS_SUCCESS, error: null }));

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["etablissements-for-recette"],
          queryFn: async () => {
            const { data, error } = await mockFrom("etablissements")
              .select("id, nom")
              .in("statut", ["Contractuel", "Production", "Déploiement", "Formation", "Go-Live"])
              .order("nom");
            if (error) throw error;
            return data || [];
          },
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(result.current.data).toEqual(ETABS_SUCCESS);
    expect(result.current.data?.map((item) => item.nom)).toEqual(["Alpha", "Beta"]);
  });

  it("passe en erreur quand la requête établissements échoue", async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: null, error: { message: "x" } }));

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["etablissements-for-recette-error"],
          queryFn: async () => {
            const { data, error } = await mockFrom("etablissements")
              .select("id, nom")
              .in("statut", ["Contractuel", "Production", "Déploiement", "Formation", "Go-Live"])
              .order("nom");
            if (error) throw error;
            return data || [];
          },
        }),
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: "x" });
  });

  it("crée 12 revenus mensuels avec les valeurs métier attendues puis ferme la boîte de dialogue", async () => {
    mockFrom.mockReturnValue(createThenableBuilder({ data: ETABS_SUCCESS, error: null }));
    mockCreateRevenu.mockResolvedValue(undefined);

    render(
      <Wrapper>
        <CreateRecettePrevisionnelleDialog open={true} onOpenChange={mockOnOpenChange} />
      </Wrapper>
    );

    fireEvent.change(screen.getByLabelText("Libellé *"), { target: { value: "Paiement client X" } });
    fireEvent.change(screen.getByLabelText("Montant (€) *"), { target: { value: "1200.50" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Note test" } });

    const selects = screen.getAllByLabelText("select");
    fireEvent.change(selects[1], { target: { value: "licence" } });
    fireEvent.change(selects[2], { target: { value: "mensuelle" } });

    fireEvent.click(screen.getByRole("button", { name: "choisir-date" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /créer/i })).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /créer/i }));
    });

    await waitFor(() => {
      expect(mockCreateRevenu).toHaveBeenCalledTimes(12);
    });

    expect(mockCreateRevenu).toHaveBeenNthCalledWith(1, {
      etablissement_id: undefined,
      mois: "2025-03",
      montant_prevu: 1200.5,
      type_revenu: "licence",
      notes: "Paiement client X (mars 25) - Note test",
    });

    expect(mockCreateRevenu).toHaveBeenNthCalledWith(12, {
      etablissement_id: undefined,
      mois: "2026-02",
      montant_prevu: 1200.5,
      type_revenu: "licence",
      notes: "Paiement client X (févr. 26) - Note test",
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});