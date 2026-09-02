/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CentreNotifications from "./CentreNotifications";
import { useInAppNotifications } from "@/hooks/dashboard/useInAppNotifications";

const {
  AUTH_STATE,
  NAVIGATE_MOCK,
  PAGE_TITLE_MOCK,
  MARK_AS_READ_MOCK,
  MARK_ALL_AS_READ_MOCK,
  DELETE_NOTIFICATION_MOCK,
  HOOK_STATE,
  NOTIFICATIONS,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const NAVIGATE_MOCK = vi.fn();
  const PAGE_TITLE_MOCK = vi.fn();
  const MARK_AS_READ_MOCK = vi.fn();
  const MARK_ALL_AS_READ_MOCK = vi.fn();
  const DELETE_NOTIFICATION_MOCK = vi.fn();

  const NOTIFICATIONS = [
    {
      id: "n1",
      title: "Nouvelle suggestion",
      message: "Une suggestion IA est disponible",
      type: "ai_suggestion" as const,
      is_read: false,
      created_at: "2024-01-01T10:00:00.000Z",
      related_id: "ai-1",
      related_type: "ai_suggestion",
    },
    {
      id: "n2",
      title: "Tâche assignée",
      message: "Une tâche vous a été assignée",
      type: "task_assignment" as const,
      is_read: true,
      created_at: "2024-01-02T10:00:00.000Z",
      related_id: "task-1",
      related_type: "tache",
    },
    {
      id: "n3",
      title: "Mention reçue",
      message: "Vous avez été mentionné",
      type: "mention" as const,
      is_read: false,
      created_at: "2024-01-03T10:00:00.000Z",
      related_id: null,
      related_type: null,
    },
    {
      id: "n4",
      title: "Établissement modifié",
      message: "Les données de l'établissement ont changé",
      type: "establishment_update" as const,
      is_read: true,
      created_at: "2024-01-04T10:00:00.000Z",
      related_id: "eta-1",
      related_type: "etablissement",
    },
  ];

  const HOOK_STATE: {
    notifications: typeof NOTIFICATIONS;
    unreadCount: number;
    isLoading: boolean;
    isError: boolean;
    error: { message: string } | null;
  } = {
    notifications: NOTIFICATIONS,
    unreadCount: 2,
    isLoading: false,
    isError: false,
    error: null,
  };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.upsert.mockImplementation(() => builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation(
    (onFulfilled?: (value: { data: typeof NOTIFICATIONS; error: null }) => unknown) =>
      Promise.resolve(onFulfilled ? onFulfilled({ data: NOTIFICATIONS, error: null }) : { data: NOTIFICATIONS, error: null })
  );
  builder.catch.mockImplementation(() => Promise.resolve({ data: NOTIFICATIONS, error: null }));

  const mockFrom = vi.fn(() => builder);

  return {
    AUTH_STATE,
    NAVIGATE_MOCK,
    PAGE_TITLE_MOCK,
    MARK_AS_READ_MOCK,
    MARK_ALL_AS_READ_MOCK,
    DELETE_NOTIFICATION_MOCK,
    HOOK_STATE,
    NOTIFICATIONS,
    mockFrom,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => NAVIGATE_MOCK,
  };
});

vi.mock("@/hooks/shared/usePageTitle", () => ({
  usePageTitle: PAGE_TITLE_MOCK,
}));

vi.mock("@/hooks/dashboard/useInAppNotifications", () => ({
  useInAppNotifications: vi.fn(() => ({
    notifications: HOOK_STATE.notifications,
    unreadCount: HOOK_STATE.unreadCount,
    isLoading: HOOK_STATE.isLoading,
    isError: HOOK_STATE.isError,
    error: HOOK_STATE.error,
    markAsRead: MARK_AS_READ_MOCK,
    markAllAsRead: MARK_ALL_AS_READ_MOCK,
    deleteNotification: DELETE_NOTIFICATION_MOCK,
  })),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "il y a 2 jours",
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) =>
    React.createElement("svg", { className, "aria-hidden": "true" });
  return {
    Bell: Icon,
    CheckCheck: Icon,
    Trash2: Icon,
    Settings: Icon,
    Inbox: Icon,
    Filter: Icon,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement(
      "button",
      {
        type: "button",
        onClick,
        ...props,
      },
      children
    ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) =>
    React.createElement("span", props, children),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
}));

