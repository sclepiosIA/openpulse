/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { EtablissementInfo } from "./EtablissementInfo";

const {
  ETABLISSEMENT,
  SUCCESS_RESULT,
  ERROR_RESULT,
  mockFrom,
  mockUpdate,
  mockEq,
  mockSelect,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
  toastSuccess,
  toastError,
  invalidateQueries,
  detailKeyMock,
} = vi.hoisted(() => {
  const SUCCESS_RESULT_LOCAL = { data: [{ id: "ok" }], error: null };
  const ERROR_RESULT_LOCAL = { data: null, error: { message: "x" } };

  const mockEqLocal = vi.fn();
  const mockSelectLocal = vi.fn();
  const mockGteLocal = vi.fn();
  const mockLteLocal = vi.fn();
  const mockInLocal = vi.fn();
  const mockOrderLocal = vi.fn();
  const mockLimitLocal = vi.fn();
  const mockInsertLocal = vi.fn();
  const mockUpdateLocal = vi.fn();
  const mockDeleteLocal = vi.fn();
  const mockSingleLocal = vi.fn();
  const mockMaybeSingleLocal = vi.fn();
  const mockThenLocal = vi.fn();
  const mockCatchLocal = vi.fn();
  const mockFromLocal = vi.fn();

  const builder = {
    select: mockSelectLocal,
    eq: mockEqLocal,
    gte: mockGteLocal,
    lte: mockLteLocal,
    in: mockInLocal,
    order: mockOrderLocal,
    limit: mockLimitLocal,
    insert: mockInsertLocal,
    update: mockUpdateLocal,
    delete: mockDeleteLocal,
    single: mockSingleLocal,
    maybeSingle: mockMaybeSingleLocal,
    then: mockThenLocal,
    catch: mockCatchLocal,
  };

  mockSelectLocal.mockImplementation(() => builder);
  mockGteLocal.mockImplementation(() => builder);
  mockLteLocal.mockImplementation(() => builder);
  mockInLocal.mockImplementation(() => builder);
  mockOrderLocal.mockImplementation(() => builder);
  mockLimitLocal.mockImplementation(() => builder);
  mockInsertLocal.mockImplementation(() => builder);
  mockDeleteLocal.mockImplementation(() => builder);
  mockUpdateLocal.mockImplementation(() => builder);
  mockEqLocal.mockResolvedValue(SUCCESS_RESULT_LOCAL);
  mockSingleLocal.mockResolvedValue(SUCCESS_RESULT_LOCAL);
  mockMaybeSingleLocal.mockResolvedValue(SUCCESS_RESULT_LOCAL);
  mockThenLocal.mockImplementation((resolve: (value: unknown) => unknown) => Promise.resolve(resolve(SUCCESS_RESULT_LOCAL)));
  mockCatchLocal.mockImplementation(() => Promise.resolve(SUCCESS_RESULT_LOCAL));
  mockFromLocal.mockImplementation(() => builder);

  return {
    ETABLISSEMENT: {
      id: "eta-1",
      nom: "Clinique Test",
      type: "Clinique",
      statut: "Production",
      adresse: "1 rue des Tests",
      code_postal: "75001",
      ville: "Paris",
      region: "Ile-de-France",
      telephone: "0102030405",
      email: "contact@test.fr",
      date_signature: "2024-01-10",
      date_previsionnelle_signature: "2024-02-15",
      date_go_live: "2024-03-20",
      notes: "Note initiale",
      type_offre: undefined,
      pallier_vise: undefined,
      pallier_realise: undefined,
      date_fin_contrat: undefined,
      nombre_passages_urgences_annuel: 12345,
      dpi: "ORBIS",
      directeur_general_nom: "Dupont",
      directeur_general_prenom: "Jean",
      directeur_general_email: "dg@test.fr",
      siren_client: "123456789",
      modele_statique_succes: undefined,
      modules_proposes: [],
      seuils_palliers: undefined,
      tarifs_palliers: {},
    },
    SUCCESS_RESULT: SUCCESS_RESULT_LOCAL,
    ERROR_RESULT: ERROR_RESULT_LOCAL,
    mockFrom: mockFromLocal,
    mockUpdate: mockUpdateLocal,
    mockEq: mockEqLocal,
    mockSelect: mockSelectLocal,
    mockGte: mockGteLocal,
    mockLte: mockLteLocal,
    mockIn: mockInLocal,
    mockOrder: mockOrderLocal,
    mockLimit: mockLimitLocal,
    mockInsert: mockInsertLocal,
    mockDelete: mockDeleteLocal,
    mockSingle: mockSingleLocal,
    mockMaybeSingle: mockMaybeSingleLocal,
    mockThen: mockThenLocal,
    mockCatch: mockCatchLocal,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    invalidateQueries: vi.fn(),
    detailKeyMock: vi.fn((id: string) => ["etablissements", "detail", id]),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/hooks/crm/useEtablissements", () => ({
  etablissementKeys: {
    detail: detailKeyMock,
  },
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: vi.fn((value: number) => `${value} €`),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({
      invalidateQueries,
    })),
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    defaultValue,
    onBlur,
    placeholder,
    type,
    disabled,
    className,
  }: {
    defaultValue?: string | number;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <input
      defaultValue={defaultValue}
      onBlur={onBlur}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    defaultValue,
    onBlur,
    placeholder,
    disabled,
  }: {
    defaultValue?: string;
    onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    disabled?: boolean;
  }) => <textarea defaultValue={defaultValue} onBlur={onBlur} placeholder={placeholder} disabled={disabled} />,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string;
    onValueChange?: (value: string) => void | Promise<void>;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <select
      aria-label={`select-${value ?? "empty"}`}
      value={value}
      onChange={(e) => {
        void onValueChange?.(e.target.value);
      }}
      disabled={disabled}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ children, placeholder }: { children?: React.ReactNode; placeholder?: string }) => <>{children ?? placeholder}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));

