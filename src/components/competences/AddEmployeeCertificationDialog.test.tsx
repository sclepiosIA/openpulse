import React from "react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  PROFILES,
  CERTIFICATIONS,
  SUPABASE_PROFILES_SUCCESS,
  SUPABASE_PROFILES_ERROR,
  MUTATION_SUCCESS,
  hookState,
  queryState,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockMutateAsync,
  mockOnOpenChange,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => {
  const PROFILES = [
    { id: "profile-1", prenom: "Ada", nom: "Lovelace" },
    { id: "profile-2", prenom: "Grace", nom: "Hopper" },
  ];

  const CERTIFICATIONS = [
    { id: "cert-1", nom: "SST", organisme: "INRS" },
    { id: "cert-2", nom: "CACES R489", organisme: null },
  ];

  const EMPTY_CERTIFICATIONS: typeof CERTIFICATIONS = [];
  const SUPABASE_ERROR = { message: "x" };
  const SUPABASE_PROFILES_SUCCESS = { data: PROFILES, error: null };
  const SUPABASE_PROFILES_ERROR = { data: null, error: SUPABASE_ERROR };
  const SINGLE_SUCCESS = { data: null, error: null };
  const MUTATION_SUCCESS = { id: "employee-cert-1" };

  type QueryResult = typeof SUPABASE_PROFILES_SUCCESS | typeof SUPABASE_PROFILES_ERROR;
  type SingleResult = typeof SINGLE_SUCCESS;

  interface Builder {
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
    neq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    gt: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
    overlaps: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
    catch: (onRejected: (reason: unknown) => unknown) => Promise<unknown>;
  }

  const hookState: {
    referentielMode: "success" | "loading" | "error";
    isPending: boolean;
  } = {
    referentielMode: "success",
    isPending: false,
  };

  const queryState: {
    result: QueryResult;
    singleResult: SingleResult;
  } = {
    result: SUPABASE_PROFILES_SUCCESS,
    singleResult: SINGLE_SUCCESS,
  };

  const mockMutateAsync = vi.fn();
  const mockOnOpenChange = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();

  const ADD_CERTIFICATION = {
    mutateAsync: mockMutateAsync,
    isPending: false,
  };

  const EMPLOYEE_CERTIFICATIONS_RESULT = {
    addCertification: ADD_CERTIFICATION,
  };

  const REFERENTIEL_SUCCESS = {
    certifications: CERTIFICATIONS,
    isLoading: false,
    isError: false,
  };

  const REFERENTIEL_LOADING = {
    certifications: CERTIFICATIONS,
    isLoading: true,
    isError: false,
  };

  const REFERENTIEL_ERROR = {
    certifications: EMPTY_CERTIFICATIONS,
    isLoading: false,
    isError: true,
  };

  let builder: Builder;

  const mockSelect = vi.fn(() => builder);
  const mockEq = vi.fn(() => builder);
  const mockGte = vi.fn(() => builder);
  const mockLte = vi.fn(() => builder);
  const mockIn = vi.fn(() => builder);
  const mockOrder = vi.fn(() => builder);
  const mockLimit = vi.fn(() => builder);
  const mockInsert = vi.fn(() => builder);
  const mockUpdate = vi.fn(() => builder);
  const mockDelete = vi.fn(() => builder);
  const mockNeq = vi.fn(() => builder);
  const mockIs = vi.fn(() => builder);
  const mockLt = vi.fn(() => builder);
  const mockGt = vi.fn(() => builder);
  const mockRange = vi.fn(() => builder);
  const mockMatch = vi.fn(() => builder);
  const mockContains = vi.fn(() => builder);
  const mockOverlaps = vi.fn(() => builder);
  const mockOr = vi.fn(() => builder);
  const mockIlike = vi.fn(() => builder);
  const mockSingle = vi.fn(async () => queryState.singleResult);
  const mockMaybeSingle = vi.fn(async () => queryState.singleResult);

  builder = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    neq: mockNeq,
    is: mockIs,
    lt: mockLt,
    gt: mockGt,
    range: mockRange,
    match: mockMatch,
    contains: mockContains,
    overlaps: mockOverlaps,
    or: mockOr,
    ilike: mockIlike,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: (onFulfilled) => Promise.resolve(onFulfilled(queryState.result)),
    catch: () => Promise.resolve(builder),
  };

  const mockFrom = vi.fn(() => builder);

  return {
    PROFILES,
    CERTIFICATIONS,
    SUPABASE_PROFILES_SUCCESS,
    SUPABASE_PROFILES_ERROR,
    MUTATION_SUCCESS,
    hookState,
    queryState,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockMutateAsync,
    mockOnOpenChange,
    mockToastSuccess,
    mockToastError,
    EMPLOYEE_CERTIFICATIONS_RESULT,
    REFERENTIEL_SUCCESS,
    REFERENTIEL_LOADING,
    REFERENTIEL_ERROR,
    ADD_CERTIFICATION,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/hooks/hr/useEmployeeCertifications", () => ({
  useReferentielCertifications: vi.fn(() => {
    if (hookState.referentielMode === "loading") {
      return {
        certifications: CERTIFICATIONS,
        isLoading: true,
        isError: false,
      };
    }

    if (hookState.referentielMode === "error") {
      return {
        certifications: [],
        isLoading: false,
        isError: true,
      };
    }

    return {
      certifications: CERTIFICATIONS,
      isLoading: false,
      isError: false,
    };
  }),
  useEmployeeCertifications: vi.fn(() => ({
    addCertification: {
      mutateAsync: mockMutateAsync,
      isPending: hookState.isPending,
    },
  })),
}));

