import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedFiltersPartenaires } from "./UnifiedFiltersPartenaires";

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    ...actual,
    Star: Icon,
    Sparkles: Icon,
    Flame: Icon,
    Gem: Icon,
    User: Icon,
    Building2: Icon,
    Factory: Icon,
    Users: Icon,
    UserCheck: Icon,
    UserPlus: Icon,
    Handshake: Icon,
  };
});

vi.mock("@/components/ui/badge", () => {
  return {
    Badge: ({
      children,
      onClick,
      className,
      "data-testid": dataTestId,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      className?: string;
      "data-testid"?: string;
    }) => (
      <div
        role="button"
        tabIndex={0}
        data-testid={dataTestId ?? "badge"}
        onClick={onClick}
        className={className}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            onClick?.();
          }
        }}
      >
        {children}
      </div>
    ),
  };
});

vi.mock("@/components/ui/tabs", () => {
  return {
    Tabs: ({
      children,
      value,
      onValueChange,
      "data-testid": dataTestId,
    }: {
      children: React.ReactNode;
      value: string;
      onValueChange: (value: string) => void;
      "data-testid"?: string;
    }) => (
      <div data-testid={dataTestId ?? "tabs"} data-value={value}>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child as React.ReactElement, {
            tabsValue: value,
            onValueChange,
          });
        })}
      </div>
    ),
    TabsList: ({
      children,
      className,
      tabsValue,
      onValueChange,
      "data-testid": dataTestId,
    }: {
      children: React.ReactNode;
      className?: string;
      tabsValue?: string;
      onValueChange?: (value: string) => void;
      "data-testid"?: string;
    }) => (
      <div
        data-testid={dataTestId ?? "tabs-list"}
        className={className}
        data-value={tabsValue}
      >
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child as React.ReactElement, {
            tabsValue,
            onValueChange,
          });
        })}
      </div>
    ),
    TabsTrigger: ({
      children,
      value,
      className,
      tabsValue,
      onValueChange,
    }: {
      children: React.ReactNode;
      value: string;
      className?: string;
      tabsValue?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <button
        type="button"
        data-testid={`tabs-trigger-${value}`}
        className={className}
        aria-pressed={tabsValue === value}
        onClick={() => onValueChange && onValueChange(value)}
      >
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/ui/separator", () => {
  return {
    Separator: ({ orientation, className }: { orientation: "vertical" | "horizontal"; className?: string }) => (
      <div data-testid={`separator-${orientation}`} className={className} />
    ),
  };
});

vi.mock("@/lib/utils", () => {
  return {
    cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(" "),
  };
});

