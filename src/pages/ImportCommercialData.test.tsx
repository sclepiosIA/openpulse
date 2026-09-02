/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ImportCommercialData from "./ImportCommercialData";

const {
  PAYLOAD,
  SUCCESS_REPORT,
  WARNING_REPORT,
  mockNavigate,
  mockInvoke,
  toastSuccess,
  toastWarning,
  toastError,
  progressState,
  startMock,
  completeMock,
  failMock,
} = vi.hoisted(() => {
  const PAYLOAD = {
    etablissements: [
      {
        id: "e1",
        region: "Île-de-France",
        contacts: [{ email: "a@b.co" }, { email: "c@d.co" }],
      },
      {
        id: "e2",
        region: "Occitanie",
        contacts: [{ email: "e@f.co" }],
      },
      {
        id: "e3",
        region: "Île-de-France",
        contacts: [],
      },
    ],
    partenaires: [
      {
        id: "p1",
        contacts: [{ email: "p1@x.co" }, { email: "p2@x.co" }],
      },
      {
        id: "p2",
        contacts: [],
      },
    ],
  };

  const SUCCESS_REPORT = {
    etablissements_created: 2,
    etablissements_updated: 1,
    contacts_created: 3,
    contacts_skipped: 1,
    taches_created: 5,
    partenaires_created: 2,
    partenaires_contacts_created: 2,
    errors: [],
  };

  const WARNING_REPORT = {
    etablissements_created: 1,
    etablissements_updated: 0,
    contacts_created: 2,
    contacts_skipped: 0,
    taches_created: 5,
    partenaires_created: 1,
    partenaires_contacts_created: 1,
    errors: ["Contact sans email", "Région inconnue"],
  };

  const mockNavigate = vi.fn();
  const mockInvoke = vi.fn();

  const toastSuccess = vi.fn();
  const toastWarning = vi.fn();
  const toastError = vi.fn();

  const progressState = {
    status: "idle",
    progress: 0,
    message: "",
  };

  const startMock = vi.fn((message: string) => {
    progressState.status = "loading";
    progressState.message = message;
  });
  const completeMock = vi.fn(() => {
    progressState.status = "success";
  });
  const failMock = vi.fn((message: string) => {
    progressState.status = "error";
    progressState.message = message;
  });

  return {
    PAYLOAD,
    SUCCESS_REPORT,
    WARNING_REPORT,
    mockNavigate,
    mockInvoke,
    toastSuccess,
    toastWarning,
    toastError,
    progressState,
    startMock,
    completeMock,
    failMock,
  };
});

vi.mock("@/data/commercial-import-payload", () => ({
  commercialImportPayload: PAYLOAD,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    warning: toastWarning,
    error: toastError,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    ArrowLeft: Icon,
    Upload: Icon,
    CheckCircle2: Icon,
    AlertTriangle: Icon,
    Building2: Icon,
    Users: Icon,
    ListTodo: Icon,
    Handshake: Icon,
  };
});

vi.mock("@/components/shared/ActionProgress", () => ({
  ActionProgress: ({
    status,
    progress,
    message,
    successMessage,
    errorMessage,
  }: {
    status: string;
    progress: number;
    message: string;
    successMessage: string;
    errorMessage: string;
  }) => (
    <div data-testid="action-progress">
      <span>{status}</span>
      <span>{String(progress)}</span>
      <span>{message}</span>
      <span>{successMessage}</span>
      <span>{errorMessage}</span>
    </div>
  ),
  useActionProgress: () => ({
    status: progressState.status,
    progress: progressState.progress,
    message: progressState.message,
    start: startMock,
    complete: completeMock,
    fail: failMock,
  }),
}));

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ImportCommercialData />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function getStatCount(labelText: string) {
  const labelEl = screen.getByText(labelText);
  const container = labelEl.parentElement;
  if (!container) throw new Error("Container not found for label: " + labelText);
  const pEls = container.querySelectorAll("p");
  if (pEls.length === 0) throw new Error("No <p> elements in container for: " + labelText);
  return pEls[0].textContent;
}