vi.mock("@/components/ui/dialog", async () => {
  const ReactModule = await import("react");

  type DialogProps = ReactModule.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>;

  type DivProps = ReactModule.HTMLAttributes<HTMLDivElement>;
  type HeadingProps = ReactModule.HTMLAttributes<HTMLHeadingElement>;
  type ParagraphProps = ReactModule.HTMLAttributes<HTMLParagraphElement>;

  return {
    Dialog: ({ open = true, children }: DialogProps) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogContent: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogHeader: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogTitle: ({ children, ...props }: HeadingProps) => <h2 {...props}>{children}</h2>,
    DialogDescription: ({ children, ...props }: ParagraphProps) => <p {...props}>{children}</p>,
    DialogFooter: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogPortal: ({ children }: ReactModule.PropsWithChildren) => <>{children}</>,
    DialogOverlay: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogClose: ({ children, ...props }: ReactModule.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    DialogTrigger: ({ children, ...props }: ReactModule.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/ui/button", async () => {
  const ReactModule = await import("react");

  type ButtonProps = ReactModule.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    asChild?: boolean;
  };

  const Button = ReactModule.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant: _variant, asChild: _asChild, type = "button", ...props }, ref) => (
      <button ref={ref} type={type} {...props} />
    ),
  );

  Button.displayName = "Button";

  return {
    Button,
    buttonVariants: vi.fn(() => ""),
  };
});

vi.mock("@/components/ui/input", async () => {
  const ReactModule = await import("react");

  const Input = ReactModule.forwardRef<HTMLInputElement, ReactModule.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />,
  );

  Input.displayName = "Input";

  return { Input };
});

vi.mock("@/components/ui/label", async () => {
  const ReactModule = await import("react");

  const Label = ReactModule.forwardRef<HTMLLabelElement, ReactModule.LabelHTMLAttributes<HTMLLabelElement>>(
    (props, ref) => <label ref={ref} {...props} />,
  );

  Label.displayName = "Label";

  return { Label };
});

