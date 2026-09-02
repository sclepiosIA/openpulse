// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnhancedPartenaireCard } from "./EnhancedPartenaireCard";

const {
  navigateMock,
  onToggleFavoriteMock,
  stableAuth,
  stableSession,
  mockFrom,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  onToggleFavoriteMock: vi.fn(),
  stableAuth: { user: { id: "u1", email: "t@t.co" }, isLoading: false },
  stableSession: { user: { id: "u1" } },
  mockFrom: vi.fn(() => {
    const builder: {
      select: () => typeof builder;
      eq: () => typeof builder;
      gte: () => typeof builder;
      lte: () => typeof builder;
      in: () => typeof builder;
      order: () => typeof builder;
      limit: () => typeof builder;
      insert: () => typeof builder;
      update: () => typeof builder;
      delete: () => typeof builder;
      single: () => Promise<{ data: null; error: null }>;
      maybeSingle: () => Promise<{ data: null; error: null }>;
      then: (onFulfilled?: (value: { data: null; error: null }) => unknown) => Promise<unknown>;
      catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    } = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected) => Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Mail: Icon,
    Star: Icon,
    Phone: Icon,
    MapPin: Icon,
    Calendar: Icon,
    AlertCircle: Icon,
    Sparkles: Icon,
  };
});

vi.mock("@/components/ui/partenaire-badge", () => ({
  PartenaireBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "il y a 10 jours",
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("./PartenaireQuickActions", () => ({
  PartenaireQuickActions: ({ partenaireId, partenaireName }: { partenaireId: string; partenaireName: string }) => (
    <div>{`${partenaireName}-${partenaireId}`}</div>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ ...stableAuth, session: stableSession }),
}));

describe("EnhancedPartenaireCard", () => {
  const realDateNow = Date.now;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    Date.now = realDateNow;
  });

  const partenaire = {
    id: "p1",
    nom: "Alpha Conseil",
    type_partenaire: "Cabinet",
    statut_relation: "actif",
    ville: "Paris",
    region: "Île-de-France",
    responsable: { prenom: "Jean", nom: "Dupont" },
    dernier_contact: "2024-06-05T12:00:00.000Z",
    prochaine_action: "2024-06-20T00:00:00.000Z",
    valeur_partenariat: 25000,
    engagement_score: 80,
    email: "contact@alpha.fr",
    telephone: "0102030405",
    created_at: "2024-06-01T00:00:00.000Z",
  };

  it("affiche les informations métier et les badges attendus", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={true}
        onToggleFavorite={onToggleFavoriteMock}
        pendingContactsCount={3}
      />
    );

    expect(screen.getByText("Alpha Conseil")).toBeInTheDocument();
    expect(screen.getByText("Cabinet")).toBeInTheDocument();
    expect(screen.getByText("actif")).toBeInTheDocument();
    expect(screen.getByText("Paris • Île-de-France")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Dernier contact: il y a 10 jours")).toBeInTheDocument();
    expect(screen.getByText("Prochaine action: 20/06/2024")).toBeInTheDocument();
    expect(screen.getByText("25k€")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Nouveau")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Alpha Conseil-p1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir la fiche partenaire Alpha Conseil" })).toBeInTheDocument();
  });

  it("navigue vers la fiche partenaire au clic sur la carte", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la fiche partenaire Alpha Conseil" }));

    expect(navigateMock).toHaveBeenCalledWith("/partenaires/p1");
  });

  it("navigue avec Enter et Space au clavier", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
      />
    );

    const card = screen.getByRole("button", { name: "Ouvrir la fiche partenaire Alpha Conseil" });

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(navigateMock).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenNthCalledWith(1, "/partenaires/p1");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/partenaires/p1");
  });

  it("navigue vers la composition d'email avec les bons paramètres", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "E-mail" }));

    expect(navigateMock).toHaveBeenCalledWith(
      "/emails?compose=true&to=contact%40alpha.fr&toName=Alpha+Conseil"
    );
  });

  it("déclenche l'appel téléphonique", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Appeler" }));

    expect(window.location.href).toBe("tel:0102030405");
  });

  it("déclenche le toggle favori avec l'id du partenaire sans naviguer", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Favori" }));

    expect(onToggleFavoriteMock).toHaveBeenCalledWith("p1");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("désactive la navigation principale quand showCheckbox est actif", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
        showCheckbox={true}
      />
    );

    const title = screen.getByText("Alpha Conseil");
    fireEvent.click(title.closest("div") as HTMLElement);

    expect(screen.queryByRole("button", { name: "Ouvrir la fiche partenaire Alpha Conseil" })).not.toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("désactive les actions email et téléphone si les données sont absentes", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={{
          ...partenaire,
          email: "",
          telephone: "",
        }}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
      />
    );

    expect(screen.getByRole("button", { name: "E-mail" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Appeler" })).toBeDisabled();
  });

  it("applique l'état sélectionné", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={partenaire}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
        isSelected={true}
      />
    );

    const card = screen.getByRole("button", { name: "Ouvrir la fiche partenaire Alpha Conseil" });
    expect(card.className).toContain("ring-2");
    expect(card.className).toContain("bg-primary/5");
  });

  it("affiche les statuts visuels adaptés pour un partenaire à surveiller et action passée", () => {
    render(
      <EnhancedPartenaireCard
        partenaire={{
          ...partenaire,
          statut_relation: "prospect",
          created_at: "2024-01-01T00:00:00.000Z",
          dernier_contact: "2024-03-01T00:00:00.000Z",
          prochaine_action: "2024-06-01T00:00:00.000Z",
        }}
        isFavorite={false}
        onToggleFavorite={onToggleFavoriteMock}
        pendingContactsCount={0}
      />
    );

    expect(screen.getByText("prospect")).toBeInTheDocument();
    expect(screen.queryByText("Nouveau")).not.toBeInTheDocument();
    expect(screen.getByText("Prochaine action: 01/06/2024").parentElement?.className).toContain("text-red-600");
  });
});