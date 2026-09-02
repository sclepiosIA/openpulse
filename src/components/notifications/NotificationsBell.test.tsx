/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, renderHook, act, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationsBell } from "./NotificationsBell";
import { useInAppNotifications } from "@/hooks/dashboard/useInAppNotifications";

const {
  STABLE_USER,
  NOTIFICATIONS,
  EMPTY_NOTIFICATIONS,
  LOADING_STATE,
  SUCCESS_STATE,
  EMPTY_STATE,
  ERROR_STATE,
  navigateMock,
  markAsReadMock,
  markAllAsReadMock,
  deleteNotificationMock,
  mockUseInAppNotifications,
  mockFrom,
} = vi.hoisted(() => {
  const STABLE_USER = {
    user: { id: "u1", email: "test@site.fr" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const NOTIFICATIONS = [
    {
      id: "n1",
      title: "Nouvelle tâche assignée",
      message: "Une tâche vous a été attribuée",
      type: "task_assignment" as const,
      is_read: false,
      created_at: "2024-01-10T10:00:00.000Z",
      related_id: "task-1",
      related_type: "tache" as const,
    },
    {
      id: "n2",
      title: "Mise à jour établissement",
      message: "Les infos ont changé",
      type: "establishment_update" as const,
      is_read: true,
      created_at: "2024-01-09T09:00:00.000Z",
      related_id: "eta-1",
      related_type: "etablissement" as const,
    },
  ];

  const EMPTY_NOTIFICATIONS: typeof NOTIFICATIONS = [];

  const navigateMock = vi.fn();
  const markAsReadMock = vi.fn();
  const markAllAsReadMock = vi.fn();
  const deleteNotificationMock = vi.fn();
  const mockUseInAppNotifications = vi.fn();

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
    then: (
      onFulfilled: (value: { data: null; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  const mockFrom = vi.fn(() => builder);

  const LOADING_STATE = {
    notifications: EMPTY_NOTIFICATIONS,
    unreadCount: 0,
    isLoading: true,
    markAsRead: markAsReadMock,
    markAllAsRead: markAllAsReadMock,
    deleteNotification: deleteNotificationMock,
    isError: false,
    error: null,
  };

  const SUCCESS_STATE = {
    notifications: NOTIFICATIONS,
    unreadCount: 1,
    isLoading: false,
    markAsRead: markAsReadMock,
    markAllAsRead: markAllAsReadMock,
    deleteNotification: deleteNotificationMock,
    isError: false,
    error: null,
  };

  const EMPTY_STATE = {
    notifications: EMPTY_NOTIFICATIONS,
    unreadCount: 0,
    isLoading: false,
    markAsRead: markAsReadMock,
    markAllAsRead: markAllAsReadMock,
    deleteNotification: deleteNotificationMock,
    isError: false,
    error: null,
  };

  const ERROR_STATE = {
    notifications: EMPTY_NOTIFICATIONS,
    unreadCount: 0,
    isLoading: false,
    markAsRead: markAsReadMock,
    markAllAsRead: markAllAsReadMock,
    deleteNotification: deleteNotificationMock,
    isError: true,
    error: { message: "x" },
  };

  return {
    STABLE_USER,
    NOTIFICATIONS,
    EMPTY_NOTIFICATIONS,
    LOADING_STATE,
    SUCCESS_STATE,
    EMPTY_STATE,
    ERROR_STATE,
    navigateMock,
    markAsReadMock,
    markAllAsReadMock,
    deleteNotificationMock,
    mockUseInAppNotifications,
    mockFrom,
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => STABLE_USER,
}));

vi.mock("@/hooks/dashboard/useInAppNotifications", () => ({
  useInAppNotifications: mockUseInAppNotifications,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    className,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    title?: string;
    className?: string;
    "aria-label"?: string;
  }) => (
    <button type="button" onClick={onClick} title={title} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Bell: Icon,
    Check: Icon,
    CheckCheck: Icon,
    Trash2: Icon,
    Settings: Icon,
    Inbox: Icon,
  };
});

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "il y a 2 jours"),
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
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

describe("NotificationsBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose l'état de chargement du hook puis affiche le rendu de chargement", () => {
    mockUseInAppNotifications.mockReturnValue(LOADING_STATE);

    const { result } = renderHook(() => useInAppNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.notifications).toBe(EMPTY_NOTIFICATIONS);
    expect(result.current.unreadCount).toBe(0);

    render(<NotificationsBell />, { wrapper: createWrapper() });

    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
    expect(screen.queryByText("Aucune notification")).not.toBeInTheDocument();
    expect(screen.queryByText("Voir toutes les notifications")).not.toBeInTheDocument();
  });

  it("affiche les notifications et exécute les actions métier attendues", async () => {
    mockUseInAppNotifications.mockReturnValue(SUCCESS_STATE);

    const { result } = renderHook(() => useInAppNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.notifications).toBe(NOTIFICATIONS);
    expect(result.current.unreadCount).toBe(1);

    render(<NotificationsBell />, { wrapper: createWrapper() });

    expect(screen.getByLabelText("Notifications (1 non lues)")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("1 non lue")).toBeInTheDocument();
    expect(screen.getByText("Nouvelle tâche assignée")).toBeInTheDocument();
    expect(screen.getByText("Une tâche vous a été attribuée")).toBeInTheDocument();
    expect(screen.getByText("Mise à jour établissement")).toBeInTheDocument();
    expect(screen.getByText("Les infos ont changé")).toBeInTheDocument();
    expect(screen.getAllByText("il y a 2 jours")).toHaveLength(2);
    expect(screen.getByText("Voir toutes les notifications")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTitle("Tout marquer comme lu"));
    });
    expect(markAllAsReadMock).toHaveBeenCalledTimes(1);

    const unreadItem = screen.getByText("Nouvelle tâche assignée").closest("li");
    expect(unreadItem).not.toBeNull();
    if (unreadItem) {
      await act(async () => {
        fireEvent.click(within(unreadItem).getByTitle("Marquer comme lu"));
      });
    }
    expect(markAsReadMock).toHaveBeenCalledWith("n1");

    if (unreadItem) {
      await act(async () => {
        fireEvent.click(within(unreadItem).getByTitle("Supprimer"));
      });
    }
    expect(deleteNotificationMock).toHaveBeenCalledWith("n1");

    await act(async () => {
      fireEvent.click(screen.getByText("Nouvelle tâche assignée"));
    });
    expect(markAsReadMock).toHaveBeenCalledWith("n1");
    expect(navigateMock).toHaveBeenCalledWith("/todos");

    await act(async () => {
      fireEvent.click(screen.getByText("Mise à jour établissement"));
    });
    expect(navigateMock).toHaveBeenCalledWith("/etablissements/eta-1");

    await act(async () => {
      fireEvent.click(screen.getByTitle("Paramètres"));
    });
    expect(navigateMock).toHaveBeenCalledWith("/profil?tab=notifications");

    await act(async () => {
      fireEvent.click(screen.getByText("Voir toutes les notifications"));
    });
    expect(navigateMock).toHaveBeenCalledWith("/notifications");
  });

  it("affiche l'état vide quand aucune notification n'est disponible", () => {
    mockUseInAppNotifications.mockReturnValue(EMPTY_STATE);

    render(<NotificationsBell />, { wrapper: createWrapper() });

    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Aucune notification")).toBeInTheDocument();
    expect(screen.queryByTitle("Tout marquer comme lu")).not.toBeInTheDocument();
    expect(screen.queryByText("Voir toutes les notifications")).not.toBeInTheDocument();
  });

  it("reflète une erreur du hook avec isError=true et un rendu sans données", () => {
    mockUseInAppNotifications.mockReturnValue(ERROR_STATE);

    const { result } = renderHook(() => useInAppNotifications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.notifications).toBe(EMPTY_NOTIFICATIONS);

    render(<NotificationsBell />, { wrapper: createWrapper() });

    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Aucune notification")).toBeInTheDocument();
    expect(markAsReadMock).not.toHaveBeenCalled();
    expect(deleteNotificationMock).not.toHaveBeenCalled();
    expect(markAllAsReadMock).not.toHaveBeenCalled();
  });
});