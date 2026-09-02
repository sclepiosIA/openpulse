import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EnqueteCES from "./EnqueteCES";

type SupabaseResult = {
  data: { id: string }[] | null;
  error: { message: string } | null;
};

type SupabaseBuilder = {
  select: (value?: string) => SupabaseBuilder;
  eq: (column?: string, value?: unknown) => SupabaseBuilder;
  gte: (column?: string, value?: unknown) => SupabaseBuilder;
  lte: (column?: string, value?: unknown) => SupabaseBuilder;
  in: (column?: string, value?: unknown[]) => SupabaseBuilder;
  order: (column?: string, options?: unknown) => SupabaseBuilder;
  limit: (count?: number) => SupabaseBuilder;
  insert: (value?: unknown) => SupabaseBuilder;
  update: (value?: unknown) => SupabaseBuilder;
  delete: () => SupabaseBuilder;
  upsert: (value?: unknown) => SupabaseBuilder;
  single: () => Promise<SupabaseResult>;
  maybeSingle: () => Promise<SupabaseResult>;
  then: (
    onfulfilled?: (value: SupabaseResult) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
  catch: (onrejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

const {
  CTX_SUCCESS,
  CTX_LOADING,
  CTX_DENIED,
  SUBMIT_IDLE,
  SUBMIT_SUCCESS,
  SUPABASE_RESULT,
  mockFrom,
  mockUseEnqueteContext,
  mockUseSubmitEnquete,
  mockMutateAsync,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => {
  const CTX_SUCCESS = {
    isLoading: false,
    data: {
      success: true,
      user: { nom: "Camille Martin" },
      etablissement: { nom: "Clinique Saint Jean" },
    },
  };

  const CTX_LOADING = {
    isLoading: true,
    data: undefined,
  };

  const CTX_DENIED = {
    isLoading: false,
    data: {
      success: false,
      error: "Lien invalide",
    },
  };

  const mockMutateAsync = vi.fn();

  const SUBMIT_IDLE = {
    mutateAsync: mockMutateAsync,
    isPending: false,
    isSuccess: false,
  };

  const SUBMIT_SUCCESS = {
    mutateAsync: mockMutateAsync,
    isPending: false,
    isSuccess: true,
  };

  const SUPABASE_RESULT = {
    data: [{ id: "1" }],
    error: null,
  };

  const builder: SupabaseBuilder = {
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
    single: vi.fn(() => Promise.resolve(SUPABASE_RESULT)),
    maybeSingle: vi.fn(() => Promise.resolve(SUPABASE_RESULT)),
    then: vi.fn((onfulfilled, onrejected) => Promise.resolve(SUPABASE_RESULT).then(onfulfilled, onrejected)),
    catch: vi.fn((onrejected) => Promise.resolve(SUPABASE_RESULT).catch(onrejected)),
  };

  return {
    CTX_SUCCESS,
    CTX_LOADING,
    CTX_DENIED,
    SUBMIT_IDLE,
    SUBMIT_SUCCESS,
    SUPABASE_RESULT,
    mockFrom: vi.fn(() => builder),
    mockUseEnqueteContext: vi.fn(),
    mockUseSubmitEnquete: vi.fn(),
    mockMutateAsync,
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock("@/hooks/enquetes/useEnquete", () => ({
  useEnqueteContext: mockUseEnqueteContext,
  useSubmitEnquete: mockUseSubmitEnquete,
}));

vi.mock("@/components/enquetes/constants", () => ({
  ENQUETE_LABELS: {
    ces: {
      title: "Enquête CES",
      subtitle: "Votre retour sur OpenPulse",
    },
  },
  FONCTIONS: [
    { value: "medecin", label: "Médecin" },
    { value: "infirmier", label: "Infirmier" },
    { value: "autre", label: "Autre" },
  ],
  DPIS: [
    { value: "osiris", label: "Osiris" },
    { value: "hopital", label: "Hopital Manager" },
    { value: "autre", label: "Autre" },
  ],
  MODULES: [
    { value: "synthese", label: "Synthèse" },
    { value: "codage", label: "Codage" },
  ],
  FORMATION_RECUE: [
    { value: "oui", label: "Oui" },
    { value: "non", label: "Non" },
  ],
}));

vi.mock("@/components/ui/card", async () => {
  const ReactModule = await import("react");

  type ContainerProps = {
    children?: ReactModule.ReactNode;
    className?: string;
  };

  return {
    Card: ({ children, className }: ContainerProps) =>
      ReactModule.createElement("section", { className, "data-testid": "card" }, children),
    CardHeader: ({ children, className }: ContainerProps) =>
      ReactModule.createElement("div", { className }, children),
    CardContent: ({ children, className }: ContainerProps) =>
      ReactModule.createElement("div", { className }, children),
    CardTitle: ({ children, className }: ContainerProps) =>
      ReactModule.createElement("h2", { className }, children),
    CardDescription: ({ children, className }: ContainerProps) =>
      ReactModule.createElement("p", { className }, children),
    CardFooter: ({ children, className }: ContainerProps) =>
      ReactModule.createElement("div", { className }, children),
  };
});

vi.mock("@/components/ui/input", async () => {
  const ReactModule = await import("react");

  const Input = ReactModule.forwardRef<HTMLInputElement, ReactModule.ComponentProps<"input">>((props, ref) =>
    ReactModule.createElement("input", { ...props, ref }),
  );

  Input.displayName = "Input";

  return { Input };
});

vi.mock("@/components/ui/label", async () => {
  const ReactModule = await import("react");

  const Label = ReactModule.forwardRef<HTMLLabelElement, ReactModule.ComponentProps<"label">>(
    ({ children, ...props }, ref) => ReactModule.createElement("label", { ...props, ref }, children),
  );

  Label.displayName = "Label";

  return { Label };
});

vi.mock("@/components/enquetes/EnqueteShell", async () => {
  const ReactModule = await import("react");

  type EnqueteShellProps = {
    title: string;
    subtitle?: string;
    children?: ReactModule.ReactNode;
    onSubmit: (event: ReactModule.FormEvent<HTMLFormElement>) => void | Promise<void>;
    isSubmitting?: boolean;
    isSuccess?: boolean;
    isError?: string | null | false;
    isLoading?: boolean;
  };

  return {
    EnqueteShell: ({
      title,
      subtitle,
      children,
      onSubmit,
      isSubmitting,
      isSuccess,
      isError,
      isLoading,
    }: EnqueteShellProps) =>
      ReactModule.createElement(
        "main",
        null,
        ReactModule.createElement("h1", null, title),
        subtitle ? ReactModule.createElement("p", null, subtitle) : null,
        isLoading ? ReactModule.createElement("div", { role: "status" }, "Chargement") : null,
        isError ? ReactModule.createElement("div", { role: "alert" }, isError) : null,
        isSuccess ? ReactModule.createElement("div", { role: "status" }, "Merci pour votre réponse") : null,
        ReactModule.createElement(
          "form",
          { onSubmit, "aria-label": "formulaire ces" },
          isLoading || isError ? null : children,
          ReactModule.createElement(
            "button",
            { type: "submit", disabled: Boolean(isSubmitting) },
            isSubmitting ? "Envoi" : "Envoyer",
          ),
        ),
      ),
  };
});

vi.mock("@/components/enquetes/fields", async () => {
  const ReactModule = await import("react");

  type Option = {
    value: string;
    label: string;
  };

  type RadioFieldProps = {
    label: string;
    required?: boolean;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    precision?: unknown;
  };

  type CheckboxArrayFieldProps = {
    label: string;
    required?: boolean;
    values: string[];
    onChange: (values: string[]) => void;
    options: Option[];
    allowOther?: boolean;
  };

  type ScaleFieldProps = {
    label: string;
    required?: boolean;
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    minLabel?: string;
    maxLabel?: string;
  };

  type TextFieldProps = {
    label: string;
    required?: boolean;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
    maxLength?: number;
  };

  return {
    RadioField: ({ label, required, value, onChange, options }: RadioFieldProps) =>
      ReactModule.createElement(
        "label",
        null,
        ReactModule.createElement("span", null, `${label}${required ? " *" : ""}`),
        ReactModule.createElement(
          "select",
          {
            "aria-label": label,
            value,
            onChange: (event: ReactModule.ChangeEvent<HTMLSelectElement>) => onChange(event.currentTarget.value),
          },
          ReactModule.createElement("option", { value: "" }, "Choisir"),
          options.map((option) =>
            ReactModule.createElement("option", { key: option.value, value: option.value }, option.label),
          ),
        ),
      ),
    CheckboxArrayField: ({ label, values, onChange, options }: CheckboxArrayFieldProps) =>
      ReactModule.createElement(
        "fieldset",
        null,
        ReactModule.createElement("legend", null, label),
        options.map((option) =>
          ReactModule.createElement(
            "label",
            { key: option.value },
            ReactModule.createElement("input", {
              type: "checkbox",
              "aria-label": `${label} ${option.label}`,
              checked: values.includes(option.value),
              onChange: (event: ReactModule.ChangeEvent<HTMLInputElement>) => {
                if (event.currentTarget.checked) {
                  onChange([...values, option.value]);
                } else {
                  onChange(values.filter((value) => value !== option.value));
                }
              },
            }),
            option.label,
          ),
        ),
      ),
    ScaleField: ({ label, min, max, value, onChange, minLabel, maxLabel }: ScaleFieldProps) =>
      ReactModule.createElement(
        "label",
        null,
        ReactModule.createElement("span", null, label),
        ReactModule.createElement("input", {
          type: "range",
          "aria-label": label,
          min,
          max,
          value,
          onChange: (event: ReactModule.ChangeEvent<HTMLInputElement>) => onChange(Number(event.currentTarget.value)),
        }),
        ReactModule.createElement("span", null, minLabel),
        ReactModule.createElement("span", null, maxLabel),
      ),
    TextField: ({ label, value, onChange, placeholder, multiline, maxLength }: TextFieldProps) =>
      ReactModule.createElement(
        "label",
        null,
        ReactModule.createElement("span", null, label),
        multiline
          ? ReactModule.createElement("textarea", {
              "aria-label": label,
              value,
              placeholder,
              maxLength,
              onChange: (event: ReactModule.ChangeEvent<HTMLTextAreaElement>) => onChange(event.currentTarget.value),
            })
          : ReactModule.createElement("input", {
              "aria-label": label,
              value,
              placeholder,
              maxLength,
              onChange: (event: ReactModule.ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
            }),
      ),
  };
});

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/e/abc"]}>
        <Routes>
          <Route path="/e/:token" element={<EnqueteCES />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EnqueteCES", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue(SUPABASE_RESULT);
    mockUseEnqueteContext.mockReset();
    mockUseSubmitEnquete.mockReset();
    mockUseEnqueteContext.mockReturnValue(CTX_SUCCESS);
    mockUseSubmitEnquete.mockReturnValue(SUBMIT_IDLE);
  });

  it("affiche l'état de chargement transmis au shell", () => {
    mockUseEnqueteContext.mockReturnValue(CTX_LOADING);

    renderWithProviders();

    expect(screen.getByRole("heading", { name: "Enquête CES", level: 1 })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Chargement");
    expect(mockUseEnqueteContext).toHaveBeenCalledWith("abc");
    expect(mockUseSubmitEnquete).toHaveBeenCalledWith("abc", "ces");
  });

  it("affiche les informations de contexte et préremplit le nom en succès", async () => {
    renderWithProviders();

    expect(screen.getByRole("heading", { name: "Enquête CES", level: 1 })).toBeTruthy();
    expect(screen.getByText("Votre retour sur OpenPulse")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vos informations", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Votre prise en main", level: 2 })).toBeTruthy();
    expect(screen.getByText("Clinique Saint Jean")).toBeTruthy();
    expect(await screen.findByDisplayValue("Camille Martin")).toBeTruthy();
  });

  it("affiche l'erreur de contexte quand le lien est refusé", () => {
    mockUseEnqueteContext.mockReturnValue(CTX_DENIED);

    renderWithProviders();

    expect(screen.getByRole("heading", { name: "Enquête CES", level: 1 })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Lien invalide");
    expect(screen.queryByText("Vos informations")).toBeNull();
  });

  it("bloque la soumission si une réponse obligatoire manque", async () => {
    renderWithProviders();
    await screen.findByDisplayValue("Camille Martin");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    });

    expect(mockToastError).toHaveBeenCalledWith("Fonction requise");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("soumet les valeurs métier du formulaire CES", async () => {
    const effortLabel =
      "À combien évaluez-vous l'effort que vous avez dû fournir pour prendre en main et utiliser les fonctionnalités de OpenPulse ?";
    const commentaireLabel =
      "Quels éléments ont facilité ou freiné votre prise en main des fonctionnalités de OpenPulse ?";
    const modulesLabel = "Sur quel(s) module(s) avez-vous été formé ?";

    renderWithProviders();
    await screen.findByDisplayValue("Camille Martin");

    fireEvent.change(screen.getByLabelText("Fonction au sein du service"), { target: { value: "medecin" } });
    fireEvent.change(screen.getByLabelText("Sélectionnez votre DPI"), { target: { value: "osiris" } });
    fireEvent.change(
      screen.getByLabelText("Avez-vous bénéficié d'une formation à l'utilisation de OpenPulse ?"),
      { target: { value: "oui" } },
    );
    fireEvent.click(screen.getByLabelText(`${modulesLabel} Synthèse`));
    fireEvent.change(screen.getByLabelText(effortLabel), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText(commentaireLabel), {
      target: { value: "Formation courte mais utile" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        nom_prenom: "Camille Martin",
        fonction: "medecin",
        fonction_autre: "",
        dpi: "osiris",
        dpi_autre: "",
        formation_recue: "oui",
        modules_formes: ["synthese"],
        effort_score: 7,
        facteurs_freins: "Formation courte mais utile",
      });
    });
  });

  it("transmet l'état de succès de mutation au shell", () => {
    mockUseSubmitEnquete.mockReturnValue(SUBMIT_SUCCESS);

    renderWithProviders();

    expect(screen.getByRole("status").textContent).toBe("Merci pour votre réponse");
  });
});