/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { RHOnboardingOffboarding } from "./RHOnboardingOffboarding";

const {
  PROFILES,
  ONBOARDING_DATA,
  DEFAULT_EMPTY_ONBOARDING,
  DEFAULT_AUTH,
  toastError,
  toastSuccess,
  debugError,
  usePeopleDataMock,
  useOnboardingByProfileMock,
  mutateAsyncMock,
  useUpsertOnboardingMock,
  statusCardSpy,
  dossierChecklistSpy,
  comptesChecklistSpy,
  materielListSpy,
  mockFrom,
} = vi.hoisted(() => {
  const DEFAULT_EMPTY_ONBOARDING = {
    date_entree: null,
    date_sortie: null,
    statut: "en_cours" as const,
    motif_sortie: null,
    dossier_rh: {
      cv: { status: null, ref: null, date: null },
      contrat: { status: null, ref: null, type: null, date: null },
      mutuelle: { status: null, ref: null, organisme: null, date: null },
      charte: { status: null, date: null },
      solde_tout_compte: { status: null, date: null },
    },
    comptes_acces: {
      mail: false,
      vpn: false,
      bookstack: false,
      passbolt: false,
      espocrm: false,
      google_workspace: false,
      penpot: false,
      nextcloud: false,
      gitea: false,
      kimai: false,
      calcom: false,
      ssh: false,
      azure: false,
      ovh: false,
      openai: false,
      reseaux_sociaux: false,
      ausha: false,
      brevo: false,
    },
    materiel: {
      pc_mac: { assigne: false, numero_serie: null, modele: null },
      laptop: { assigne: false, numero_serie: null, modele: null },
      smartphone: { assigne: false, numero_serie: null, modele: null, numero: null },
      licences: [],
    },
  };

  return {
    PROFILES: [
      { id: "p1", prenom: "Alice", nom: "Martin", fonction: "RH" },
      { id: "p2", prenom: "Bob", nom: "Durand", fonction: "Dev" },
    ],
    ONBOARDING_DATA: {
      id: "ob1",
      profile_id: "p1",
      date_entree: "2024-01-10",
      date_sortie: "",
      statut: "actif" as const,
      motif_sortie: "",
      dossier_rh: {
        cv: { status: true, ref: "cv1", date: "2024-01-01" },
        contrat: { status: true, ref: "ct1", type: "CDI", date: "2024-01-02" },
        mutuelle: { status: false, ref: null, organisme: null, date: null },
        charte: { status: true, date: "2024-01-03" },
        solde_tout_compte: { status: false, date: null },
      },
      comptes_acces: {
        mail: true,
        vpn: true,
        bookstack: true,
        passbolt: false,
        espocrm: false,
        google_workspace: true,
        penpot: false,
        nextcloud: false,
        gitea: false,
        kimai: false,
        calcom: false,
        ssh: false,
        azure: false,
        ovh: false,
        openai: false,
        reseaux_sociaux: false,
        ausha: false,
        brevo: false,
      },
      materiel: {
        pc_mac: { assigne: true, numero_serie: "S1", modele: "Mac" },
        laptop: { assigne: false, numero_serie: null, modele: null },
        smartphone: { assigne: true, numero_serie: "S2", modele: "Phone", numero: "01" },
        licences: [],
      },
    },
    DEFAULT_EMPTY_ONBOARDING,
    DEFAULT_AUTH: {
      user: { id: "u1", email: "test@local" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    debugError: vi.fn(),
    usePeopleDataMock: vi.fn(),
    useOnboardingByProfileMock: vi.fn(),
    mutateAsyncMock: vi.fn(),
    useUpsertOnboardingMock: vi.fn(),
    statusCardSpy: vi.fn(),
    dossierChecklistSpy: vi.fn(),
    comptesChecklistSpy: vi.fn(),
    materielListSpy: vi.fn(),
    mockFrom: vi.fn(),
  };
});

function createBuilder() {
  const result = { data: null, error: null };
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/hooks/hr/usePeopleData", () => ({
  usePeopleData: usePeopleDataMock,
}));

vi.mock("@/hooks/tasks/useOnboardingOffboarding", () => ({
  useOnboardingByProfile: useOnboardingByProfileMock,
  useUpsertOnboarding: useUpsertOnboardingMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => DEFAULT_AUTH,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => DEFAULT_AUTH,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => DEFAULT_AUTH,
}));

