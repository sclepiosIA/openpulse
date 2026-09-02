import "@testing-library/jest-dom/vitest";
import type {
  FormEvent,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import EnqueteSatisfaction from "./EnqueteSatisfaction";

const mocks = vi.hoisted(() => {
  type EnqueteData = {
    success: boolean;
    user?: { nom: string };
    etablissement?: { nom: string };
    error?: string;
  };

  type EnqueteContextValue = {
    data: EnqueteData | undefined;
    isLoading: boolean;
  };

  const TOKEN = "tok-test";
  const USER_NAME = "Alice Martin";
  const ETABLISSEMENT_NAME = "Clinique des Lilas";

  const CTX_LOADING: EnqueteContextValue = {
    data: undefined,
    isLoading: true,
  };

  const CTX_SUCCESS: EnqueteContextValue = {
    data: {
      success: true,
      user: { nom: USER_NAME },
      etablissement: { nom: ETABLISSEMENT_NAME },
    },
    isLoading: false,
  };

  const CTX_ERROR: EnqueteContextValue = {
    data: {
      success: false,
      error: "Lien invalide",
    },
    isLoading: false,
  };

  const SUBMIT_RESULT = { saved: true };
  const mockMutateAsync = vi.fn();

  type SubmitValue = {
    mutateAsync: typeof mockMutateAsync;
    isPending: boolean;
    isSuccess: boolean;
  };

  const SUBMIT_IDLE: SubmitValue = {
    mutateAsync: mockMutateAsync,
    isPending: false,
    isSuccess: false,
  };

  const SUBMIT_PENDING: SubmitValue = {
    mutateAsync: mockMutateAsync,
    isPending: true,
    isSuccess: false,
  };

  let currentContext: EnqueteContextValue = CTX_SUCCESS;
  let currentSubmit: SubmitValue = SUBMIT_IDLE;

  const ENQUETE_LABELS = {
    satisfaction: {
      title: "Enquête de satisfaction",
      subtitle: "Votre retour sur OpenPulse",
    },
  };

  const FONCTIONS = [
    { value: "medecin", label: "Médecin" },
    { value: "ide", label: "IDE" },
    { value: "autre", label: "Autre" },
  ];

  const DPIS = [
    { value: "dpi-one", label: "DPI One" },
    { value: "dpi-two", label: "DPI Two" },
    { value: "autre", label: "Autre" },
  ];

  const MODULES = [
    { value: "transcription", label: "Transcription" },
    { value: "codage", label: "Codage" },
  ];

  const FONCTIONNALITES = [
    { value: "resume", label: "Résumé patient" },
    { value: "aide-cotation", label: "Aide cotation" },
  ];

  const FREQUENCE_USAGE = [
    { value: "quotidien", label: "Tous les jours" },
    { value: "hebdomadaire", label: "Chaque semaine" },
  ];

  const BEAUCOUP_PAS_DU_TOUT = [
    { value: "beaucoup", label: "Beaucoup" },
    { value: "un-peu", label: "Un peu" },
    { value: "pas-du-tout", label: "Pas du tout" },
  ];

  const GAIN_TEMPS = [
    { value: "moins-5", label: "Moins de 5 minutes" },
    { value: "15-min", label: "15 minutes" },
  ];

  return {
    TOKEN,
    USER_NAME,
    ETABLISSEMENT_NAME,
    CTX_LOADING,
    CTX_SUCCESS,
    CTX_ERROR,
    SUBMIT_IDLE,
    SUBMIT_PENDING,
    SUBMIT_RESULT,
    mockMutateAsync,
    mockUseParams: vi.fn(() => ({ token: TOKEN })),
    mockUseEnqueteContext: vi.fn((token: string | undefined) => {
      void token;
      return currentContext;
    }),
    mockUseSubmitEnquete: vi.fn((token: string | undefined, type: string) => {
      void token;
      void type;
      return currentSubmit;
    }),
    setContext: (value: EnqueteContextValue) => {
      currentContext = value;
    },
    setSubmit: (value: SubmitValue) => {
      currentSubmit = value;
    },
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    CONSTANTS: {
      ENQUETE_LABELS,
      FONCTIONS,
      DPIS,
      MODULES,
      FONCTIONNALITES,
      FREQUENCE_USAGE,
      BEAUCOUP_PAS_DU_TOUT,
      GAIN_TEMPS,
    },
  };
});

vi.mock("react-router-dom", () => ({
  useParams: mocks.mockUseParams,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.mockToastSuccess,
    error: mocks.mockToastError,
  },
}));