describe("UnifiedFiltersPartenaires", () => {
  const defaultCounts = {
    all: 10,
    favorites: 2,
    new: 3,
    toRelance: 1,
    highValue: 4,
    mine: 5,
    institutionnel: 6,
    industriel: 7,
    actifs: 8,
    prospects: 9,
  };

  it("rend les filtres principaux avec les bons compteurs en mode desktop", () => {
    const handleFilterChange = vi.fn();

    render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    expect(screen.getByTestId("tabs")).toBeInTheDocument();
    expect(screen.getByTestId("tabs-list")).toBeInTheDocument();

    expect(screen.getByTestId("tabs-trigger-all")).toHaveTextContent("Tous");
    expect(screen.getByTestId("tabs-trigger-all")).toHaveTextContent(String(defaultCounts.all));

    expect(screen.getByTestId("tabs-trigger-actif")).toHaveTextContent("Actifs");
    expect(screen.getByTestId("tabs-trigger-actif")).toHaveTextContent(String(defaultCounts.actifs));

    expect(screen.getByTestId("tabs-trigger-prospect")).toHaveTextContent("Prospects");
    expect(screen.getByTestId("tabs-trigger-prospect")).toHaveTextContent(String(defaultCounts.prospects));
  });

  it("appelle onFilterChange quand on clique sur un filtre principal en mode desktop", () => {
    const handleFilterChange = vi.fn();

    render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    fireEvent.click(screen.getByTestId("tabs-trigger-actif"));
    expect(handleFilterChange).toHaveBeenCalledWith("actif");

    fireEvent.click(screen.getByTestId("tabs-trigger-prospect"));
    expect(handleFilterChange).toHaveBeenCalledWith("prospect");
  });

  it("rend les smart badges avec label et compteurs en mode desktop", () => {
    const handleFilterChange = vi.fn();

    render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    expect(screen.getByText("Favoris")).toBeInTheDocument();
    expect(screen.getByText(String(defaultCounts.favorites))).toBeInTheDocument();

    expect(screen.getByText("Nouveaux")).toBeInTheDocument();
    expect(screen.getByText(String(defaultCounts.new))).toBeInTheDocument();

    expect(screen.getByText("À relancer")).toBeInTheDocument();
    expect(screen.getByText(String(defaultCounts.toRelance))).toBeInTheDocument();

    expect(screen.getByText("Forte valeur")).toBeInTheDocument();
    expect(screen.getByText(String(defaultCounts.highValue))).toBeInTheDocument();
  });

  it("toggle un smart badge: active -> all, all -> badge.id en mode desktop", () => {
    const handleFilterChange = vi.fn();

    const { rerender } = render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    const favorisBadge = screen.getByText("Favoris").closest("[role='button']");
    expect(favorisBadge).toBeInTheDocument();

    if (!favorisBadge) {
      throw new Error("Favoris badge not found");
    }

    fireEvent.click(favorisBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("favorites");

    rerender(
      <UnifiedFiltersPartenaires
        activeFilter="favorites"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    const favorisBadgeActive = screen.getByText("Favoris").closest("[role='button']");
    if (!favorisBadgeActive) {
      throw new Error("Favoris badge active not found");
    }

    fireEvent.click(favorisBadgeActive);
    expect(handleFilterChange).toHaveBeenCalledWith("all");
  });

  it("rend les filtres de type en mode desktop et déclenche onFilterChange", () => {
    const handleFilterChange = vi.fn();

    render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    const institBadge = screen.getByText("Instit.").closest("[role='button']");
    const industBadge = screen.getByText("Indust.").closest("[role='button']");
    const mineBadge = screen.getByText("Mes part.").closest("[role='button']");

    expect(institBadge).toBeInTheDocument();
    expect(industBadge).toBeInTheDocument();
    expect(mineBadge).toBeInTheDocument();

    if (!institBadge || !industBadge || !mineBadge) {
      throw new Error("Type filter badges not found");
    }

    fireEvent.click(institBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("institutionnel_only");

    fireEvent.click(industBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("industriel_only");

    fireEvent.click(mineBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("mine");
  });

  it("toggle un filtre de type: active -> all", () => {
    const handleFilterChange = vi.fn();

    const { rerender } = render(
      <UnifiedFiltersPartenaires
        activeFilter="institutionnel_only"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    const institBadge = screen.getByText("Instit.").closest("[role='button']");
    if (!institBadge) {
      throw new Error("Instit. badge not found");
    }

    fireEvent.click(institBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("all");

    rerender(
      <UnifiedFiltersPartenaires
        activeFilter="mine"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    const mineBadge = screen.getByText("Mes part.").closest("[role='button']");
    if (!mineBadge) {
      throw new Error("Mes part. badge not found");
    }

    fireEvent.click(mineBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("all");
  });

  it("en mode compact rend uniquement les badges principaux et smart avec compteurs", () => {
    const handleFilterChange = vi.fn();

    render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={true}
      />
    );

    expect(screen.queryByTestId("tabs")).not.toBeInTheDocument();

    const allCount = screen.getAllByText(String(defaultCounts.all))[0];
    expect(allCount).toBeInTheDocument();

    const actifsCount = screen.getAllByText(String(defaultCounts.actifs))[0];
    expect(actifsCount).toBeInTheDocument();

    const prospectsCount = screen.getAllByText(String(defaultCounts.prospects))[0];
    expect(prospectsCount).toBeInTheDocument();

    expect(screen.getByText(String(defaultCounts.favorites))).toBeInTheDocument();
    expect(screen.getByText(String(defaultCounts.new))).toBeInTheDocument();
    expect(screen.getByText(String(defaultCounts.toRelance))).toBeInTheDocument();
    expect(screen.getByText(String(defaultCounts.highValue))).toBeInTheDocument();
  });

  it("en mode compact clique sur un filtre principal appelle onFilterChange avec l'id", () => {
    const handleFilterChange = vi.fn();

    render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={true}
      />
    );

    const badges = screen.getAllByTestId("badge");

    const actifBadge = badges.find((badge) => badge.textContent === String(defaultCounts.actifs));
    const prospectBadge = badges.find((badge) => badge.textContent === String(defaultCounts.prospects));

    expect(actifBadge).toBeDefined();
    expect(prospectBadge).toBeDefined();

    if (!actifBadge || !prospectBadge) {
      throw new Error("Compact main badges not found");
    }

    fireEvent.click(actifBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("actif");

    fireEvent.click(prospectBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("prospect");
  });

  it("en mode compact toggle un smart badge favorites", () => {
    const handleFilterChange = vi.fn();

    const { rerender } = render(
      <UnifiedFiltersPartenaires
        activeFilter="all"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={true}
      />
    );

    const favoritesBadge = screen.getAllByText(String(defaultCounts.favorites))[0].closest("[role='button']");
    if (!favoritesBadge) {
      throw new Error("Favorites badge not found in compact mode");
    }

    fireEvent.click(favoritesBadge);
    expect(handleFilterChange).toHaveBeenCalledWith("favorites");

    rerender(
      <UnifiedFiltersPartenaires
        activeFilter="favorites"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={true}
      />
    );

    const favoritesBadgeActive = screen.getAllByText(String(defaultCounts.favorites))[0].closest("[role='button']");
    if (!favoritesBadgeActive) {
      throw new Error("Favorites badge active not found in compact mode");
    }

    fireEvent.click(favoritesBadgeActive);
    expect(handleFilterChange).toHaveBeenCalledWith("all");
  });

  it("utilise 'all' comme filtre principal courant quand activeFilter est un filtre secondaire", () => {
    const handleFilterChange = vi.fn();

    render(
      <UnifiedFiltersPartenaires
        activeFilter="favorites"
        onFilterChange={handleFilterChange}
        counts={defaultCounts}
        compact={false}
      />
    );

    expect(screen.getByTestId("tabs-list")).toBeInTheDocument();
    expect(screen.getByTestId("tabs-trigger-all")).toBeInTheDocument();
  });
});