vi.mock("lucide-react", () => ({
  UserCheck: () => React.createElement("span", { "data-testid": "icon-usercheck" }),
  Save: () => React.createElement("span", { "data-testid": "icon-save" }),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  CardContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) =>
    React.createElement("label", { htmlFor }, children),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
  }) =>
    React.createElement("input", {
      id,
      value: value ?? "",
      onChange,
      placeholder,
      type: type ?? "text",
    }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) =>
    React.createElement(
      "button",
      { onClick, disabled, className, type: "button" },
      children
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
  }) =>
    React.createElement(
      "div",
      { "data-testid": "mock-select" },
      React.createElement(
        "select",
        {
          "data-testid": "select-control",
          value: value ?? "",
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value),
        },
        React.createElement("option", { value: "" }, ""),
        children
      )
    ),
  SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
    React.createElement("option", { value }, children),
  SelectTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "select-trigger" }, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    React.createElement("div", { "data-testid": "select-value" }, placeholder ?? ""),
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  AccordionItem: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  AccordionContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
}));

vi.mock("./onboarding/OnboardingStatusCard", () => ({
  OnboardingStatusCard: (props: {
    data: typeof ONBOARDING_DATA;
    profileName: string;
    completionRate: number;
  }) => {
    statusCardSpy(props);
    return React.createElement(
      "div",
      { "data-testid": "status-card" },
      `${props.profileName}|${props.completionRate}|${props.data.statut}`
    );
  },
}));

vi.mock("./onboarding/DossierRHChecklist", () => ({
  DossierRHChecklist: (props: {
    dossier: typeof ONBOARDING_DATA.dossier_rh;
    onUpdate: (dossier: typeof ONBOARDING_DATA.dossier_rh) => void;
    profileId: string;
    onboardingId: string | null;
  }) => {
    dossierChecklistSpy(props);
    return React.createElement("div", { "data-testid": "dossier-checklist" }, props.profileId);
  },
}));

vi.mock("./onboarding/ComptesAccesChecklist", () => ({
  ComptesAccesChecklist: (props: {
    comptes: typeof ONBOARDING_DATA.comptes_acces;
    onUpdate: (comptes: typeof ONBOARDING_DATA.comptes_acces) => void;
  }) => {
    comptesChecklistSpy(props);
    return React.createElement("div", { "data-testid": "comptes-checklist" }, String(props.comptes.mail));
  },
}));