vi.mock("@/components/ui/card", () => {
  const Card = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <section {...props}>{children}</section>
  );
  const CardHeader = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  );
  const CardContent = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  );
  const CardFooter = ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  );
  const CardTitle = ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  );
  const CardDescription = ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  );

  return { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription };
});

vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("@/components/enquetes/constants", () => mocks.CONSTANTS);

vi.mock("@/hooks/enquetes/useEnquete", () => ({
  useEnqueteContext: mocks.mockUseEnqueteContext,
  useSubmitEnquete: mocks.mockUseSubmitEnquete,
}));

vi.mock("@/components/enquetes/EnqueteShell", () => ({
  EnqueteShell: ({
    title,
    subtitle,
    children,
    onSubmit,
    isSubmitting,
    isSuccess,
    isError,
    isLoading,
  }: {
    title: string;
    subtitle: string;
    children: ReactNode;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
    isSubmitting?: boolean;
    isSuccess?: boolean;
    isError?: string | null;
    isLoading?: boolean;
  }) => (
    <form aria-label="enquete-satisfaction-form" onSubmit={onSubmit}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {isLoading ? <div role="status">Chargement de l'enquête</div> : null}
      {isError ? <div role="alert">{isError}</div> : null}
      {isSuccess ? <div role="status">Réponse enregistrée</div> : null}
      {children}
      <button type="submit" disabled={Boolean(isSubmitting)}>
        {isSubmitting ? "Envoi en cours" : "Envoyer"}
      </button>
    </form>
  ),
}));

vi.mock("@/components/enquetes/fields", () => {
  type Option = { value: string; label: string };

  const RadioField = ({
    label,
    required,
    value,
    onChange,
    options,
  }: {
    label: string;
    required?: boolean;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
  }) => (
    <fieldset>
      <legend>
        {label}
        {required ? " *" : ""}
      </legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={`${label} - ${option.label}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );

  const CheckboxArrayField = ({
    label,
    values,
    onChange,
    options,
    allowOther,
  }: {
    label: string;
    required?: boolean;
    values: string[];
    onChange: (values: string[]) => void;
    options: Option[];
    allowOther?: { value: string; onChange: (value: string) => void };
  }) => (
    <fieldset>
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="checkbox"
            aria-label={`${label} - ${option.label}`}
            checked={values.includes(option.value)}
            onChange={(event) => {
              if (event.currentTarget.checked) {
                onChange([...values, option.value]);
              } else {
                onChange(values.filter((item) => item !== option.value));
              }
            }}
          />
          {option.label}
        </label>
      ))}
      {allowOther ? (
        <input
          aria-label={`${label} - autre précision`}
          value={allowOther.value}
          onChange={(event) => allowOther.onChange(event.currentTarget.value)}
        />
      ) : null}
    </fieldset>
  );

  const ScaleField = ({
    label,
    min,
    max,
    value,
    onChange,
    minLabel,
    maxLabel,
  }: {
    label: string;
    required?: boolean;
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    minLabel?: string;
    maxLabel?: string;
  }) => (
    <label>
      {label}
      <span>{minLabel}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span>{maxLabel}</span>
    </label>
  );

  const TextField = ({
    label,
    value,
    onChange,
    multiline,
  }: {
    label: string;
    required?: boolean;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
    maxLength?: number;
  }) =>
    multiline ? (
      <textarea
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    ) : (
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );

  return { RadioField, CheckboxArrayField, ScaleField, TextField };
});

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EnqueteSatisfaction />
    </QueryClientProvider>,
  );
}

async function fillRequiredFields() {
  await waitFor(() => {
    expect(screen.getByDisplayValue(mocks.USER_NAME)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Fonction - Médecin" }));
  fireEvent.click(screen.getByRole("button", { name: "Sélectionnez votre DPI - DPI One" }));
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Quel(s) module(s) utilisez-vous ? - Transcription" }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "À quelle fréquence utilisez-vous OpenPulse ? - Tous les jours",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Dans quelle mesure OpenPulse vous permet-il de réduire le temps consacré aux tâches administratives et de saisie ? - Beaucoup",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Dans quelle mesure OpenPulse vous aide-t-il dans l'identification et l'optimisation des cotations ? - Beaucoup",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Quel gain de temps estimez-vous réaliser par patient ? - 15 minutes",
    }),
  );
}

describe("EnqueteSatisfaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockMutateAsync.mockReset();
    mocks.mockMutateAsync.mockResolvedValue(mocks.SUBMIT_RESULT);
    mocks.mockUseParams.mockReturnValue({ token: mocks.TOKEN });
    mocks.setContext(mocks.CTX_SUCCESS);
    mocks.setSubmit(mocks.SUBMIT_IDLE);
  });

  it("affiche l'état de chargement transmis au shell", () => {
    mocks.setContext(mocks.CTX_LOADING);

    renderComponent();

    expect(screen.getByRole("heading", { level: 1, name: "Enquête de satisfaction" })).toBeInTheDocument();
    expect(screen.getByText("Votre retour sur OpenPulse")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de l'enquête");
    expect(mocks.mockUseEnqueteContext).toHaveBeenCalledWith(mocks.TOKEN);
    expect(mocks.mockUseSubmitEnquete).toHaveBeenCalledWith(mocks.TOKEN, "satisfaction");
  });

  it("préremplit le nom et affiche les informations métier de l'enquête", async () => {
    renderComponent();

    expect(screen.getByRole("heading", { level: 2, name: "Vos informations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Votre utilisation de OpenPulse" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Satisfaction & recommandation" })).toBeInTheDocument();
    expect(screen.getByText("Établissement :")).toBeInTheDocument();
    expect(screen.getByText(mocks.ETABLISSEMENT_NAME)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue(mocks.USER_NAME)).toBeInTheDocument();
    });
  });

  it("affiche l'erreur fonctionnelle du contexte d'enquête", () => {
    mocks.setContext(mocks.CTX_ERROR);

    renderComponent();

    expect(screen.getByRole("alert")).toHaveTextContent("Lien invalide");
    expect(screen.getByText("Nom et prénom")).toBeInTheDocument();
  });

  it("bloque la soumission et affiche le premier champ requis manquant", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue(mocks.USER_NAME)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "enquete-satisfaction-form" }));
    });

    expect(mocks.mockToastError).toHaveBeenCalledWith("Champ requis : Fonction");
    expect(mocks.mockMutateAsync).not.toHaveBeenCalled();
  });

  it("soumet les réponses complètes avec les valeurs métier attendues", async () => {
    renderComponent();

    await fillRequiredFields();

    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "enquete-satisfaction-form" }));
    });

    await waitFor(() => {
      expect(mocks.mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mocks.mockMutateAsync).toHaveBeenCalledWith({
      nom_prenom: mocks.USER_NAME,
      fonction: "medecin",
      fonction_autre: "",
      dpi: "dpi-one",
      dpi_autre: "",
      modules_utilises: ["transcription"],
      frequence_usage: "quotidien",
      reduction_temps_admin: "beaucoup",
      aide_cotation: "beaucoup",
      gain_temps_estime: "15-min",
      fonctionnalites_principales: [],
      fonctionnalites_autre: "",
      fonctionnalites_non_utilisees: "",
      satisfaction_globale: 8,
      nps_score: 8,
      points_forts: "",
      ameliorations: "",
    });
    expect(mocks.mockToastError).not.toHaveBeenCalled();
  });

  it("affiche une erreur toast quand la mutation échoue", async () => {
    mocks.mockMutateAsync.mockRejectedValue(new Error("Envoi impossible"));

    renderComponent();

    await fillRequiredFields();

    await act(async () => {
      fireEvent.submit(screen.getByRole("form", { name: "enquete-satisfaction-form" }));
    });

    await waitFor(() => {
      expect(mocks.mockToastError).toHaveBeenCalledWith("Envoi impossible");
    });
  });

  it("désactive le bouton d'envoi pendant une soumission en cours", () => {
    mocks.setSubmit(mocks.SUBMIT_PENDING);

    renderComponent();

    expect(screen.getByRole("button", { name: "Envoi en cours" })).toBeDisabled();
  });
});