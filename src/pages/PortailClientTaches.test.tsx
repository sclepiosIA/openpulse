/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PortailClientTaches from "./PortailClientTaches";

const {
  stableAuth,
  stableEtablissement,
  stableNoNomEtablissement,
  mockNavigate,
  mockUseParams,
  mockUseEtablissement,
  mockTaskList,
  mockButton,
  mockImmersivePageHeader,
  mockFrom,
} = vi.hoisted(() => {
  const auth = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const etablissement = { id: "etab-1", nom: "Clinique du Parc" };
  const etablissementSansNom = { id: "etab-2", nom: "" };

  const navigate = vi.fn();
  const useParams = vi.fn();
  const useEtablissement = vi.fn();
  const taskList = vi.fn();
  const immersiveHeader = vi.fn();

  const button = ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        onClick,
        ...props,
      },
      children,
    );

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
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  const from = vi.fn(() => createBuilder());

  return {
    stableAuth: auth,
    stableEtablissement: etablissement,
    stableNoNomEtablissement: etablissementSansNom,
    mockNavigate: navigate,
    mockUseParams: useParams,
    mockUseEtablissement: useEtablissement,
    mockTaskList: taskList,
    mockButton: button,
    mockImmersivePageHeader: immersiveHeader,
    mockFrom: from,
  };
});

vi.mock("react-router-dom", () => ({
  useParams: mockUseParams,
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissement: mockUseEtablissement,
}));

vi.mock("@/components/ui/button", () => ({
  Button: mockButton,
}));

vi.mock("@/components/layout/ImmersivePageHeader", () => ({
  ImmersivePageHeader: (props: {
    title: string;
    subtitle: string;
    icon: React.ComponentType;
  }) => {
    mockImmersivePageHeader(props);
    return React.createElement(
      "div",
      { "data-testid": "immersive-header" },
      React.createElement("div", null, props.title),
      React.createElement("div", null, props.subtitle),
    );
  },
}));

vi.mock("@/components/portail-client/TaskList", () => ({
  TaskList: (props: { etablissementId: string }) => {
    mockTaskList(props);
    return React.createElement(
      "div",
      { "data-testid": "task-list" },
      `task-list-${props.etablissementId}`,
    );
  },
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: (props: Record<string, string>) =>
    React.createElement("svg", { "data-testid": "arrow-left", ...props }),
  ListChecks: (props: Record<string, string>) =>
    React.createElement("svg", { "data-testid": "list-checks", ...props }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => stableAuth,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => stableAuth,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => stableAuth,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("PortailClientTaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le message d'erreur si etablissementId est absent", () => {
    mockUseParams.mockReturnValue({});
    mockUseEtablissement.mockReturnValue({ data: stableEtablissement });

    render(React.createElement(PortailClientTaches), { wrapper: createWrapper() });

    expect(screen.getByText("Établissement manquant.")).toBeInTheDocument();
    expect(screen.queryByTestId("task-list")).not.toBeInTheDocument();
    expect(mockTaskList).not.toHaveBeenCalled();
    expect(mockImmersivePageHeader).not.toHaveBeenCalled();
  });

  it("affiche le titre, le sous-titre métier avec le nom de l'établissement et la liste des tâches", () => {
    mockUseParams.mockReturnValue({ etablissementId: "etab-1" });
    mockUseEtablissement.mockReturnValue({ data: stableEtablissement });

    render(React.createElement(PortailClientTaches), { wrapper: createWrapper() });

    expect(screen.getByText("Tâches portail client")).toBeInTheDocument();
    expect(
      screen.getByText("Échanges OpenPulse ↔ Clinique du Parc"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("task-list")).toHaveTextContent("task-list-etab-1");

    expect(mockUseEtablissement).toHaveBeenCalledWith("etab-1");
    expect(mockTaskList).toHaveBeenCalledWith({ etablissementId: "etab-1" });
    expect(mockImmersivePageHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Tâches portail client",
        subtitle: "Échanges OpenPulse ↔ Clinique du Parc",
      }),
    );
  });

  it("affiche le sous-titre par défaut quand le nom de l'établissement est absent", () => {
    mockUseParams.mockReturnValue({ etablissementId: "etab-2" });
    mockUseEtablissement.mockReturnValue({ data: stableNoNomEtablissement });

    render(React.createElement(PortailClientTaches), { wrapper: createWrapper() });

    expect(
      screen.getByText("Échanges bidirectionnels avec l'établissement"),
    ).toBeInTheDocument();
    expect(mockImmersivePageHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle: "Échanges bidirectionnels avec l'établissement",
      }),
    );
  });

  it("navigue vers la page précédente au clic sur Retour", () => {
    mockUseParams.mockReturnValue({ etablissementId: "etab-1" });
    mockUseEtablissement.mockReturnValue({ data: stableEtablissement });

    render(React.createElement(PortailClientTaches), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /retour/i }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});