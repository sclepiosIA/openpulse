const { safeStorageMock } = vi.hoisted(() => ({
  safeStorageMock: {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
    clear: vi.fn<() => void>(),
  },
}));

vi.mock("@/lib/safeStorage", () => ({
  safeStorage: safeStorageMock,
}));

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { DebugBanner } from "./DebugBanner";

let navigatorOnline = true;

function setUrl(url: string) {
  window.history.pushState({}, "", url);
}

function setNavigatorOnline(value: boolean) {
  navigatorOnline = value;
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => navigatorOnline,
  });
}

async function expectBannerText(expected: string) {
  await waitFor(() => {
    const banner = screen.getByText(/App monté:/);
    expect(banner.textContent).toBe(expected);
  });
}

describe("DebugBanner", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.stubEnv("DEV", false);
    safeStorageMock.getItem.mockReset();
    safeStorageMock.getItem.mockReturnValue(null);
    safeStorageMock.setItem.mockReset();
    safeStorageMock.removeItem.mockReset();
    safeStorageMock.clear.mockReset();
    setNavigatorOnline(true);
    setUrl("/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("ne rend rien quand le mode debug est désactivé", () => {
    setUrl("/accueil");
    safeStorageMock.getItem.mockReturnValue(null);

    const { container } = render(<DebugBanner />);

    expect(container.firstChild).toBeNull();
    expect(safeStorageMock.getItem).toHaveBeenCalledWith("debug");
  });

  it("affiche la bannière en environnement DEV avec l'état monté, online et la route courante", async () => {
    vi.stubEnv("DEV", true);
    setUrl("/dev");
    setNavigatorOnline(true);

    render(<DebugBanner />);

    await expectBannerText("App monté: ✓ | Online: oui | Route: /dev");
    expect(safeStorageMock.getItem).not.toHaveBeenCalled();
  });

  it("active la bannière quand safeStorage contient debug=1", async () => {
    setUrl("/stockage");
    safeStorageMock.getItem.mockReturnValue("1");

    render(<DebugBanner />);

    await expectBannerText("App monté: ✓ | Online: oui | Route: /stockage");
    expect(safeStorageMock.getItem).toHaveBeenCalledWith("debug");
  });

  it("active la bannière quand le paramètre d'URL debug=1 est présent", async () => {
    setUrl("/recherche?debug=1");
    safeStorageMock.getItem.mockReturnValue("0");

    render(<DebugBanner />);

    await expectBannerText("App monté: ✓ | Online: oui | Route: /recherche");
    expect(safeStorageMock.getItem).toHaveBeenCalledWith("debug");
  });

  it("met à jour l'état online lors des événements offline et online", async () => {
    setUrl("/reseau");
    safeStorageMock.getItem.mockReturnValue("1");
    setNavigatorOnline(true);

    render(<DebugBanner />);

    await expectBannerText("App monté: ✓ | Online: oui | Route: /reseau");

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    await expectBannerText("App monté: ✓ | Online: non | Route: /reseau");

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await expectBannerText("App monté: ✓ | Online: oui | Route: /reseau");
  });

  it("met à jour la route affichée lors d'un événement popstate", async () => {
    setUrl("/premiere");
    safeStorageMock.getItem.mockReturnValue("1");

    render(<DebugBanner />);

    await expectBannerText("App monté: ✓ | Online: oui | Route: /premiere");

    await act(async () => {
      setUrl("/seconde");
      window.dispatchEvent(new Event("popstate"));
    });

    await expectBannerText("App monté: ✓ | Online: oui | Route: /seconde");
  });

  it("désenregistre les écouteurs d'événements au démontage", () => {
    safeStorageMock.getItem.mockReturnValue("1");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<DebugBanner />);
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("popstate", expect.any(Function));
  });
});