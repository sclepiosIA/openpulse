// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EnqueteSuiviCSM from "./EnqueteSuiviCSM";

const {
  mockUseParams,
  mockToastError,
  mockMutateAsync,
  mockUseEnqueteContext,
  mockUseSubmitEnquete,
  LABELS,
  FONCTIONS,
  DPIS,
  CSM_CONTRIB,
  CSM_COMPREHENSION,
  CSM_REACTIVITE,
  CSM_UTILITE_COMITES,
  CSM_FREQUENCE,
  SUCCESS_CTX,
  ERROR_CTX,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockToastError: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockUseEnqueteContext: vi.fn(),
  mockUseSubmitEnquete: vi.fn(),
  LABELS: {
    suivi_csm: {
      title: "Enquête suivi CSM",
      subtitle: "Donnez votre avis sur le suivi CSM",
    },
  },
  FONCTIONS: [
    { value: "medecin", label: "Médecin" },
    { value: "autre", label: "Autre" },
  ],
  DPIS: [
    { value: "hopital_manager", label: "Hopital Manager" },
    { value: "autre", label: "Autre" },
  ],
  CSM_CONTRIB: [
    { value: "oui", label: "Oui" },
    { value: "non", label: "Non" },
  ],
  CSM_COMPREHENSION: [
    { value: "bonne", label: "Bonne" },
    { value: "moyenne", label: "Moyenne" },
  ],
  CSM_REACTIVITE: [
    { value: "rapide", label: "Rapide" },
    { value: "lente", label: "Lente" },
  ],
  CSM_UTILITE_COMITES: [
    { value: "utile", label: "Utile" },
    { value: "inutile", label: "Inutile" },
  ],
  CSM_FREQUENCE: [
    { value: "adaptee", label: "Adaptée" },
    { value: "trop_frequente", label: "Trop fréquente" },
  ],
  SUCCESS_CTX: {
    isLoading: false,
    data: {
      success: true,
      user: { nom: "Alice Martin" },
      etablissement: { nom: "Clinique des Tests" },
      csm: { nom: "Camille Suivi" },
    },
  },
  ERROR_CTX: {
    isLoading: false,
    data: {
      success: false,
      error: "Token invalide",
    },
  },
}));

vi.mock("react-router-dom", () => ({
  useParams: mockUseParams,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    maxLength,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    maxLength?: number;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
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
    children?: React.ReactNode;
    onSubmit: (e: React.FormEvent) => void;
    isSubmitting?: boolean;
    isSuccess?: boolean;
    isError?: string | null;
    isLoading?: boolean;
  }) => (
    <form onSubmit={onSubmit}>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div data-testid="loading">{String(Boolean(isLoading))}</div>
      <div data-testid="submitting">{String(Boolean(isSubmitting))}</div>
      <div data-testid="success">{String(Boolean(isSuccess))}</div>
      <div data-testid="error">{isError ?? ""}</div>
      {children}
      <button type="submit">Envoyer</button>
    </form>
  ),
}));

