/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobOfferFormDialog from "./JobOfferFormDialog";

const {
  PROFILES,
  AUTH_STATE,
  createOfferMock,
  updateOfferMock,
  debugErrorMock,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const PROFILES = [
    { id: "p1", prenom: "Ada", nom: "Lovelace" },
    { id: "p2", prenom: "Alan", nom: "Turing" },
  ];

  const AUTH_STATE = {
    user: { id: "u1", email: "test@local.dev" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const createOfferMock = vi.fn();
  const updateOfferMock = vi.fn();
  const debugErrorMock = vi.fn();

  const builder: {
    _result: { data: unknown; error: unknown };
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  } = {
    _result: { data: PROFILES, error: null },
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
    then(onFulfilled, onRejected) {
      return Promise.resolve(this._result).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve(this._result).catch(onRejected);
    },
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.single.mockResolvedValue({ data: PROFILES[0], error: null });
  builder.maybeSingle.mockResolvedValue({ data: PROFILES[0], error: null });

  const mockFrom = vi.fn(() => builder);

  return {
    PROFILES,
    AUTH_STATE,
    createOfferMock,
    updateOfferMock,
    debugErrorMock,
    mockFrom,
    builder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/recrutement/useJobOffers", () => ({
  useCreateJobOffer: () => ({
    mutateAsync: createOfferMock,
    isPending: false,
    isError: false,
  }),
  useUpdateJobOffer: () => ({
    mutateAsync: updateOfferMock,
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/types/recrutement", () => ({
  CONTRACT_TYPE_LABELS: {
    cdi: "CDI",
    cdd: "CDD",
    stage: "Stage",
  },
  JOB_STATUS_LABELS: {
    draft: "Brouillon",
    published: "Publié",
    closed: "Clôturé",
  },
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
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input ref={ref} {...props} />
  )),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) => (
    <textarea ref={ref} {...props} />
  )),
}));

vi.mock("@/components/ui/select", () => {
  type SelectContextType = {
    value?: string;
    onValueChange?: (value: string) => void;
  };
  const SelectContext = React.createContext<SelectContextType>({});

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>;

  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  const SelectValue = ({ placeholder }: { placeholder?: string }) => {
    const ctx = React.useContext(SelectContext);
    return <span>{ctx.value || placeholder || ""}</span>;
  };

  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const ctx = React.useContext(SelectContext);
    return (
      <button type="button" onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
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

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button type="button" aria-pressed={checked} onClick={() => onCheckedChange?.(!checked)}>
      switch
    </button>
  ),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  FormMessage: () => null,
  FormField: ({
    render,
    control,
    name,
  }: {
    render: (props: {
      field: {
        value: unknown;
        onChange: (value: unknown) => void;
        onBlur: () => void;
        name: string;
        ref: React.RefCallback<HTMLElement>;
      };
    }) => React.ReactNode;
    control: unknown;
    name: string;
  }) => {
    const { Controller } = require("react-hook-form") as typeof import("react-hook-form");
    return (
      <Controller
        control={control as never}
        name={name}
        render={({ field }) =>
          render({
            field: {
              value: field.value,
              onChange: field.onChange,
              onBlur: field.onBlur,
              name: field.name,
              ref: field.ref as React.RefCallback<HTMLElement>,
            },
          })
        }
      />
    );
  },
}));

