/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { EmailSpecificMappingDialog } from "./EmailSpecificMappingDialog";

const {
  ETABS,
  GROUPES,
  PARTENAIRES,
  PROFILES,
  mockMutateAsync,
  mockOnOpenChange,
  hookState,
} = vi.hoisted(() => ({
  ETABS: [
    { id: "etab-1", nom: "Clinique Atlas", ville: "Lyon" },
    { id: "etab-2", nom: "Centre Nova", ville: "Paris" },
  ],
  GROUPES: [
    { id: "grp-1", nom: "Groupe Horizon" },
    { id: "grp-2", nom: "Groupe Azur" },
  ],
  PARTENAIRES: [
    { id: "part-1", nom: "Partenaire Alpha" },
    { id: "part-2", nom: "Partenaire Beta" },
  ],
  PROFILES: [
    { id: "prof-1", prenom: "Jean", nom: "Dupont" },
    { id: "prof-2", prenom: "Marie", nom: "Martin" },
  ],
  mockMutateAsync: vi.fn(),
  mockOnOpenChange: vi.fn(),
  hookState: {
    etabsLoading: false,
    groupesLoading: false,
    partenairesLoading: false,
    profilesLoading: false,
    mutationPending: false,
    mutationError: null as null | { message: string },
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (resolve: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
      catch: (reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(reject),
    };
    return builder;
  };

  return {
    supabase: {
      from: vi.fn(() => createBuilder()),
    },
  };
});

vi.mock("@/hooks/email/useEmailSpecificMappings", () => ({
  useAddEmailSpecificMapping: () => ({
    mutateAsync: mockMutateAsync,
    isPending: hookState.mutationPending,
    isError: Boolean(hookState.mutationError),
    error: hookState.mutationError,
  }),
}));

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissements: () => ({
    data: ETABS,
    isLoading: hookState.etabsLoading,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/hooks/crm/useGroupes", () => ({
  useGroupes: () => ({
    data: GROUPES,
    isLoading: hookState.groupesLoading,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/hooks/crm/usePartenaires", () => ({
  usePartenaires: () => ({
    data: PARTENAIRES,
    isLoading: hookState.partenairesLoading,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: () => ({
    data: PROFILES,
    isLoading: hookState.profilesLoading,
    isError: false,
    error: null,
  }),
}));

vi.mock("lucide-react", () => ({
  Mail: () => <svg data-testid="icon-mail" />,
  Building2: () => <svg data-testid="icon-building" />,
  Users: () => <svg data-testid="icon-users" />,
  Handshake: () => <svg data-testid="icon-handshake" />,
  UserCircle: () => <svg data-testid="icon-user-circle" />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit";
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
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
    disabled,
    type,
    required,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    required?: boolean;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
      required={required}
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
  }) => (
    <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => {
    const items: Array<{ value: string; label: string; disabled?: boolean }> = [];
    let triggerId: string | undefined;
    let placeholder = "";

    const getText = (node: React.ReactNode): string =>
      React.Children.toArray(node)
        .map((child) => {
          if (typeof child === "string" || typeof child === "number") return String(child);
          if (React.isValidElement(child)) {
            const props = child.props as { children?: React.ReactNode };
            return getText(props.children);
          }
          return "";
        })
        .join("");

    const walk = (node: React.ReactNode): void => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return;
        const props = child.props as {
          children?: React.ReactNode;
          value?: string;
          disabled?: boolean;
          id?: string;
          placeholder?: string;
        };
        if (typeof props.value === "string") {
          items.push({ value: props.value, label: getText(props.children), disabled: props.disabled });
        }
        if (props.id) triggerId = props.id;
        if (typeof props.placeholder === "string") placeholder = props.placeholder;
        if (props.children) walk(props.children);
      });
    };

    walk(children);

    return (
      <select
        aria-label={triggerId}
        data-testid={triggerId ? `select-${triggerId}` : "select"}
        value={value ?? ""}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">{placeholder || "--"}</option>
        {items.map((item) => (
          <option key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </option>
        ))}
      </select>
    );
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
    disabled,
  }: {
    value: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>,
}));

vi.mock("@/components/ui/radio-group", () => ({
  RadioGroup: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => {
    const inject = (node: React.ReactNode): React.ReactNode =>
      React.Children.map(node, (child) => {
        if (!React.isValidElement(child)) return child;
        const typeName =
          typeof child.type === "string" ? child.type : (child.type as { name?: string }).name;
        const props = child.props as { children?: React.ReactNode; value?: string };
        if (typeName === "RadioGroupItem") {
          return React.cloneElement(
            child as React.ReactElement<{
              checked?: boolean;
              onChange?: React.ChangeEventHandler<HTMLInputElement>;
            }>,
            {
              checked: props.value === value,
              onChange: () => onValueChange(props.value ?? ""),
            }
          );
        }
        if (props.children) {
          return React.cloneElement(child, { children: inject(props.children) });
        }
        return child;
      });

    return <div>{inject(children)}</div>;
  },
  RadioGroupItem: ({
    value,
    id,
    checked,
    onChange,
  }: {
    value: string;
    id?: string;
    checked?: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
  }) => <input type="radio" id={id} value={value} checked={checked} onChange={onChange} />,
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

function renderDialog(props?: Partial<React.ComponentProps<typeof EmailSpecificMappingDialog>>) {
  const Wrapper = createWrapper();
  return render(
    <EmailSpecificMappingDialog open={true} onOpenChange={mockOnOpenChange} {...props} />,
    { wrapper: Wrapper }
  );
}

describe("EmailSpecificMappingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.etabsLoading = false;
    hookState.groupesLoading = false;
    hookState.partenairesLoading = false;
    hookState.profilesLoading = false;
    hookState.mutationPending = false;
    hookState.mutationError = null;
    mockMutateAsync.mockResolvedValue({ data: { id: "map-1" }, error: null });
  });

  it("monte dans un QueryClientProvider sans erreur", () => {
    const Wrapper = createWrapper();
    const { result } = renderHook(() => true, { wrapper: Wrapper });
    expect(result.current).toBe(true);
  });

  it("affiche le contenu principal et pré-remplit l'email par défaut en lecture seule", () => {
    renderDialog({ defaultEmail: "contact@exemple.fr" });

    expect(screen.getByText("Affilier un email spécifique")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Associez un email unique à un établissement ou un groupe. Cette affiliation a la priorité sur les mappings de domaine."
      )
    ).toBeInTheDocument();

    const emailInput = screen.getByLabelText("Adresse email *") as HTMLInputElement;
    expect(emailInput.value).toBe("contact@exemple.fr");
    expect(emailInput).toBeDisabled();

    expect(screen.getByText("Créer l'affiliation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });

  it("affiche un état de chargement pour la liste des établissements", () => {
    hookState.etabsLoading = true;

    renderDialog();

    const etablissementSelect = screen.getByTestId("select-etablissement");
    expect(etablissementSelect).toHaveTextContent("Chargement...");
    expect(screen.getByText("Établissement *")).toBeInTheDocument();
  });

  it("soumet une affiliation établissement avec les valeurs métier attendues puis ferme le dialog", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Adresse email *"), {
      target: { value: "admin@atlas.fr" },
    });

    fireEvent.change(screen.getByTestId("select-etablissement"), {
      target: { value: "etab-1" },
    });

    fireEvent.change(screen.getByTestId("select-confidence"), {
      target: { value: "medium" },
    });

    fireEvent.change(screen.getByLabelText("Notes (optionnel)"), {
      target: { value: "Priorité manuelle" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer l'affiliation"));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      email_address: "admin@atlas.fr",
      etablissement_id: "etab-1",
      groupe_id: undefined,
      partenaire_id: undefined,
      profile_id: undefined,
      niveau_mapping: "etablissement",
      confidence_level: "medium",
      notes: "Priorité manuelle",
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("soumet une affiliation groupe avec le bon identifiant et sans champs d'un autre niveau", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Adresse email *"), {
      target: { value: "groupe@horizon.fr" },
    });

    fireEvent.click(screen.getByLabelText("Groupe"));

    fireEvent.change(screen.getByTestId("select-groupe"), {
      target: { value: "grp-2" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer l'affiliation"));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      email_address: "groupe@horizon.fr",
      etablissement_id: undefined,
      groupe_id: "grp-2",
      partenaire_id: undefined,
      profile_id: undefined,
      niveau_mapping: "groupe",
      confidence_level: "high",
      notes: "",
    });
  });

  it("soumet une affiliation partenaire", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Adresse email *"), {
      target: { value: "partenaire@alpha.fr" },
    });

    fireEvent.click(screen.getByLabelText("Partenaire"));

    fireEvent.change(screen.getByTestId("select-partenaire"), {
      target: { value: "part-1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer l'affiliation"));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      email_address: "partenaire@alpha.fr",
      etablissement_id: undefined,
      groupe_id: undefined,
      partenaire_id: "part-1",
      profile_id: undefined,
      niveau_mapping: "partenaire",
      confidence_level: "high",
      notes: "",
    });
  });

  it("soumet une affiliation équipe", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Adresse email *"), {
      target: { value: "jean@equipe.fr" },
    });

    fireEvent.click(screen.getByLabelText("Équipe"));

    fireEvent.change(screen.getByTestId("select-profile"), {
      target: { value: "prof-1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer l'affiliation"));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      email_address: "jean@equipe.fr",
      etablissement_id: undefined,
      groupe_id: undefined,
      partenaire_id: undefined,
      profile_id: "prof-1",
      niveau_mapping: "equipe",
      confidence_level: "high",
      notes: "",
    });
  });

  it("ne soumet pas si l'email est vide", async () => {
    renderDialog();

    fireEvent.change(screen.getByTestId("select-etablissement"), {
      target: { value: "etab-1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer l'affiliation"));
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("ne soumet pas si aucun établissement n'est sélectionné pour le niveau établissement", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Adresse email *"), {
      target: { value: "sans-etab@exemple.fr" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer l'affiliation"));
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("affiche l'état pending sur le bouton", () => {
    hookState.mutationPending = true;

    renderDialog();

    const submitButton = screen.getByRole("button", { name: "Création..." });
    expect(submitButton).toBeDisabled();
  });

  it("propage un état d'erreur de mutation via le hook mocké", async () => {
    hookState.mutationError = { message: "x" };

    renderDialog();

    await waitFor(() => {
      expect(hookState.mutationError).toEqual({ message: "x" });
    });

    expect(screen.getByRole("button", { name: "Créer l'affiliation" })).toBeInTheDocument();
  });
});