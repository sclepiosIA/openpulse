/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TeamCalendarView } from "./TeamCalendarView";

const {
  TASKS_LOADING,
  TASKS_SUCCESS,
  TASKS_ERROR_NULL,
  PROFILES,
  mockUseTaches,
  mockFrom,
} = vi.hoisted(() => {
  const today = new Date();
  const sameDayIso = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    10,
    0,
    0
  ).toISOString();
  const tomorrowIso = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
    10,
    0,
    0
  ).toISOString();
  const pastIso = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
    10,
    0,
    0
  ).toISOString();

  return {
    TASKS_LOADING: undefined,
    TASKS_SUCCESS: [
      {
        id: "t1",
        titre: "Préparer le devis",
        echeance: sameDayIso,
        responsable_id: "p1",
        statut: "En cours",
        priorite: "high",
      },
      {
        id: "t2",
        titre: "Clôturer dossier",
        echeance: sameDayIso,
        responsable_id: "p2",
        statut: "Terminé",
        priorite: "medium",
      },
      {
        id: "t3",
        titre: "Planifier réunion",
        echeance: tomorrowIso,
        responsable_id: "p1",
        statut: "À faire",
        priorite: "low",
      },
      {
        id: "t4",
        titre: "Relancer client",
        echeance: pastIso,
        responsable_id: "p1",
        statut: "En cours",
        priorite: "high",
      },
    ],
    TASKS_ERROR_NULL: null,
    PROFILES: [
      { id: "p1", prenom: "Alice", nom: "Martin", email: "alice@example.test" },
      { id: "p2", prenom: "Bob", nom: "Durand", email: "bob@example.test" },
    ],
    mockUseTaches: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock("@/hooks/tasks/useTaches", () => ({
  useTaches: mockUseTaches,
}));

vi.mock("@/integrations/supabase/client", () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h2 className={className}>{children}</h2>,
  CardContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Clock: ({ className }: { className?: string }) => (
    <svg data-testid="clock-icon" className={className} />
  ),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    selected,
    onSelect,
    modifiers,
    modifiersStyles,
    className,
  }: {
    selected?: Date;
    onSelect?: (date: Date | undefined) => void;
    modifiers?: { hasTasks?: (date: Date) => boolean };
    modifiersStyles?: Record<string, unknown>;
    className?: string;
  }) => {
    const today = new Date();
    const tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );
    const noTaskDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 7
    );

    return (
      <div data-testid="calendar" className={className}>
        <div data-testid="calendar-selected">
          {selected ? selected.toDateString() : "none"}
        </div>
        <div data-testid="calendar-styles">
          {String(
            typeof modifiersStyles === "object" &&
              modifiersStyles !== null &&
              "hasTasks" in modifiersStyles
          )}
        </div>
        <button
          type="button"
          data-testid="day-today"
          data-has-tasks={String(modifiers?.hasTasks?.(today) ?? false)}
          onClick={() => onSelect?.(today)}
        >
          today
        </button>
        <button
          type="button"
          data-testid="day-tomorrow"
          data-has-tasks={String(modifiers?.hasTasks?.(tomorrow) ?? false)}
          onClick={() => onSelect?.(tomorrow)}
        >
          tomorrow
        </button>
        <button
          type="button"
          data-testid="day-no-task"
          data-has-tasks={String(modifiers?.hasTasks?.(noTaskDay) ?? false)}
          onClick={() => onSelect?.(noTaskDay)}
        >
          no-task
        </button>
      </div>
    );
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
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderView() {
  const Wrapper = createWrapper();
  return render(<TeamCalendarView profiles={PROFILES} />, { wrapper: Wrapper });
}

describe("TeamCalendarView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état vide pendant le chargement", () => {
    mockUseTaches.mockReturnValue({
      data: TASKS_LOADING,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderView();

    expect(screen.getByText("Calendrier des échéances")).toBeInTheDocument();
    expect(screen.getByText("Aucune tâche pour cette date")).toBeInTheDocument();
    expect(screen.getByTestId("clock-icon")).toBeInTheDocument();
    expect(screen.getByTestId("day-today")).toHaveAttribute("data-has-tasks", "false");
    expect(screen.getByTestId("day-tomorrow")).toHaveAttribute("data-has-tasks", "false");
  });

  it("affiche les tâches du jour sélectionné avec assignation, statut, priorité et jours marqués dans le calendrier", () => {
    mockUseTaches.mockReturnValue({
      data: TASKS_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderView();

    const todayTitle = `Tâches pour le ${new Date().toLocaleDateString("fr-FR")}`;
    expect(screen.getByText(todayTitle)).toBeInTheDocument();

    expect(screen.getByText("Préparer le devis")).toBeInTheDocument();
    expect(screen.getByText("Clôturer dossier")).toBeInTheDocument();
    expect(screen.queryByText("Planifier réunion")).not.toBeInTheDocument();

    expect(screen.getByText("Assigné à: Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("Assigné à: Bob Durand")).toBeInTheDocument();

    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.getByText("Terminé")).toBeInTheDocument();
    expect(screen.getByText("Haute")).toBeInTheDocument();
    expect(screen.getByText("Moyenne")).toBeInTheDocument();

    expect(screen.getByTestId("day-today")).toHaveAttribute("data-has-tasks", "true");
    expect(screen.getByTestId("day-tomorrow")).toHaveAttribute("data-has-tasks", "true");
    expect(screen.getByTestId("day-no-task")).toHaveAttribute("data-has-tasks", "false");
    expect(screen.getByTestId("calendar-styles")).toHaveTextContent("true");
  });

  it("met à jour la liste quand on sélectionne une autre date dans le calendrier", () => {
    mockUseTaches.mockReturnValue({
      data: TASKS_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderView();

    fireEvent.click(screen.getByTestId("day-tomorrow"));

    expect(screen.getByText("Planifier réunion")).toBeInTheDocument();
    expect(screen.queryByText("Préparer le devis")).not.toBeInTheDocument();
    expect(screen.queryByText("Clôturer dossier")).not.toBeInTheDocument();
    expect(screen.getByText("Assigné à: Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("À faire")).toBeInTheDocument();
    expect(screen.getByText("Basse")).toBeInTheDocument();
  });

  it("gère le cas d'erreur où les données sont nulles en affichant l'état vide sans planter", () => {
    mockUseTaches.mockReturnValue({
      data: TASKS_ERROR_NULL,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    renderView();

    expect(screen.getByText("Calendrier des échéances")).toBeInTheDocument();
    expect(screen.getByText("Aucune tâche pour cette date")).toBeInTheDocument();
    expect(screen.queryByText("Préparer le devis")).not.toBeInTheDocument();
    expect(screen.getByTestId("day-today")).toHaveAttribute("data-has-tasks", "false");
  });
});