import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { state, mockFrom, mockUpdate, mockInsert, ROWS } = vi.hoisted(() => {
  const ROWS = [
    {
      id: "obj-1",
      user_id: "u1",
      title: "CA 50k",
      description: "Atteindre 50 000 € de CA",
      category: "revenue",
      target_metric: "ca_mensuel",
      target_value: 50000,
      current_value: 25000,
      unit: "€",
      start_date: "2025-01-01",
      end_date: "2099-12-31",
      status: "active",
      priority: "high",
      milestones: [
        { value: 12500, label: "25%", achieved: true, achieved_at: "2025-02-01" },
        { value: 25000, label: "50%", achieved: true, achieved_at: null },
        { value: 37500, label: "75%", achieved: false, achieved_at: null },
        { value: 50000, label: "100%", achieved: false, achieved_at: null },
      ],
      progress_history: [],
      created_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "obj-2",
      user_id: "u1",
      title: "Objectif terminé",
      description: null,
      category: "growth",
      target_metric: "prospects_convertis",
      target_value: 10,
      current_value: 10,
      unit: "",
      start_date: "2025-01-01",
      end_date: "2025-06-01",
      status: "completed",
      priority: "medium",
      milestones: [],
      progress_history: [],
      created_at: "2025-01-02T00:00:00Z",
    },
  ];

  const state = { result: { data: ROWS, error: null } as { data: unknown; error: unknown } };

  const mockUpdate = vi.fn();
  const mockInsert = vi.fn();

  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.gte = vi.fn(chain);
  builder.lte = vi.fn(chain);
  builder.in = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.update = mockUpdate.mockImplementation(chain);
  builder.insert = mockInsert.mockImplementation(chain);
  builder.single = vi.fn(() => Promise.resolve(state.result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(state.result));
  builder.then = (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(state.result).then(res, rej);
  builder.catch = (rej?: (e: unknown) => unknown) => Promise.resolve(state.result).catch(rej);

  const mockFrom = vi.fn(() => builder);

  return { state, mockFrom, mockUpdate, mockInsert, ROWS };
});

const { AUTH_VALUE, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  AUTH_VALUE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_VALUE,
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: vi.fn((e: { message?: string }) => e?.message ?? "erreur"),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
    React.createElement("div", { onClick }, children),
  CardContent: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    variant?: string;
  }) => React.createElement("button", { "data-variant": variant ?? "default", onClick }, children),
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value?: number }) =>
    React.createElement("div", { "data-testid": "progress", "data-value": String(value) }),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", null, children),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogContent: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogHeader: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTrigger: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/components/ui/input", () => ({
  Input: () => React.createElement("input"),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("label", null, children),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: () => React.createElement("textarea"),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  SelectContent: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  SelectItem: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
  SelectValue: () => React.createElement("span"),
}));

import { JarvisObjectivesPanel } from "./JarvisObjectivesPanel";

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(JarvisObjectivesPanel)
    )
  );
}

describe("JarvisObjectivesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = { data: ROWS, error: null };
  });

  it("affiche le header et les objectifs actifs après chargement", async () => {
    const { container } = renderPanel();

    expect(screen.getByText("Objectifs Jarvis")).toBeTruthy();

    await screen.findByText("CA 50k");

    expect(container.textContent).toContain("1 actifs");
    expect(screen.getByText("En cours")).toBeTruthy();
    expect(screen.getByText("Atteindre 50 000 € de CA")).toBeTruthy();
    expect(mockFrom).toHaveBeenCalledWith("jarvis_objectives");
  });

  it("affiche la section des objectifs atteints", async () => {
    renderPanel();

    await screen.findByText("Objectif terminé");

    expect(screen.getByText("Atteints 🎉")).toBeTruthy();
  });

  it("affiche l'état vide quand il n'y a aucun objectif", async () => {
    state.result = { data: [], error: null };
    const { container } = renderPanel();

    await screen.findByText(/Aucun objectif défini/);

    expect(container.textContent).toContain("0 actifs");
    expect(screen.queryByText("CA 50k")).toBeNull();
  });

  it("gère une erreur de chargement sans afficher d'objectifs ni d'état vide", async () => {
    state.result = { data: null, error: { message: "x" } };
    const { container } = renderPanel();

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith("jarvis_objectives"));

    await waitFor(() => {
      expect(screen.queryByText("CA 50k")).toBeNull();
    });
    expect(screen.queryByText(/Aucun objectif défini/)).toBeNull();
    expect(container.textContent).toContain("0 actifs");
  });

  it("déclenche la mutation de mise en pause via le bouton ghost", async () => {
    const { container } = renderPanel();

    await screen.findByText("CA 50k");

    const pauseButton = container.querySelector('button[data-variant="ghost"]');
    expect(pauseButton).not.toBeNull();

    await act(async () => {
      fireEvent.click(pauseButton as HTMLButtonElement);
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: "paused" });
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Statut mis à jour");
    });
  });
});