vi.mock("@/components/ui/select", async () => {
  const ReactModule = await import("react");

  type SelectContextValue = {
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
  };

  const SelectContext = ReactModule.createContext<SelectContextValue>({
    value: "",
    onValueChange: () => undefined,
    disabled: false,
  });

  type SelectProps = ReactModule.PropsWithChildren<{
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
  }>;

  type TriggerProps = ReactModule.HTMLAttributes<HTMLDivElement> & {
    id?: string;
  };

  type SelectValueProps = {
    placeholder?: string;
  };

  type SelectItemProps = ReactModule.PropsWithChildren<{
    value: string;
  }>;

  const Select = ({ value = "", onValueChange = () => undefined, disabled = false, children }: SelectProps) => (
    <SelectContext.Provider value={{ value, onValueChange, disabled }}>
      <div data-testid="select-root" data-disabled={disabled ? "true" : "false"}>
        {children}
      </div>
    </SelectContext.Provider>
  );

  const SelectTrigger = ({ id, children, ...props }: TriggerProps) => (
    <div id={id} data-testid={id ? `select-trigger-${id}` : "select-trigger"} {...props}>
      {children}
    </div>
  );

  const SelectValue = ({ placeholder }: SelectValueProps) => {
    const context = ReactModule.useContext(SelectContext);
    return <span>{context.value || placeholder}</span>;
  };

  const SelectContent = ({ children }: ReactModule.PropsWithChildren) => <div>{children}</div>;

  const SelectItem = ({ value, children }: SelectItemProps) => {
    const context = ReactModule.useContext(SelectContext);

    return (
      <button
        type="button"
        role="option"
        aria-selected={context.value === value}
        disabled={context.disabled}
        onClick={() => context.onValueChange(value)}
      >
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
    SelectGroup: ({ children }: ReactModule.PropsWithChildren) => <div>{children}</div>,
    SelectLabel: ({ children }: ReactModule.PropsWithChildren) => <div>{children}</div>,
    SelectSeparator: () => <hr />,
    SelectScrollUpButton: ({ children }: ReactModule.PropsWithChildren) => <div>{children}</div>,
    SelectScrollDownButton: ({ children }: ReactModule.PropsWithChildren) => <div>{children}</div>,
  };
});

import AddEmployeeCertificationDialog from "./AddEmployeeCertificationDialog";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AddEmployeeCertificationDialog", () => {
  beforeEach(() => {
    hookState.referentielMode = "success";
    hookState.isPending = false;
    queryState.result = SUPABASE_PROFILES_SUCCESS;

    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockOrder.mockClear();
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue(MUTATION_SUCCESS);
    mockOnOpenChange.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche l'état de chargement du référentiel et désactive le choix de certification", async () => {
    hookState.referentielMode = "loading";

    renderWithClient(<AddEmployeeCertificationDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Ajouter une certification")).toBeInTheDocument();
    expect(
      screen.getByText("Associez une certification du référentiel à un employé actif."),
    ).toBeInTheDocument();
    expect(screen.getByText("Chargement...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "SST — INRS" })).toBeDisabled();

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith("profiles"));
    expect(mockSelect).toHaveBeenCalledWith("id, nom, prenom");
    expect(mockEq).toHaveBeenCalledWith("actif", true);
    expect(mockOrder).toHaveBeenCalledWith("nom");
  });

  it("charge les employés actifs et ajoute une certification avec les valeurs saisies", async () => {
    renderWithClient(<AddEmployeeCertificationDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(await screen.findByRole("option", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "SST — INRS" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "CACES R489" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Ada Lovelace" }));
    fireEvent.click(screen.getByRole("option", { name: "SST — INRS" }));
    fireEvent.change(screen.getByLabelText("Date d'obtention"), {
      target: { value: "2026-06-18" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      profile_id: PROFILES[0].id,
      certification_id: CERTIFICATIONS[0].id,
      date_obtention: "2026-06-18",
    });
    expect(mockOnOpenChange).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("ne ferme pas le dialogue quand la mutation d'ajout échoue", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("x"));

    renderWithClient(<AddEmployeeCertificationDialog open={true} onOpenChange={mockOnOpenChange} />);

    expect(await screen.findByRole("option", { name: "Ada Lovelace" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Ada Lovelace" }));
    fireEvent.click(screen.getByRole("option", { name: "SST — INRS" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      profile_id: "profile-1",
      certification_id: "cert-1",
      date_obtention: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("ignore les employés quand Supabase renvoie une erreur de chargement", async () => {
    queryState.result = SUPABASE_PROFILES_ERROR;

    renderWithClient(<AddEmployeeCertificationDialog open={true} onOpenChange={mockOnOpenChange} />);

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith("profiles"));

    expect(mockSelect).toHaveBeenCalledWith("id, nom, prenom");
    expect(mockEq).toHaveBeenCalledWith("actif", true);
    expect(mockOrder).toHaveBeenCalledWith("nom");
    expect(screen.queryByRole("option", { name: "Ada Lovelace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Grace Hopper" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "SST — INRS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeDisabled();
  });
});