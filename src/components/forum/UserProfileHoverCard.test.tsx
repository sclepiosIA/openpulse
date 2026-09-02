/* @vitest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProfileHoverCard } from "./UserProfileHoverCard";

const { STATS, EMPTY_STATS, mockUseForumUserStats } = vi.hoisted(() => ({
  STATS: {
    posts_count: 12,
    comments_count: 34,
    reputation_score: 56,
    badges: [
      { name: "Expert", icon: "⭐", description: "Contributeur expert" },
      { name: "Actif", icon: "🔥", description: "Très actif" },
    ],
  },
  EMPTY_STATS: undefined,
  mockUseForumUserStats: vi.fn(),
}));

vi.mock("@/hooks/forum/useForumBookmarks", () => ({
  useForumUserStats: mockUseForumUserStats,
}));

vi.mock("./ForumAvatar", () => ({
  ForumAvatar: ({ nom, prenom, className }: { nom?: string; prenom?: string; className?: string }) => (
    <div data-testid="forum-avatar" data-nom={nom ?? ""} data-prenom={prenom ?? ""} className={className}>
      avatar
    </div>
  ),
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card">{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-trigger">{children}</div>,
  HoverCardContent: ({ children, className, side }: { children: React.ReactNode; className?: string; side?: string }) => (
    <div data-testid="hover-card-content" data-class={className ?? ""} data-side={side ?? ""}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    title,
    variant,
    className,
  }: {
    children: React.ReactNode;
    title?: string;
    variant?: string;
    className?: string;
  }) => (
    <div data-testid="badge" data-title={title ?? ""} data-variant={variant ?? ""} data-class={className ?? ""}>
      {children}
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  MessageSquare: () => <svg data-testid="icon-message-square" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
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

describe("UserProfileHoverCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les informations utilisateur, les statistiques et les badges", () => {
    mockUseForumUserStats.mockReturnValue({
      data: STATS,
      isLoading: false,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <UserProfileHoverCard
        userId="user-1"
        nom="Dupont"
        prenom="Jean"
        role="Médecin"
        service="Cardiologie"
        etablissement="Hôpital Central"
      >
        <button type="button">Voir profil</button>
      </UserProfileHoverCard>,
      { wrapper: Wrapper }
    );

    expect(mockUseForumUserStats).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Médecin")).toBeInTheDocument();
    expect(screen.getByText("Voir profil")).toBeInTheDocument();

    expect(screen.getByText("Service:")).toBeInTheDocument();
    expect(screen.getByText("Cardiologie")).toBeInTheDocument();
    expect(screen.getByText("Établissement:")).toBeInTheDocument();
    expect(screen.getByText("Hôpital Central")).toBeInTheDocument();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("34")).toBeInTheDocument();
    expect(screen.getByText("56")).toBeInTheDocument();
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("Commentaires")).toBeInTheDocument();
    expect(screen.getByText("Réputation")).toBeInTheDocument();

    expect(screen.getByText("Badges")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();

    const badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveAttribute("data-title", "Contributeur expert");
    expect(badges[1]).toHaveAttribute("data-title", "Très actif");

    const avatar = screen.getByTestId("forum-avatar");
    expect(avatar).toHaveAttribute("data-nom", "Dupont");
    expect(avatar).toHaveAttribute("data-prenom", "Jean");
  });

  it("n'affiche pas les sections optionnelles quand les props et stats sont absentes", () => {
    mockUseForumUserStats.mockReturnValue({
      data: EMPTY_STATS,
      isLoading: false,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <UserProfileHoverCard userId={null} nom="Martin" prenom="Anne">
        <span>Déclencheur</span>
      </UserProfileHoverCard>,
      { wrapper: Wrapper }
    );

    expect(mockUseForumUserStats).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Anne Martin")).toBeInTheDocument();
    expect(screen.queryByText("Service:")).not.toBeInTheDocument();
    expect(screen.queryByText("Établissement:")).not.toBeInTheDocument();
    expect(screen.queryByText("Posts")).not.toBeInTheDocument();
    expect(screen.queryByText("Commentaires")).not.toBeInTheDocument();
    expect(screen.queryByText("Réputation")).not.toBeInTheDocument();
    expect(screen.queryByText("Badges")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("badge")).toHaveLength(0);
  });

  it("affiche les statistiques sans badges quand la liste est vide", () => {
    mockUseForumUserStats.mockReturnValue({
      data: { ...STATS, badges: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <UserProfileHoverCard userId="user-2" nom="Bernard" prenom="Luc" service="Urgences">
        <span>Profil</span>
      </UserProfileHoverCard>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText("Luc Bernard")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("34")).toBeInTheDocument();
    expect(screen.getByText("56")).toBeInTheDocument();
    expect(screen.queryByText("Badges")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("badge")).toHaveLength(0);
  });
});