function getReportCount(labelText: string) {
  const labelEl = screen.getByText(labelText);
  const container = labelEl.parentElement;
  if (!container) throw new Error("Container not found for report label: " + labelText);
  const pEls = container.querySelectorAll("p");
  if (pEls.length === 0) throw new Error("No <p> elements in report container for: " + labelText);
  return pEls[0].textContent;
}

describe("ImportCommercialData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressState.status = "idle";
    progressState.progress = 0;
    progressState.message = "";
  });

  it("affiche les statistiques calculées depuis le payload et la répartition par région", () => {
    renderComponent();

    expect(screen.getByText("Import des données commerciales")).toBeInTheDocument();

    expect(getStatCount("Établissements")).toBe(String(PAYLOAD.etablissements.length));
    expect(getStatCount("Contacts")).toBe("3");
    expect(getStatCount("Tâches")).toBe(String(PAYLOAD.etablissements.length + PAYLOAD.partenaires.length));
    expect(getStatCount("Partenaires")).toBe(String(PAYLOAD.partenaires.length));

    expect(screen.getByText("Île-de-France: 2")).toBeInTheDocument();
    expect(screen.getByText("Occitanie: 1")).toBeInTheDocument();
    expect(screen.getByText("Lancer l'import")).toBeInTheDocument();
  });

  it("importe avec succès, affiche le rapport et notifie en succès", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { report: SUCCESS_REPORT },
      error: null,
    });

    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: "Lancer l'import" }));

    expect(startMock).toHaveBeenCalledWith("Importation des données commerciales en cours...");

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("import-commercial-data", {
        body: {
          etablissements: PAYLOAD.etablissements,
          partenaires: PAYLOAD.partenaires,
          commercial_category_id: "95f29cef-5826-4ec5-9698-43038b2e4413",
          tasks_only: false,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Rapport d'import")).toBeInTheDocument();
    });

    expect(getReportCount("Établissements créés")).toBe(String(SUCCESS_REPORT.etablissements_created));
    expect(getReportCount("Établissements mis à jour")).toBe(String(SUCCESS_REPORT.etablissements_updated));
    expect(getReportCount("Contacts créés")).toBe(String(SUCCESS_REPORT.contacts_created));
    expect(getReportCount("Contacts existants (ignorés)")).toBe(String(SUCCESS_REPORT.contacts_skipped));
    expect(getReportCount("Tâches créées")).toBe(String(SUCCESS_REPORT.taches_created));
    expect(getReportCount("Partenaires créés")).toBe(String(SUCCESS_REPORT.partenaires_created));

    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith("Import terminé avec succès !");
    expect(toastWarning).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("importe en mode tâches uniquement et notifie avec warning si le rapport contient des erreurs", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { report: WARNING_REPORT },
      error: null,
    });

    renderComponent();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Importer les tâches")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Importer les tâches" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("import-commercial-data", {
        body: {
          etablissements: PAYLOAD.etablissements,
          partenaires: PAYLOAD.partenaires,
          commercial_category_id: "95f29cef-5826-4ec5-9698-43038b2e4413",
          tasks_only: true,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("2 erreurs")).toBeInTheDocument();
    });

    expect(screen.getByText("Contact sans email")).toBeInTheDocument();
    expect(screen.getByText("Région inconnue")).toBeInTheDocument();
    expect(toastWarning).toHaveBeenCalledWith("Import terminé avec 2 erreur(s)");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("gère une erreur d'import et affiche la notification d'erreur sans rapport", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "échec edge function" },
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: "Lancer l'import" }));

    await waitFor(() => {
      expect(failMock).toHaveBeenCalledWith("échec edge function");
    });

    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'import");
    expect(screen.queryByText("Rapport d'import")).not.toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("permet de naviguer vers retour, établissements et partenaires", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { report: SUCCESS_REPORT },
      error: null,
    });

    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(mockNavigate).toHaveBeenCalledWith("/parametres");

    fireEvent.click(screen.getByRole("button", { name: "Lancer l'import" }));

    await waitFor(() => {
      expect(screen.getByText("Voir les établissements")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Voir les établissements" }));
    fireEvent.click(screen.getByRole("button", { name: "Voir les partenaires" }));

    expect(mockNavigate).toHaveBeenCalledWith("/etablissements");
    expect(mockNavigate).toHaveBeenCalledWith("/partenaires");
  });
})