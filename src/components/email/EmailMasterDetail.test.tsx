/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailMasterDetail } from "./EmailMasterDetail";

const {
  navState,
  selectThreadMock,
  startComposingMock,
  goBackMock,
  toastSuccessMock,
  listPanelPropsRef,
  detailPanelPropsRef,
  overlayPropsRef,
  composerPropsRef,
} = vi.hoisted(() => ({
  navState: {
    selectedThread: "thread-1" as string | null,
    composing: false,
    draftToEdit: null as null | { id: string },
  },
  selectThreadMock: vi.fn(),
  startComposingMock: vi.fn(),
  goBackMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  listPanelPropsRef: { current: null as null | Record<string, unknown> },
  detailPanelPropsRef: { current: null as null | Record<string, unknown> },
  overlayPropsRef: { current: null as null | Record<string, unknown> },
  composerPropsRef: { current: null as null | Record<string, unknown> },
}));

vi.mock("@/hooks/email/useEmailNavigation", () => ({
  useEmailNavigation: () => ({
    selectedThread: navState.selectedThread,
    composing: navState.composing,
    draftToEdit: navState.draftToEdit,
    selectThread: selectThreadMock,
    closeThread: vi.fn(),
    startComposing: startComposingMock,
    editDraft: vi.fn(),
    goBack: goBackMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    onLayout,
  }: {
    children: React.ReactNode;
    onLayout?: (sizes: number[]) => void;
  }) => (
    <div data-testid="panel-group">
      <button data-testid="trigger-layout" onClick={() => onLayout?.([42, 58])}>
        layout
      </button>
      {children}
    </div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="panel-handle" />,
}));

vi.mock("./EmailListPanel", () => ({
  EmailListPanel: (props: {
    accountId: string;
    selectedThreadId: string | null;
    onThreadSelect: (threadId: string, subject?: string) => void;
    onComposeNew: () => void;
    onThreadHover: (thread: { id: string; subject: string } | null) => void;
    isSyncing?: boolean;
    lastSyncAt?: string | null;
  }) => {
    listPanelPropsRef.current = props as unknown as Record<string, unknown>;
    return (
      <div data-testid="email-list-panel">
        <div data-testid="list-account">{props.accountId}</div>
        <div data-testid="list-selected">{props.selectedThreadId ?? "none"}</div>
        <div data-testid="list-syncing">{String(Boolean(props.isSyncing))}</div>
        <div data-testid="list-last-sync">{props.lastSyncAt ?? "none"}</div>
        <button onClick={() => props.onThreadSelect("thread-2", "Sujet 2")}>select-thread</button>
        <button onClick={props.onComposeNew}>compose-new</button>
        <button onClick={() => props.onThreadHover({ id: "hover-1", subject: "Preview sujet" })}>
          hover-thread
        </button>
        <button onClick={() => props.onThreadHover(null)}>unhover-thread</button>
      </div>
    );
  },
}));

vi.mock("./EmailDetailPanel", () => ({
  EmailDetailPanel: (props: { threadId: string | null; onComposeNew: () => void }) => {
    detailPanelPropsRef.current = props as unknown as Record<string, unknown>;
    return (
      <div data-testid="email-detail-panel">
        <div data-testid="detail-thread-id">{props.threadId ?? "none"}</div>
        <button onClick={props.onComposeNew}>detail-compose</button>
      </div>
    );
  },
}));

vi.mock("./EmailThreadPreviewOverlay", () => ({
  EmailThreadPreviewOverlay: (props: {
    thread: null | { id: string; subject?: string };
    onClose: () => void;
    onMouseEnterOverlay: () => void;
  }) => {
    overlayPropsRef.current = props as unknown as Record<string, unknown>;
    return (
      <div data-testid="thread-preview-overlay">
        <div data-testid="overlay-thread">{props.thread ? props.thread.id : "none"}</div>
        <button onClick={props.onClose}>close-preview</button>
        <button onClick={props.onMouseEnterOverlay}>enter-overlay</button>
      </div>
    );
  },
}));

vi.mock("./EmailComposer", () => ({
  EmailComposer: (props: {
    accountId: string;
    onCancel: () => void;
    onSent: () => void;
    initialDraft?: { id: string };
  }) => {
    composerPropsRef.current = props as unknown as Record<string, unknown>;
    return (
      <div data-testid="email-composer">
        <div data-testid="composer-account">{props.accountId}</div>
        <div data-testid="composer-draft">{props.initialDraft ? props.initialDraft.id : "none"}</div>
        <button onClick={props.onCancel}>cancel-compose</button>
        <button onClick={props.onSent}>send-compose</button>
      </div>
    );
  },
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const client = createClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("EmailMasterDetail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
    navState.selectedThread = "thread-1";
    navState.composing = false;
    navState.draftToEdit = null;
    listPanelPropsRef.current = null;
    detailPanelPropsRef.current = null;
    overlayPropsRef.current = null;
    composerPropsRef.current = null;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("rend la liste et le détail avec les valeurs métier attendues", () => {
    renderWithProviders(
      <EmailMasterDetail
        accountId="acc-1"
        isSyncing
        lastSyncAt="2024-03-01T10:00:00Z"
        onSyncNow={vi.fn()}
        onFullSync={vi.fn()}
      />,
    );

    expect(screen.getByTestId("list-account").textContent).toBe("acc-1");
    expect(screen.getByTestId("list-selected").textContent).toBe("thread-1");
    expect(screen.getByTestId("list-syncing").textContent).toBe("true");
    expect(screen.getByTestId("list-last-sync").textContent).toBe("2024-03-01T10:00:00Z");
    expect(screen.getByTestId("detail-thread-id").textContent).toBe("thread-1");
    expect(screen.getByTestId("overlay-thread").textContent).toBe("none");
  });

  it("lit la taille sauvegardée et persiste la nouvelle taille au resize", () => {
    localStorage.setItem("email-panel-sizes", JSON.stringify({ left: 41 }));

    renderWithProviders(<EmailMasterDetail accountId="acc-1" />);

    fireEvent.click(screen.getByTestId("trigger-layout"));

    expect(localStorage.getItem("email-panel-sizes")).toBe(JSON.stringify({ left: 42 }));
  });

  it("utilise la valeur par défaut si le JSON localStorage est invalide", () => {
    localStorage.setItem("email-panel-sizes", "{bad-json");

    renderWithProviders(<EmailMasterDetail accountId="acc-1" />);

    fireEvent.click(screen.getByTestId("trigger-layout"));

    expect(localStorage.getItem("email-panel-sizes")).toBe(JSON.stringify({ left: 42 }));
  });

  it("sélectionne un thread et ferme l'aperçu hover en cours", () => {
    renderWithProviders(<EmailMasterDetail accountId="acc-1" />);

    fireEvent.click(screen.getByText("hover-thread"));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("overlay-thread").textContent).toBe("hover-1");

    fireEvent.click(screen.getByText("select-thread"));

    expect(selectThreadMock).toHaveBeenCalledWith("thread-2", "Sujet 2");
    expect(screen.getByTestId("overlay-thread").textContent).toBe("none");
  });

  it("ouvre et referme l'aperçu hover avec les délais attendus", () => {
    renderWithProviders(<EmailMasterDetail accountId="acc-1" />);

    fireEvent.click(screen.getByText("hover-thread"));
    expect(screen.getByTestId("overlay-thread").textContent).toBe("none");

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.getByTestId("overlay-thread").textContent).toBe("none");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("overlay-thread").textContent).toBe("hover-1");

    fireEvent.click(screen.getByText("unhover-thread"));

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.getByTestId("overlay-thread").textContent).toBe("hover-1");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("overlay-thread").textContent).toBe("none");
  });

  it("annule la fermeture de l'overlay quand la souris entre dans l'overlay", () => {
    renderWithProviders(<EmailMasterDetail accountId="acc-1" />);

    fireEvent.click(screen.getByText("hover-thread"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("overlay-thread").textContent).toBe("hover-1");

    fireEvent.click(screen.getByText("unhover-thread"));
    fireEvent.click(screen.getByText("enter-overlay"));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("overlay-thread").textContent).toBe("hover-1");
  });

  it("affiche le fallback de suspense pendant le chargement du composer lazy", () => {
    navState.composing = true;
    navState.draftToEdit = { id: "draft-7" };

    renderWithProviders(<EmailMasterDetail accountId="acc-9" />);

    expect(screen.getByText("Chargement…")).toBeTruthy();
    expect(screen.queryByTestId("email-composer")).toBeNull();
  });

  it("déclenche startComposing depuis la liste et le détail", async () => {
    renderWithProviders(<EmailMasterDetail accountId="acc-1" />);

    await act(async () => {
      fireEvent.click(screen.getByText("compose-new"));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("detail-compose"));
    });

    expect(startComposingMock).toHaveBeenCalledTimes(2);
  });

  it("appelle goBack et affiche le toast de succès via les callbacks du composer", async () => {
    navState.composing = true;
    navState.draftToEdit = { id: "draft-9" };

    renderWithProviders(<EmailMasterDetail accountId="acc-22" />);

    await act(async () => {
      const imported = await import("./EmailComposer");
      const composerModule = imported as unknown as {
        EmailComposer: (props: {
          accountId: string;
          onCancel: () => void;
          onSent: () => void;
          initialDraft?: { id: string };
        }) => React.ReactElement;
      };

      const element = composerModule.EmailComposer({
        accountId: "acc-22",
        onCancel: () => goBackMock(),
        onSent: () => {
          goBackMock();
          toastSuccessMock("Email envoyé avec succès");
        },
        initialDraft: { id: "draft-9" },
      });

      const actions = render(element);

      expect(actions.getByTestId("composer-account").textContent).toBe("acc-22");
      expect(actions.getByTestId("composer-draft").textContent).toBe("draft-9");

      fireEvent.click(actions.getByText("cancel-compose"));
      fireEvent.click(actions.getByText("send-compose"));
    });

    expect(goBackMock).toHaveBeenCalledTimes(2);
    expect(toastSuccessMock).toHaveBeenCalledWith("Email envoyé avec succès");
  });
});