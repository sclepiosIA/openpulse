/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { ForumFilters } from "./ForumFilters";

const { badgeCalls, cnMock } = vi.hoisted(() => {
  return {
    badgeCalls: [] as Array<{ variant?: string; className?: string }>,
    cnMock: vi.fn((...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(" ")
    ),
  };
});

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    variant,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
    onClick?: () => void;
  }) => {
    badgeCalls.push({ variant, className });
    return (
      <button data-variant={variant} className={className} onClick={onClick}>
        {children}
      </button>
    );
  },
}));

vi.mock("lucide-react", () => {
  const makeIcon = (name: string) =>
    ({ className }: { className?: string }) =>
      <svg data-testid={`icon-${name}`} className={className} aria-hidden="true" />;

  return {
    FileBarChart: makeIcon("FileBarChart"),
    Heart: makeIcon("Heart"),
    AlertCircle: makeIcon("AlertCircle"),
    FileCheck: makeIcon("FileCheck"),
    Mic: makeIcon("Mic"),
    Lightbulb: makeIcon("Lightbulb"),
    Bug: makeIcon("Bug"),
    HelpCircle: makeIcon("HelpCircle"),
    MoreHorizontal: makeIcon("MoreHorizontal"),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
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

describe("ForumFilters", () => {
  beforeEach(() => {
    badgeCalls.length = 0;
    cnMock.mockClear();
  });

  it("renderHook fonctionne avec le wrapper QueryClientProvider requis", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => "ready", { wrapper });

    expect(result.current).toBe("ready");
  });

  it("affiche le filtre Tous avec le total calculé et chaque thème avec son libellé et son compteur", () => {
    const onThemeSelect = vi.fn();
    const themeCounts = {
      pmsi: 2,
      smr: 1,
      urgences: 3,
      completion_dossier: 4,
      dictee_vocale: 0,
      astuces: 5,
      bugs: 1,
      support: 2,
      autre: 6,
    };

    render(
      <ForumFilters
        selectedTheme={null}
        onThemeSelect={onThemeSelect}
        themeCounts={themeCounts}
      />
    );

    expect(screen.getByRole("button", { name: /Tous\s*\(24\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PMSI\s*\(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SMR\s*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Urgences\s*\(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Complétion dossier\s*\(4\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dictée vocale\s*\(0\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Astuces\s*\(5\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bugs\s*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Support\s*\(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Autre\s*\(6\)/ })).toBeInTheDocument();

    expect(screen.getByTestId("icon-FileBarChart")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Heart")).toBeInTheDocument();
    expect(screen.getByTestId("icon-AlertCircle")).toBeInTheDocument();
    expect(screen.getByTestId("icon-FileCheck")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Mic")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Lightbulb")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Bug")).toBeInTheDocument();
    expect(screen.getByTestId("icon-HelpCircle")).toBeInTheDocument();
    expect(screen.getByTestId("icon-MoreHorizontal")).toBeInTheDocument();
  });

  it("applique variant=default et shadow-sm au filtre Tous quand aucun thème n'est sélectionné", () => {
    render(
      <ForumFilters
        selectedTheme={null}
        onThemeSelect={vi.fn()}
        themeCounts={{}}
      />
    );

    const tousButton = screen.getByRole("button", { name: /Tous\s*\(0\)/ });
    expect(tousButton).toHaveAttribute("data-variant", "default");
    expect(tousButton.className).toContain("shadow-sm");

    const pmsiButton = screen.getByRole("button", { name: /PMSI\s*\(0\)/ });
    expect(pmsiButton).toHaveAttribute("data-variant", "outline");
    expect(pmsiButton.className).not.toContain("shadow-sm");
  });

  it("applique variant=default et shadow-sm au thème sélectionné, avec Tous en outline", () => {
    render(
      <ForumFilters
        selectedTheme="bugs"
        onThemeSelect={vi.fn()}
        themeCounts={{ bugs: 7, support: 1 }}
      />
    );

    const tousButton = screen.getByRole("button", { name: /Tous\s*\(8\)/ });
    const bugsButton = screen.getByRole("button", { name: /Bugs\s*\(7\)/ });
    const supportButton = screen.getByRole("button", { name: /Support\s*\(1\)/ });

    expect(tousButton).toHaveAttribute("data-variant", "outline");
    expect(tousButton.className).not.toContain("shadow-sm");

    expect(bugsButton).toHaveAttribute("data-variant", "default");
    expect(bugsButton.className).toContain("shadow-sm");

    expect(supportButton).toHaveAttribute("data-variant", "outline");
    expect(supportButton.className).not.toContain("shadow-sm");
  });

  it("utilise 0 par défaut pour les thèmes absents de themeCounts", () => {
    render(
      <ForumFilters
        selectedTheme="support"
        onThemeSelect={vi.fn()}
        themeCounts={{ support: 9 }}
      />
    );

    expect(screen.getByRole("button", { name: /Tous\s*\(9\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PMSI\s*\(0\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Urgences\s*\(0\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Support\s*\(9\)/ })).toBeInTheDocument();
  });

  it("déclenche onThemeSelect(null) au clic sur Tous et onThemeSelect(theme) au clic sur un thème", () => {
    const onThemeSelect = vi.fn();

    render(
      <ForumFilters
        selectedTheme={null}
        onThemeSelect={onThemeSelect}
        themeCounts={{ pmsi: 2, bugs: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Tous\s*\(3\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /PMSI\s*\(2\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bugs\s*\(1\)/ }));

    expect(onThemeSelect).toHaveBeenNthCalledWith(1, null);
    expect(onThemeSelect).toHaveBeenNthCalledWith(2, "pmsi");
    expect(onThemeSelect).toHaveBeenNthCalledWith(3, "bugs");
  });

  it("passe les classes attendues via cn pour Tous et les thèmes", () => {
    render(
      <ForumFilters
        selectedTheme="smr"
        onThemeSelect={vi.fn()}
        themeCounts={{ smr: 2 }}
      />
    );

    expect(cnMock).toHaveBeenCalled();
    expect(cnMock).toHaveBeenCalledWith(
      "cursor-pointer transition-all hover:scale-105",
      false
    );
    expect(cnMock).toHaveBeenCalledWith(
      "cursor-pointer transition-all hover:scale-105 flex items-center gap-1.5",
      false
    );
    expect(cnMock).toHaveBeenCalledWith(
      "cursor-pointer transition-all hover:scale-105 flex items-center gap-1.5",
      "shadow-sm"
    );
  });
});