vi.mock("@/components/ui/tabs", () => {
  const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  } | null>(null);

  return {
    Tabs: ({
      children,
      value,
      onValueChange,
      ...props
    }: {
      children: React.ReactNode;
      value: string;
      onValueChange: (value: string) => void;
    } & React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement(
        TabsContext.Provider,
        { value: { value, onValueChange } },
        React.createElement("div", props, children)
      ),
    TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", props, children),
    TabsTrigger: ({
      children,
      value,
      ...props
    }: { children: React.ReactNode; value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
      const ctx = React.useContext(TabsContext);
      const selected = ctx?.value === value;
      return React.createElement(
        "button",
        {
          type: "button",
          role: "button",
          "data-state": selected ? "active" : "inactive",
          onClick: () => ctx?.onValueChange(value),
          ...props,
        },
        children
      );
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return Wrapper;
}

describe("CentreNotifications", () => {
  beforeEach(() => {
    HOOK_STATE.notifications = NOTIFICATIONS;
    HOOK_STATE.unreadCount = 2;
    HOOK_STATE.isLoading = false;
    HOOK_STATE.isError = false;
    HOOK_STATE.error = null;
    NAVIGATE_MOCK.mockClear();
    PAGE_TITLE_MOCK.mockClear();
    MARK_AS_READ_MOCK.mockClear();
    MARK_ALL_AS_READ_MOCK.mockClear();
    DELETE_NOTIFICATION_MOCK.mockClear();
    mockFrom.mockClear();
    vi.mocked(useInAppNotifications).mockImplementation(() => ({
      notifications: HOOK_STATE.notifications,
      unreadCount: HOOK_STATE.unreadCount,
      isLoading: HOOK_STATE.isLoading,
      isError: HOOK_STATE.isError,
      error: HOOK_STATE.error,
      markAsRead: MARK_AS_READ_MOCK,
      markAllAsRead: MARK_ALL_AS_READ_MOCK,
      deleteNotification: DELETE_NOTIFICATION_MOCK,
    }));
  });

  it("affiche l'état de chargement", () => {
    HOOK_STATE.isLoading = true;

    render(<CentreNotifications />, { wrapper: createWrapper() });

    expect(screen.getByText("Chargement…")).toBeInTheDocument();
    expect(screen.queryByText("Nouvelle suggestion")).not.toBeInTheDocument();
  });

  it("affiche les statistiques et les notifications avec les valeurs métier attendues", () => {
    render(<CentreNotifications />, { wrapper: createWrapper() });

    expect(PAGE_TITLE_MOCK).toHaveBeenCalledWith("Centre de notifications");
    expect(screen.getByRole("heading", { name: "Centre de notifications" })).toBeInTheDocument();
    expect(screen.getByText("4 notifications — 2 non lues")).toBeInTheDocument();

    expect(screen.getByText("Nouvelle suggestion")).toBeInTheDocument();
    expect(screen.getAllByText("Tâche assignée")).toHaveLength(2);
    expect(screen.getByText("Mention reçue")).toBeInTheDocument();
    expect(screen.getByText("Établissement modifié")).toBeInTheDocument();

    expect(screen.getByText("Suggestion IA")).toBeInTheDocument();
    expect(screen.getByText("Mention")).toBeInTheDocument();
    expect(screen.getByText("Établissement")).toBeInTheDocument();

    expect(screen.getAllByText("il y a 2 jours")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Tout marquer comme lu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Préférences" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Supprimer" })).toHaveLength(4);

    const statValues = screen.getAllByText(/^(4|2|1)$/).map((node) => node.textContent);
    expect(statValues).toEqual(expect.arrayContaining(["4", "2", "1", "1"]));
  });

  it("filtre les notifications non lues puis par type", () => {
    render(<CentreNotifications />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "Non lues" }));
    expect(screen.getByText("Nouvelle suggestion")).toBeInTheDocument();
    expect(screen.getByText("Mention reçue")).toBeInTheDocument();
    expect(screen.queryByText("Établissement modifié")).not.toBeInTheDocument();
    expect(screen.queryAllByText("Tâche assignée")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "IA" }));
    expect(screen.getByText("Nouvelle suggestion")).toBeInTheDocument();
    expect(screen.queryByText("Mention reçue")).not.toBeInTheDocument();
    expect(screen.queryAllByText("Tâche assignée")).toHaveLength(0);
  });

  it("marque comme lu et navigue vers la cible quand on clique sur une notification cliquable non lue", () => {
    render(<CentreNotifications />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText("Nouvelle suggestion"));

    expect(MARK_AS_READ_MOCK).toHaveBeenCalledWith("n1");
    expect(NAVIGATE_MOCK).toHaveBeenCalledWith("/parametres/jarvis");
  });

  it("navigue vers les préférences et marque tout comme lu", () => {
    render(<CentreNotifications />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    expect(MARK_ALL_AS_READ_MOCK).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Préférences" }));
    expect(NAVIGATE_MOCK).toHaveBeenCalledWith("/profil?tab=notifications");
  });

  it("supprime une notification sans déclencher la navigation", () => {
    render(<CentreNotifications />, { wrapper: createWrapper() });

    const deleteButtons = screen.getAllByRole("button", { name: "Supprimer" });
    fireEvent.click(deleteButtons[0]);

    expect(DELETE_NOTIFICATION_MOCK).toHaveBeenCalledWith("n1");
    expect(NAVIGATE_MOCK).not.toHaveBeenCalled();
  });

  it("affiche l'état vide pour un filtre sans résultat", () => {
    HOOK_STATE.notifications = [NOTIFICATIONS[1]];
    HOOK_STATE.unreadCount = 0;

    render(<CentreNotifications />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "Mentions" }));

    expect(screen.getByText("Aucune notification pour ce filtre")).toBeInTheDocument();
  });

  it("expose chargement puis succès puis erreur via le hook mocké", async () => {
    HOOK_STATE.isLoading = true;
    const { result, rerender } = renderHook(() => useInAppNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.notifications).toEqual(NOTIFICATIONS);

    HOOK_STATE.isLoading = false;
    HOOK_STATE.isError = false;
    HOOK_STATE.error = null;
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.notifications[0].title).toBe("Nouvelle suggestion");
    expect(result.current.notifications[3].related_type).toBe("etablissement");

    HOOK_STATE.notifications = [];
    HOOK_STATE.unreadCount = 0;
    HOOK_STATE.isError = true;
    HOOK_STATE.error = { message: "x" };
    rerender();

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
  });

  it("déclenche les mutations du hook avec les bons arguments", async () => {
    const { result } = renderHook(() => useInAppNotifications(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.markAsRead("n1");
      result.current.markAllAsRead();
      result.current.deleteNotification("n3");
    });

    expect(MARK_AS_READ_MOCK).toHaveBeenCalledWith("n1");
    expect(MARK_ALL_AS_READ_MOCK).toHaveBeenCalledTimes(1);
    expect(DELETE_NOTIFICATION_MOCK).toHaveBeenCalledWith("n3");
  });
});