vi.mock("@/components/ui/date-picker-input", () => ({
  DatePickerWithInput: ({
    value,
    onChange,
    disabled,
  }: {
    value: string | null;
    onChange: (date: string | null) => void;
    disabled?: boolean;
  }) => (
    <input
      aria-label={`date-${value ?? "empty"}`}
      defaultValue={value ?? ""}
      disabled={disabled}
      onBlur={(e) => onChange(e.target.value || null)}
    />
  ),
}));

vi.mock("@/components/simulator", () => ({
  SimulatorSection: () => <div>SimulatorSection</div>,
}));

vi.mock("@/components/cti/CallButton", () => ({
  CallButton: ({ phoneNumber }: { phoneNumber: string }) => <button type="button">Appeler {phoneNumber}</button>,
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

describe("EtablissementInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => ({
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
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      then: mockThen,
      catch: mockCatch,
    }));
    mockUpdate.mockImplementation(() => ({
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
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      then: mockThen,
      catch: mockCatch,
    }));
    mockEq.mockResolvedValue(SUCCESS_RESULT);
    detailKeyMock.mockImplementation((id: string) => ["etablissements", "detail", id]);
  });

  it("utilise un wrapper QueryClientProvider valide avec renderHook", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 42, { wrapper });
    expect(result.current).toBe(42);
  });

  it("affiche les informations métier réelles et les éléments conditionnels", () => {
    render(<EtablissementInfo etablissement={ETABLISSEMENT} />, { wrapper: createWrapper() });

    expect(screen.getByText("Informations générales")).toBeInTheDocument();
    expect(screen.getByText("Informations contractuelles")).toBeInTheDocument();
    expect(screen.getAllByText("Clinique")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Production")[0]).toBeInTheDocument();
    expect(screen.getByText(/1 rue des Tests/)).toBeInTheDocument();
    expect(screen.getByText(/75001 Paris/)).toBeInTheDocument();
    expect(screen.getByText(/Ile-de-France/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("0102030405")).toBeInTheDocument();
    expect(screen.getByDisplayValue("contact@test.fr")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12345")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123456789")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Note initiale")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Appeler 0102030405/ })).toBeInTheDocument();
    expect(screen.getByLabelText("date-2024-03-20")).toBeInTheDocument();
    expect(screen.getByText("SimulatorSection")).toBeInTheDocument();
  });

  it("gère un état de chargement logique puis un succès lors de la mise à jour du téléphone", async () => {
    let resolveEq: ((value: unknown) => void) | null = null;
    mockEq.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEq = resolve;
        }),
    );

    render(<EtablissementInfo etablissement={ETABLISSEMENT} />, { wrapper: createWrapper() });

    const phoneInput = screen.getByDisplayValue("0102030405");
    fireEvent.change(phoneInput, { target: { value: "0607080910" } });
    fireEvent.blur(phoneInput);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("etablissements");
      expect(mockUpdate).toHaveBeenCalledWith({ telephone: "0607080910" });
      expect(mockEq).toHaveBeenCalledWith("id", "eta-1");
    });

    const emailInput = screen.getByDisplayValue("contact@test.fr");
    expect(emailInput).toBeDisabled();

    await act(async () => {
      if (resolveEq) {
        resolveEq(SUCCESS_RESULT);
      }
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Mis à jour avec succès");
      expect(detailKeyMock).toHaveBeenCalledWith("eta-1");
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["etablissements", "detail", "eta-1"] });
    });
  });

  it("affiche une erreur lors de l'échec de la mise à jour d'un champ", async () => {
    mockEq.mockResolvedValue(ERROR_RESULT);

    render(<EtablissementInfo etablissement={ETABLISSEMENT} />, { wrapper: createWrapper() });

    const emailInput = screen.getByDisplayValue("contact@test.fr");
    fireEvent.change(emailInput, { target: { value: "new@test.fr" } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ email: "new@test.fr" });
      expect(mockEq).toHaveBeenCalledWith("id", "eta-1");
      expect(toastError).toHaveBeenCalledWith("Erreur lors de la mise à jour");
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("met à jour le statut avec succès et invalide la query de détail", async () => {
    render(<EtablissementInfo etablissement={ETABLISSEMENT} />, { wrapper: createWrapper() });

    const statusSelect = screen.getByLabelText("select-Production");
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: "Formation" } });
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ statut: "Formation" });
      expect(mockEq).toHaveBeenCalledWith("id", "eta-1");
      expect(toastSuccess).toHaveBeenCalledWith("Statut mis à jour");
      expect(detailKeyMock).toHaveBeenCalledWith("eta-1");
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["etablissements", "detail", "eta-1"] });
    });
  });

  it("affiche une erreur si la mise à jour du statut échoue", async () => {
    mockEq.mockResolvedValue(ERROR_RESULT);

    render(<EtablissementInfo etablissement={ETABLISSEMENT} />, { wrapper: createWrapper() });

    const statusSelect = screen.getByLabelText("select-Production");
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: "Conformité" } });
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ statut: "Conformité" });
      expect(toastError).toHaveBeenCalledWith("Erreur lors de la mise à jour du statut");
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("met à jour une date via le DatePicker", async () => {
    render(<EtablissementInfo etablissement={ETABLISSEMENT} />, { wrapper: createWrapper() });

    const dateInput = screen.getByLabelText("date-2024-01-10");
    fireEvent.change(dateInput, { target: { value: "2024-04-01" } });
    fireEvent.blur(dateInput);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ date_signature: "2024-04-01" });
      expect(mockEq).toHaveBeenCalledWith("id", "eta-1");
      expect(toastSuccess).toHaveBeenCalledWith("Mis à jour avec succès");
    });
  });

  it("met à jour le nombre de passages annuel en entier", async () => {
    render(<EtablissementInfo etablissement={ETABLISSEMENT} />, { wrapper: createWrapper() });

    const numberInput = screen.getByDisplayValue("12345");
    fireEvent.change(numberInput, { target: { value: "15000" } });
    fireEvent.blur(numberInput);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ nombre_passages_urgences_annuel: 15000 });
      expect(mockEq).toHaveBeenCalledWith("id", "eta-1");
    });
  });
});