vi.mock("./onboarding/MaterielList", () => ({
  MaterielList: (props: {
    materiel: typeof ONBOARDING_DATA.materiel;
    onUpdate: (materiel: typeof ONBOARDING_DATA.materiel) => void;
  }) => {
    materielListSpy(props);
    return React.createElement("div", { "data-testid": "materiel-list" }, String(props.materiel.pc_mac.assigne));
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = createQueryClient();
  return React.createElement(QueryClientProvider, { client }, children);
}

describe("RHOnboardingOffboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createBuilder());
    usePeopleDataMock.mockReturnValue({ profiles: PROFILES });
    useOnboardingByProfileMock.mockImplementation((profileId: string | null) => ({
      data: profileId === "p1" ? ONBOARDING_DATA : null,
      isLoading: false,
      isError: false,
      error: null,
    }));
    mutateAsyncMock.mockResolvedValue({ data: { id: "ob1" }, error: null });
    useUpsertOnboardingMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it("utilise renderHook avec QueryClientProvider sans erreur", () => {
    const { result } = renderHook(() => useOnboardingByProfileMock("p1"), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(ONBOARDING_DATA);
  });

  it("affiche l'état initial sans collaborateur sélectionné", () => {
    render(React.createElement(RHOnboardingOffboarding), { wrapper: Wrapper });

    expect(screen.getByText("Entrées / Sorties de collaborateurs")).toBeInTheDocument();
    expect(screen.getByText("Sélectionnez un collaborateur pour commencer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enregistrer/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-card")).not.toBeInTheDocument();
  });

  it("affiche les données métier et calcule le taux de complétion après sélection", async () => {
    render(React.createElement(RHOnboardingOffboarding), { wrapper: Wrapper });

    fireEvent.change(screen.getAllByTestId("select-control")[0], { target: { value: "p1" } });

    await waitFor(() => {
      expect(screen.getByTestId("status-card")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("2024-01-10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
    expect(screen.getByTestId("status-card").textContent).toBe("Alice Martin|39|actif");
    expect(screen.getByTestId("dossier-checklist").textContent).toBe("p1");
    expect(screen.getByTestId("comptes-checklist").textContent).toBe("true");
    expect(screen.getByTestId("materiel-list").textContent).toBe("true");

    const statusProps = statusCardSpy.mock.calls.at(-1)?.[0] as {
      profileName: string;
      completionRate: number;
      data: { statut: string; date_entree: string };
    };
    expect(statusProps.profileName).toBe("Alice Martin");
    expect(statusProps.completionRate).toBe(39);
    expect(statusProps.data.statut).toBe("actif");
    expect(statusProps.data.date_entree).toBe("2024-01-10");

    const dossierProps = dossierChecklistSpy.mock.calls.at(-1)?.[0] as {
      profileId: string;
      onboardingId: string | null;
    };
    expect(dossierProps.profileId).toBe("p1");
    expect(dossierProps.onboardingId).toBe("ob1");
  });

  it("crée une fiche par défaut quand aucun onboarding n'existe et sauvegarde avec des null nettoyés", async () => {
    render(React.createElement(RHOnboardingOffboarding), { wrapper: Wrapper });

    fireEvent.change(screen.getAllByTestId("select-control")[0], { target: { value: "p2" } });

    await waitFor(() => {
      expect(screen.getByText("Aucune fiche d'entrée/sortie pour ce collaborateur.")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /créer une fiche/i }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      profile_id: "p2",
      date_entree: null,
      date_sortie: null,
      statut: "en_cours",
      motif_sortie: null,
      dossier_rh: DEFAULT_EMPTY_ONBOARDING.dossier_rh,
      comptes_acces: DEFAULT_EMPTY_ONBOARDING.comptes_acces,
      materiel: DEFAULT_EMPTY_ONBOARDING.materiel,
    });
  });

  it("sauvegarde les données existantes du collaborateur sélectionné", async () => {
    render(React.createElement(RHOnboardingOffboarding), { wrapper: Wrapper });

    fireEvent.change(screen.getAllByTestId("select-control")[0], { target: { value: "p1" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      profile_id: "p1",
      date_entree: "2024-01-10",
      date_sortie: null,
      statut: "actif",
      motif_sortie: null,
      dossier_rh: ONBOARDING_DATA.dossier_rh,
      comptes_acces: ONBOARDING_DATA.comptes_acces,
      materiel: ONBOARDING_DATA.materiel,
    });
  });

  it("affiche une erreur toast si on tente de sauvegarder sans sélection", async () => {
    render(React.createElement(RHOnboardingOffboarding), { wrapper: Wrapper });

    expect(screen.queryByRole("button", { name: /enregistrer/i })).not.toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("gère l'erreur de mutation via debug.error", async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error("x"));

    render(React.createElement(RHOnboardingOffboarding), { wrapper: Wrapper });

    fireEvent.change(screen.getAllByTestId("select-control")[0], { target: { value: "p1" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    });

    await waitFor(() => {
      expect(debugError).toHaveBeenCalled();
    });

    expect(debugError.mock.calls[0]?.[0]).toBe("Error saving onboarding:");
  });

  it("expose un scénario d'erreur hook avec isError quand la source renvoie { data:null, error }", () => {
    useOnboardingByProfileMock.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const { result } = renderHook(() => useOnboardingByProfileMock("p1"), { wrapper: Wrapper });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeNull();
  });

  it("affiche implicitement l'état de chargement en masquant les blocs de résultat pendant isLoading", () => {
    useOnboardingByProfileMock.mockImplementation((profileId: string | null) => ({
      data: null,
      isLoading: profileId === "p1",
      isError: false,
      error: null,
    }));

    render(React.createElement(RHOnboardingOffboarding), { wrapper: Wrapper });

    fireEvent.change(screen.getAllByTestId("select-control")[0], { target: { value: "p1" } });

    expect(screen.queryByText("Aucune fiche d'entrée/sortie pour ce collaborateur.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-card")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
  });
});