vi.mock("lucide-react", () => ({
  Briefcase: () => <span>briefcase</span>,
  MapPin: () => <span>mappin</span>,
  Calendar: () => <span>calendar</span>,
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

describe("JobOfferFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builder._result = { data: PROFILES, error: null };
    createOfferMock.mockResolvedValue({ id: "new1" });
    updateOfferMock.mockResolvedValue({ id: "upd1" });
  });

  it("affiche le mode création avec les valeurs par défaut et charge les profils si open=true", async () => {
    render(<JobOfferFormDialog open onOpenChange={vi.fn()} />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Nouvelle offre d'emploi" })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("profiles");
    });

    expect(builder.select).toHaveBeenCalledWith("id, prenom, nom");
    expect(builder.order).toHaveBeenCalledWith("nom");

    const titleInput = screen.getByPlaceholderText("Ex: Développeur Full Stack") as HTMLInputElement;
    expect(titleInput.value).toBe("");

    const descriptionInput = screen.getByPlaceholderText(
      "Décrivez le poste, les missions, les responsabilités..."
    ) as HTMLTextAreaElement;
    expect(descriptionInput.value).toBe("");

    const departementInput = screen.getByPlaceholderText("Ex: Tech, Marketing...") as HTMLInputElement;
    expect(departementInput.value).toBe("");

    const localisationInput = screen.getByPlaceholderText("Ex: Paris, Remote...") as HTMLInputElement;
    expect(localisationInput.value).toBe("");

    const salaireMinInput = screen.getByPlaceholderText("40000") as HTMLInputElement;
    expect(salaireMinInput.value).toBe("");

    const salaireMaxInput = screen.getByPlaceholderText("60000") as HTMLInputElement;
    expect(salaireMaxInput.value).toBe("");

    const experienceInput = screen.getByPlaceholderText("3") as HTMLInputElement;
    expect(experienceInput.value).toBe("");

    const profilesOption = await screen.findByRole("button", { name: "Ada Lovelace" });
    expect(profilesOption).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alan Turing" })).toBeInTheDocument();
  });

  it("soumet une création avec les valeurs métier saisies puis ferme la modale", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(<JobOfferFormDialog open onOpenChange={onOpenChange} />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Ada Lovelace" });

    await user.type(screen.getByPlaceholderText("Ex: Développeur Full Stack"), "Développeur Front");
    await user.type(
      screen.getByPlaceholderText("Décrivez le poste, les missions, les responsabilités..."),
      "Construire des interfaces"
    );
    await user.type(screen.getByPlaceholderText("Ex: Tech, Marketing..."), "Tech");
    await user.type(screen.getByPlaceholderText("Ex: Paris, Remote..."), "Paris");
    await user.type(screen.getByPlaceholderText("40000"), "45000");
    await user.type(screen.getByPlaceholderText("60000"), "55000");
    await user.type(screen.getByPlaceholderText("3"), "2");

    const numberInputs = screen.getAllByRole("spinbutton");
    const nombrePostesInput = numberInputs[numberInputs.length - 1] as HTMLInputElement;
    fireEvent.change(nombrePostesInput, { target: { value: "3" } });

    await user.click(screen.getByRole("button", { name: "CDD" }));
    await user.click(screen.getByRole("button", { name: "Publié" }));
    await user.click(screen.getByRole("button", { name: "Ada Lovelace" }));

    const submitButton =
      screen.queryByRole("button", { name: /créer/i }) ||
      screen.queryByRole("button", { name: /enregistrer/i }) ||
      screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit");

    expect(submitButton).toBeDefined();

    await user.click(submitButton as HTMLElement);

    await waitFor(() => {
      expect(createOfferMock).toHaveBeenCalledTimes(1);
    });

    expect(createOfferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        titre: "Développeur Front",
        type_contrat: "cdd",
        statut: "published",
        description: "Construire des interfaces",
        departement: "Tech",
        localisation: "Paris",
        salaire_min: 45000,
        salaire_max: 55000,
        experience_minimum: 2,
        nombre_postes: 3,
        responsable_id: "p1",
        priorite: "medium",
        diffusion_externe: false,
      })
    );

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("pré-remplit les champs en mode édition puis soumet la mise à jour avec l'id de l'offre", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    const offer = {
      id: "offer-1",
      titre: "Ingénieur Backend",
      type_contrat: "cdi",
      statut: "draft",
      description: "Maintenir les API",
      localisation: "Lyon",
      departement: "Engineering",
      salaire_min: 50000,
      salaire_max: 70000,
      experience_minimum: 4,
      niveau_etudes: "",
      nombre_postes: 2,
      date_publication: "",
      date_cloture: "",
      diffusion_externe: true,
      responsable_id: "p2",
      priorite: "high",
    };

    render(<JobOfferFormDialog open onOpenChange={onOpenChange} offer={offer} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("heading", { name: "Modifier l'offre" })).toBeInTheDocument();

    await waitFor(() => {
      expect((screen.getByPlaceholderText("Ex: Développeur Full Stack") as HTMLInputElement).value).toBe(
        "Ingénieur Backend"
      );
    });

    expect((screen.getByPlaceholderText("Décrivez le poste, les missions, les responsabilités...") as HTMLTextAreaElement).value).toBe(
      "Maintenir les API"
    );
    expect((screen.getByPlaceholderText("Ex: Tech, Marketing...") as HTMLInputElement).value).toBe("Engineering");
    expect((screen.getByPlaceholderText("Ex: Paris, Remote...") as HTMLInputElement).value).toBe("Lyon");
    expect((screen.getByPlaceholderText("40000") as HTMLInputElement).value).toBe("50000");
    expect((screen.getByPlaceholderText("60000") as HTMLInputElement).value).toBe("70000");
    expect((screen.getByPlaceholderText("3") as HTMLInputElement).value).toBe("4");

    const titleInput = screen.getByPlaceholderText("Ex: Développeur Full Stack");
    await user.clear(titleInput);
    await user.type(titleInput, "Ingénieur Backend Senior");

    const submitButton =
      screen.queryByRole("button", { name: /modifier/i }) ||
      screen.queryByRole("button", { name: /enregistrer/i }) ||
      screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit");

    expect(submitButton).toBeDefined();

    await user.click(submitButton as HTMLElement);

    await waitFor(() => {
      expect(updateOfferMock).toHaveBeenCalledTimes(1);
    });

    expect(updateOfferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "offer-1",
        titre: "Ingénieur Backend Senior",
        type_contrat: "cdi",
        statut: "draft",
        description: "Maintenir les API",
        localisation: "Lyon",
        departement: "Engineering",
        salaire_min: 50000,
        salaire_max: 70000,
        experience_minimum: 4,
        nombre_postes: 2,
        responsable_id: "p2",
        priorite: "high",
        diffusion_externe: true,
      })
    );

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("gère une erreur de mutation sans fermer la modale et journalise l'erreur", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const failure = new Error("x");
    createOfferMock.mockRejectedValueOnce(failure);

    render(<JobOfferFormDialog open onOpenChange={onOpenChange} />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Ada Lovelace" });

    await user.type(screen.getByPlaceholderText("Ex: Développeur Full Stack"), "Product Owner");

    const submitButton =
      screen.queryByRole("button", { name: /créer/i }) ||
      screen.queryByRole("button", { name: /enregistrer/i }) ||
      screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit");

    expect(submitButton).toBeDefined();

    await user.click(submitButton as HTMLElement);

    await waitFor(() => {
      expect(createOfferMock).toHaveBeenCalledTimes(1);
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(debugErrorMock).toHaveBeenCalledWith("Erreur:", failure);
  });
});