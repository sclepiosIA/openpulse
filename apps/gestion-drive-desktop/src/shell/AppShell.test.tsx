// Tests du shell multi-app : sidebar, état activeApp, module Drive par
// défaut, placeholders et préférences.

import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AppShell from "./AppShell";
import { useAppStore } from "../state/store";

beforeEach(() => {
  cleanup();
  // Réinitialise le store global entre les tests (Zustand est un singleton).
  useAppStore.setState({
    activeApp: "drive",
    screen: "login",
    session: null,
    config: null,
    spaces: [],
    selectedSpaceIds: [],
  });
});

describe("AppShell", () => {
  it("affiche le branding et les 7 entrées de la sidebar", () => {
    render(<AppShell />);
    expect(screen.getByText("Gestion Desktop")).toBeTruthy();
    expect(screen.getByText("par OpenPulse")).toBeTruthy();
    for (const label of [
      "Drive",
      "Pulse",
      "Mail",
      "Todo",
      "Calendrier",
      "Documents IA",
      "Préférences",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it("ouvre le module Drive par défaut (onboarding : écran de connexion)", () => {
    render(<AppShell />);
    expect(useAppStore.getState().activeApp).toBe("drive");
    expect(screen.getByRole("heading", { name: "Connexion" })).toBeTruthy();
  });

  it("bascule vers un placeholder avec action « Ouvrir dans Gestion web »", () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: /Pulse/ }));
    expect(useAppStore.getState().activeApp).toBe("pulse");
    expect(screen.getByRole("heading", { name: "Pulse" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ouvrir dans Gestion web" }),
    ).toBeTruthy();
  });

  it("marque le module actif dans la sidebar (aria-current)", () => {
    render(<AppShell />);
    const drive = screen.getByRole("button", { name: /Drive/ });
    expect(drive.getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: /Mail/ }));
    expect(drive.getAttribute("aria-current")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Mail/ }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("affiche les Préférences depuis l'entrée épinglée", () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: /Préférences/ }));
    expect(screen.getByRole("heading", { name: "Préférences" })).toBeTruthy();
    expect(screen.getByText("non connecté")).toBeTruthy();
  });

  it("préserve l'étape Drive quand on navigue entre modules", () => {
    render(<AppShell />);
    useAppStore.getState().setScreen("status");
    fireEvent.click(screen.getByRole("button", { name: /Todo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Drive/ }));
    expect(useAppStore.getState().screen).toBe("status");
    expect(
      screen.getByRole("heading", { name: "Synchronisation" }),
    ).toBeTruthy();
  });
});
