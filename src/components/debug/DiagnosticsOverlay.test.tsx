// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DiagnosticsOverlay } from "./DiagnosticsOverlay";

const {
  authState,
  mockUseLocation,
  mockGetItem,
  mockClear,
  mockGetRegistrations,
  mockUnregisterA,
  mockUnregisterB,
  mockReload,
} = vi.hoisted(() => ({
  authState: {
    user: { id: "u1", email: "user@test.co" } as { id: string; email?: string } | null,
    loading: false,
  },
  mockUseLocation: vi.fn(() => ({ pathname: "/diagnostics" })),
  mockGetItem: vi.fn(() => "1" as string | null),
  mockClear: vi.fn(),
  mockGetRegistrations: vi.fn(() =>
    Promise.resolve([
      { unregister: vi.fn(() => Promise.resolve(true)) },
      { unregister: vi.fn(() => Promise.resolve(true)) },
    ]),
  ),
  mockUnregisterA: vi.fn(() => Promise.resolve(true)),
  mockUnregisterB: vi.fn(() => Promise.resolve(true)),
  mockReload: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: mockGetItem,
    clear: mockClear,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useLocation: mockUseLocation,
  };
});

vi.mock("lucide-react", () => ({
  Bug: () => React.createElement("svg", { "data-testid": "bug-icon" }),
  X: () => React.createElement("svg", { "data-testid": "x-icon" }),
}));

describe("DiagnosticsOverlay", () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
  const originalLocation = window.location;
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    authState.user = { id: "u1", email: "user@test.co" };
    authState.loading = false;

    mockUseLocation.mockReset();
    mockUseLocation.mockReturnValue({ pathname: "/diagnostics" });

    mockGetItem.mockReset();
    mockGetItem.mockReturnValue("1");

    mockClear.mockReset();

    mockUnregisterA.mockClear();
    mockUnregisterB.mockClear();

    mockGetRegistrations.mockReset();
    mockGetRegistrations.mockResolvedValue([
      { unregister: mockUnregisterA },
      { unregister: mockUnregisterB },
    ]);

    mockReload.mockReset();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: mockGetRegistrations,
      },
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        search: "",
        reload: mockReload,
      },
    });

    vi.stubEnv("DEV", false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });

    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: originalServiceWorker,
      });
    }

    if (originalOnLine) {
      Object.defineProperty(window.navigator, "onLine", originalOnLine);
    }
  });

  it("ne rend rien si le mode debug est désactivé", () => {
    mockGetItem.mockReturnValue(null);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        search: "",
        reload: mockReload,
      },
    });

    const { container } = render(
      <MemoryRouter>
        <DiagnosticsOverlay />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByLabelText("Ouvrir le diagnostic")).not.toBeInTheDocument();
  });

  it("rend l'overlay si debug=1 est présent dans l'url même sans storage", () => {
    mockGetItem.mockReturnValue(null);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        search: "?debug=1",
        reload: mockReload,
      },
    });

    render(
      <MemoryRouter>
        <DiagnosticsOverlay />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Ouvrir le diagnostic")).toBeInTheDocument();
  });

  it("affiche le bouton puis le panneau avec les informations métier réelles", () => {
    mockUseLocation.mockReturnValue({ pathname: "/settings/profile" });
    authState.user = { id: "u1", email: "alpha@test.co" };
    authState.loading = false;

    render(
      <MemoryRouter>
        <DiagnosticsOverlay />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Ouvrir le diagnostic")).toBeInTheDocument();
    expect(screen.queryByText("Diagnostics")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Ouvrir le diagnostic"));

    expect(screen.getByText("Diagnostics")).toBeInTheDocument();
    expect(screen.getByText("Route")).toBeInTheDocument();
    expect(screen.getByText("/settings/profile")).toBeInTheDocument();
    expect(screen.getByText("Auth chargé")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText("Utilisateur")).toBeInTheDocument();
    expect(screen.getByText("alpha@test.co")).toBeInTheDocument();
    expect(screen.getByText("En ligne")).toBeInTheDocument();
    expect(screen.getByText("oui")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hard Reset (cache + SW)" })).toBeInTheDocument();
  });

  it("affiche l'état de chargement auth et 'aucun' sans utilisateur", () => {
    authState.user = null;
    authState.loading = true;

    render(
      <MemoryRouter>
        <DiagnosticsOverlay />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Ouvrir le diagnostic"));

    expect(screen.getByText("en cours")).toBeInTheDocument();
    expect(screen.getByText("aucun")).toBeInTheDocument();
  });

  it("met à jour le statut en ligne lors des événements offline/online", () => {
    render(
      <MemoryRouter>
        <DiagnosticsOverlay />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Ouvrir le diagnostic"));
    expect(screen.getByText("oui")).toBeInTheDocument();

    fireEvent(window, new Event("offline"));
    expect(screen.getByText("non")).toBeInTheDocument();

    fireEvent(window, new Event("online"));
    expect(screen.getByText("oui")).toBeInTheDocument();
  });

  it("ferme le panneau quand on clique sur le bouton de fermeture", () => {
    render(
      <MemoryRouter>
        <DiagnosticsOverlay />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Ouvrir le diagnostic"));
    expect(screen.getByText("Diagnostics")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Fermer le diagnostic"));

    expect(screen.queryByText("Diagnostics")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ouvrir le diagnostic")).toBeInTheDocument();
  });

  it("exécute le hard reset: clear le storage, désenregistre les SW et recharge la page", async () => {
    render(
      <MemoryRouter>
        <DiagnosticsOverlay />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Ouvrir le diagnostic"));
    fireEvent.click(screen.getByRole("button", { name: "Hard Reset (cache + SW)" }));

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockGetRegistrations).toHaveBeenCalledTimes(1);
    expect(mockReload).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mockUnregisterA).toHaveBeenCalledTimes(1);
      expect(mockUnregisterB).toHaveBeenCalledTimes(1);
    });
  });
});