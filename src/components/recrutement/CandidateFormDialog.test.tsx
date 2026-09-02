import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateFormDialog from "./CandidateFormDialog";

const {
  JOB_OFFERS,
  PROFILES,
  STATUS_LABELS,
  SOURCES,
  createMutateAsync,
  updateMutateAsync,
  mockUseJobOffers,
  mockUseCreateCandidate,
  mockUseUpdateCandidate,
  mockFrom,
  mockOrder,
  mockDebugError,
} = vi.hoisted(() => {
  const JOB_OFFERS = [
    { id: "job-1", titre: "Développeur Frontend" },
    { id: "job-2", titre: "Product Designer" },
  ];

  const PROFILES = [
    { id: "p-1", prenom: "Alice", nom: "Martin" },
    { id: "p-2", prenom: "Bob", nom: "Durand" },
  ];

  const STATUS_LABELS = {
    new: "Nouveau",
    screening: "Préqualification",
    interview: "Entretien",
  };

  const SOURCES = ["LinkedIn", "Cooptation", "Site carrière"];

  return {
    JOB_OFFERS,
    PROFILES,
    STATUS_LABELS,
    SOURCES,
    createMutateAsync: vi.fn(),
    updateMutateAsync: vi.fn(),
    mockUseJobOffers: vi.fn(),
    mockUseCreateCandidate: vi.fn(),
    mockUseUpdateCandidate: vi.fn(),
    mockFrom: vi.fn(),
    mockOrder: vi.fn(),
    mockDebugError: vi.fn(),
  };
});

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/hooks/recrutement/useJobOffers", () => ({
  useJobOffers: mockUseJobOffers,
}));

vi.mock("@/hooks/recrutement/useCandidates", () => ({
  useCreateCandidate: mockUseCreateCandidate,
  useUpdateCandidate: mockUseUpdateCandidate,
}));

vi.mock("@/types/recrutement", () => ({
  CANDIDATE_STATUS_LABELS: STATUS_LABELS,
  CANDIDATE_SOURCES: SOURCES,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("lucide-react", () => ({
  User: () => <svg data-testid="icon-user" />,
  Briefcase: () => <svg data-testid="icon-briefcase" />,
  FileText: () => <svg data-testid="icon-filetext" />,
}));

vi.mock("@hookform/resolvers/zod", async () => {
  const actual = await vi.importActual<typeof import("@hookform/resolvers/zod")>("@hookform/resolvers/zod");
  return actual;
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
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

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
    className,
  }: {
    children: React.ReactNode;
    value: string;
    className?: string;
  }) => (
    <button type="button" data-value={value} className={className}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => {
  const ReactModule = React as typeof React;
  const SelectContext = ReactModule.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

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
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>;

  const SelectContent = ({ children }: { children: React.ReactNode }) => {
    const ctx = ReactModule.useContext(SelectContext);
    const options: Array<{ value: string; label: React.ReactNode }> = [];

    ReactModule.Children.forEach(children, (child) => {
      if (ReactModule.isValidElement<{ value?: string; children?: React.ReactNode }>(child)) {
        options.push({
          value: child.props.value ?? "",
          label: child.props.children,
        });
      }
    });

    return (
      <select
        aria-label="select"
        value={ctx.value ?? ""}
        onChange={(e) => ctx.onValueChange?.(e.target.value)}
      >
        <option value="" />
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {typeof option.label === "string" ? option.label : option.value}
          </option>
        ))}
      </select>
    );
  };

  const SelectItem = ({
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <>{children}</>;

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

vi.mock("@/components/ui/form", async () => {
  const rhf = await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => null,
    FormField: ({
      control,
      name,
      render: renderProp,
    }: {
      control: Parameters<typeof rhf.Controller>[0]["control"];
      name: string;
      render: (props: {
        field: {
          name: string;
          value: unknown;
          onChange: (...event: unknown[]) => void;
          onBlur: () => void;
          ref: React.Ref<unknown>;
        };
      }) => React.ReactNode;
    }) => <rhf.Controller control={control} name={name} render={renderProp} />,
  };
});

function createSupabaseBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: mockOrder.mockImplementation(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: PROFILES[0], error: null })),
    maybeSingle: vi.fn(async () => ({ data: PROFILES[0], error: null })),
    then: (onFulfilled?: (value: { data: typeof PROFILES; error: null }) => unknown) =>
      Promise.resolve({ data: PROFILES, error: null }).then(onFulfilled),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve({ data: PROFILES, error: null }).catch(onRejected),
  };
  return builder;
}

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