vi.mock("@/components/enquetes/fields", () => ({
  RadioField: ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <div>
      <div>{label}</div>
      <div data-testid={`radio-value-${label}`}>{value}</div>
      {options.map((option) => (
        <button
          key={`${label}-${option.value}`}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {`${label}:${option.label}`}
        </button>
      ))}
    </div>
  ),
  ScaleField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div>
      <div>{label}</div>
      <div data-testid={`scale-value-${label}`}>{String(value)}</div>
      <button type="button" onClick={() => onChange(10)}>
        {`${label}:10`}
      </button>
    </div>
  ),
  TextField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div>
      <label>{label}</label>
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("@/hooks/enquetes/useEnquete", () => ({
  useEnqueteContext: mockUseEnqueteContext,
  useSubmitEnquete: mockUseSubmitEnquete,
}));

vi.mock("@/components/enquetes/constants", () => ({
  ENQUETE_LABELS: LABELS,
  FONCTIONS,
  DPIS,
  CSM_CONTRIB,
  CSM_COMPREHENSION,
  CSM_REACTIVITE,
  CSM_UTILITE_COMITES,
  CSM_FREQUENCE,
}));

describe("EnqueteSuiviCSM", () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ token: "tok1" });
    mockUseEnqueteContext.mockReturnValue(SUCCESS_CTX);
    mockUseSubmitEnquete.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isSuccess: false,
    });
    mockMutateAsync.mockReset();
    mockToastError.mockReset();
  });

  it("affiche les informations de contexte et préremplit le nom depuis l'utilisateur", async () => {
    render(<EnqueteSuiviCSM />);

    expect(screen.getByText("Enquête suivi CSM")).toBeInTheDocument();
    expect(screen.getByText("Donnez votre avis sur le suivi CSM")).toBeInTheDocument();
    expect(screen.getByText("Vos informations")).toBeInTheDocument();
    expect(screen.getByText("Évaluation du suivi CSM")).toBeInTheDocument();
    expect(screen.getByText("Clinique des Tests")).toBeInTheDocument();
    expect(screen.getByText("Camille Suivi")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Alice Martin")).toBeInTheDocument();
    });

    expect(mockUseEnqueteContext).toHaveBeenCalledWith("tok1");
    expect(mockUseSubmitEnquete).toHaveBeenCalledWith("tok1", "suivi_csm");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(
      screen.getByTestId(
        "scale-value-Comment évaluez-vous la qualité du suivi CSM ?",
      ),
    ).toHaveTextContent("8");
  });

  it("soumet le formulaire complet avec les valeurs métier attendues", async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    render(<EnqueteSuiviCSM />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Alice Martin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Fonction:Autre" }));
    fireEvent.change(screen.getByPlaceholderText("Précisez la fonction"), {
      target: { value: "Cadre" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sélectionnez votre DPI:Autre" }));
    fireEvent.change(screen.getByPlaceholderText("Précisez le DPI"), {
      target: { value: "DPI X" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Le suivi réalisé par votre CSM contribue-t-il à une meilleure utilisation de OpenPulse au sein de votre service ?:Oui",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Votre CSM comprend-il les enjeux et les besoins de votre service ?:Bonne",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Votre CSM parvient-il à répondre à vos questions ou à obtenir les réponses dans des délais satisfaisants ?:Rapide",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Les comités de suivi trimestriels sont-ils utiles ?:Utile",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Points forts des comités de suivi et axes d'amélioration identifiés ?"),
      { target: { value: "Comités structurés" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "La fréquence actuelle des comités (trimestrielle) vous semble-t-elle adaptée ?:Adaptée",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Comment évaluez-vous la qualité du suivi CSM ?:10",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Quelles améliorations pourraient être apportées au suivi CSM ?"),
      { target: { value: "Plus de supports écrits" } },
    );

    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      nom_prenom: "Alice Martin",
      fonction: "autre",
      fonction_autre: "Cadre",
      dpi: "autre",
      dpi_autre: "DPI X",
      contribution_usage: "oui",
      comprehension_enjeux: "bonne",
      reactivite: "rapide",
      utilite_comites: "utile",
      points_forts_axes: "Comités structurés",
      frequence_adaptee: "adaptee",
      note_globale: 10,
      ameliorations: "Plus de supports écrits",
    });
  });

  it("bloque la soumission et affiche une erreur toast si un champ requis manque", async () => {
    render(<EnqueteSuiviCSM />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Alice Martin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(mockToastError).toHaveBeenCalledWith("Champ requis : Fonction");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("affiche l'état d'erreur provenant du contexte", () => {
    mockUseEnqueteContext.mockReturnValue(ERROR_CTX);

    render(<EnqueteSuiviCSM />);

    expect(screen.getByTestId("error")).toHaveTextContent("Token invalide");
    expect(screen.queryByText("Clinique des Tests")).not.toBeInTheDocument();
  });

  it("affiche une erreur toast si la mutation échoue", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Soumission impossible"));

    render(<EnqueteSuiviCSM />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Alice Martin")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Fonction:Médecin" }));
    fireEvent.click(screen.getByRole("button", { name: "Sélectionnez votre DPI:Hopital Manager" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Le suivi réalisé par votre CSM contribue-t-il à une meilleure utilisation de OpenPulse au sein de votre service ?:Oui",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Votre CSM comprend-il les enjeux et les besoins de votre service ?:Bonne",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Votre CSM parvient-il à répondre à vos questions ou à obtenir les réponses dans des délais satisfaisants ?:Rapide",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Les comités de suivi trimestriels sont-ils utiles ?:Utile",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "La fréquence actuelle des comités (trimestrielle) vous semble-t-elle adaptée ?:Adaptée",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Soumission impossible");
    });
  });
});