describe("CandidateFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseJobOffers.mockReturnValue({
      data: JOB_OFFERS,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseCreateCandidate.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    mockUseUpdateCandidate.mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });

    mockFrom.mockImplementation(() => createSupabaseBuilder());

    createMutateAsync.mockResolvedValue({ id: "cand-new" });
    updateMutateAsync.mockResolvedValue({ id: "cand-1" });
  });

  it("affiche le titre de création, charge les profils à l'ouverture et préremplit l'offre par défaut", async () => {
    render(
      <CandidateFormDialog
        open
        onOpenChange={vi.fn()}
        defaultJobOfferId="job-2"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Nouveau candidat")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockOrder).toHaveBeenCalledWith("nom");
    });

    const selects = screen.getAllByLabelText("select");
    expect(selects[0]).toHaveValue("job-2");

    expect(screen.getByPlaceholderText("Jean")).toHaveValue("");
    expect(screen.getByPlaceholderText("Dupont")).toHaveValue("");
    expect(screen.getByPlaceholderText("jean.dupont@email.com")).toHaveValue("");
  });

  it("préremplit les champs du candidat en mode édition avec les valeurs métier", async () => {
    const candidate = {
      id: "cand-1",
      job_offer_id: "job-1",
      prenom: "Marie",
      nom: "Curie",
      email: "marie.curie@example.com",
      telephone: "0102030405",
      linkedin_url: "https://linkedin.test/marie",
      portfolio_url: "https://portfolio.test/marie",
      statut: "interview",
      source: "LinkedIn",
      source_detail: "Message direct",
      annees_experience: 7,
      salaire_souhaite: 65000,
      disponibilite: "1_month",
      date_disponibilite: "2025-01-15",
      notes: "Profil senior",
      assignee_id: "p-1",
    };

    render(
      <CandidateFormDialog
        open
        onOpenChange={vi.fn()}
        candidate={candidate}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Modifier le candidat")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Jean")).toHaveValue("Marie");
    });

    expect(screen.getByPlaceholderText("Dupont")).toHaveValue("Curie");
    expect(screen.getByPlaceholderText("jean.dupont@email.com")).toHaveValue("marie.curie@example.com");
    expect(screen.getByPlaceholderText("+33 6 12 34 56 78")).toHaveValue("0102030405");
    expect(screen.getByPlaceholderText("https://linkedin.com/in/...")).toHaveValue("https://linkedin.test/marie");
    expect(screen.getByPlaceholderText("https://...")).toHaveValue("https://portfolio.test/marie");
    expect(screen.getByPlaceholderText("5")).toHaveValue(7);
    expect(screen.getByPlaceholderText("50000")).toHaveValue(65000);

    const selects = screen.getAllByLabelText("select");
    expect(selects[0]).toHaveValue("job-1");
    expect(selects[1]).toHaveValue("interview");
    expect(selects[2]).toHaveValue("LinkedIn");
    expect(selects[3]).toHaveValue("1_month");
  });

  it("soumet une création avec les données saisies puis ferme la modale", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CandidateFormDialog
        open
        onOpenChange={onOpenChange}
        defaultJobOfferId="job-1"
      />,
      { wrapper: createWrapper() },
    );

    await user.type(screen.getByPlaceholderText("Jean"), "Alice");
    await user.type(screen.getByPlaceholderText("Dupont"), "Durand");
    await user.type(screen.getByPlaceholderText("jean.dupont@email.com"), "alice.durand@example.com");
    await user.type(screen.getByPlaceholderText("+33 6 12 34 56 78"), "0601020304");
    await user.type(screen.getByPlaceholderText("https://linkedin.com/in/..."), "https://linkedin.test/alice");
    await user.type(screen.getByPlaceholderText("https://..."), "https://book.test/alice");

    const selects = screen.getAllByLabelText("select");
    await user.selectOptions(selects[1], "screening");
    await user.selectOptions(selects[2], "Cooptation");
    await user.selectOptions(selects[3], "2_months");

    await user.type(screen.getByPlaceholderText("5"), "4");
    await user.type(screen.getByPlaceholderText("50000"), "54000");

    const submit = screen.getByRole("button", { name: /enregistrer|créer|ajouter|valider/i });
    await user.click(submit);

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        job_offer_id: "job-1",
        prenom: "Alice",
        nom: "Durand",
        email: "alice.durand@example.com",
        telephone: "0601020304",
        linkedin_url: "https://linkedin.test/alice",
        portfolio_url: "https://book.test/alice",
        statut: "screening",
        source: "Cooptation",
        source_detail: "",
        annees_experience: 4,
        salaire_souhaite: 54000,
        disponibilite: "2_months",
        date_disponibilite: "",
        notes: "",
        assignee_id: "",
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("soumet une mise à jour avec l'id du candidat existant", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    const candidate = {
      id: "cand-1",
      job_offer_id: "job-1",
      prenom: "Marie",
      nom: "Curie",
      email: "marie.curie@example.com",
      telephone: "",
      linkedin_url: "",
      portfolio_url: "",
      statut: "new",
      source: "",
      source_detail: "",
      annees_experience: undefined,
      salaire_souhaite: undefined,
      disponibilite: "",
      date_disponibilite: "",
      notes: "",
      assignee_id: "",
    };

    render(
      <CandidateFormDialog
        open
        onOpenChange={onOpenChange}
        candidate={candidate}
      />,
      { wrapper: createWrapper() },
    );

    const firstName = screen.getByPlaceholderText("Jean");
    await user.clear(firstName);
    await user.type(firstName, "Marion");

    const selects = screen.getAllByLabelText("select");
    await user.selectOptions(selects[1], "interview");

    const submit = screen.getByRole("button", { name: /enregistrer|modifier|mettre à jour|valider/i });
    await user.click(submit);

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "cand-1",
        job_offer_id: "job-1",
        prenom: "Marion",
        nom: "Curie",
        email: "marie.curie@example.com",
        telephone: "",
        linkedin_url: "",
        portfolio_url: "",
        statut: "interview",
        source: "",
        source_detail: "",
        annees_experience: undefined,
        salaire_souhaite: undefined,
        disponibilite: "",
        date_disponibilite: "",
        notes: "",
        assignee_id: "",
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("capture l'erreur de mutation et ne ferme pas la modale", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    createMutateAsync.mockRejectedValueOnce(new Error("x"));

    render(
      <CandidateFormDialog
        open
        onOpenChange={onOpenChange}
        defaultJobOfferId="job-1"
      />,
      { wrapper: createWrapper() },
    );

    await user.type(screen.getByPlaceholderText("Jean"), "Luc");
    await user.type(screen.getByPlaceholderText("Dupont"), "Martin");
    await user.type(screen.getByPlaceholderText("jean.dupont@email.com"), "luc.martin@example.com");

    const submit = screen.getByRole("button", { name: /enregistrer|créer|ajouter|valider/i });
    await user.click(submit);

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        job_offer_id: "job-1",
        prenom: "Luc",
        nom: "Martin",
        email: "luc.martin@example.com",
        telephone: "",
        linkedin_url: "",
        portfolio_url: "",
        statut: "new",
        source: "",
        source_detail: "",
        annees_experience: undefined,
        salaire_souhaite: undefined,
        disponibilite: "",
        date_disponibilite: "",
        notes: "",
        assignee_id: "",
      });
      expect(mockDebugError).toHaveBeenCalled();
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("reflète l'état de chargement via les hooks de mutation", () => {
    mockUseCreateCandidate.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    });

    render(
      <CandidateFormDialog
        open
        onOpenChange={vi.fn()}
        defaultJobOfferId="job-1"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Nouveau candidat")).toBeInTheDocument();
    expect(mockUseCreateCandidate).toHaveBeenCalled();
  });
});