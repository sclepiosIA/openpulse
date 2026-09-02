// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsSection } from "./SettingsSection";

const {
  cardPropsSpy,
  badgePropsSpy,
  collapsibleState,
  cnSpy,
} = vi.hoisted(() => ({
  cardPropsSpy: vi.fn(),
  badgePropsSpy: vi.fn(),
  collapsibleState: {
    open: true,
    defaultOpen: true,
  },
  cnSpy: vi.fn((...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ")),
}));

vi.mock("./card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => {
    cardPropsSpy(className);
    return (
      <section data-testid="card" data-classname={className ?? ""}>
        {children}
      </section>
    );
  },
  CardHeader: ({ children }: { children: React.ReactNode }) => <header data-testid="card-header">{children}</header>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="card-description" className={className}>
      {children}
    </p>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock("./badge", () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => {
    badgePropsSpy({ variant, className, text: children });
    return (
      <span data-testid="badge" data-variant={variant ?? ""} className={className}>
        {children}
      </span>
    );
  },
}));

vi.mock("./collapsible", () => {
  const ReactModule = require("react") as typeof React;

  function Collapsible({
    children,
    defaultOpen,
  }: {
    children: React.ReactNode;
    defaultOpen?: boolean;
  }) {
    const [open, setOpen] = ReactModule.useState(Boolean(defaultOpen));
    collapsibleState.open = open;
    collapsibleState.defaultOpen = Boolean(defaultOpen);
    const items = ReactModule.Children.toArray(children);
    return (
      <div data-testid="collapsible" data-open={String(open)}>
        {items.map((child, index) =>
          ReactModule.isValidElement(child)
            ? ReactModule.cloneElement(
                child as React.ReactElement<{ open?: boolean; setOpen?: React.Dispatch<React.SetStateAction<boolean>> }>,
                { open, setOpen }
              )
            : <ReactModule.Fragment key={index}>{child}</ReactModule.Fragment>
        )}
      </div>
    );
  }

  function CollapsibleTrigger({
    children,
    className,
    setOpen,
  }: {
    children: React.ReactNode;
    className?: string;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  }) {
    return (
      <button
        type="button"
        data-testid="collapsible-trigger"
        className={className}
        onClick={() => setOpen?.((prev) => !prev)}
      >
        {children}
      </button>
    );
  }

  function CollapsibleContent({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) {
    if (!open) return null;
    return <div data-testid="collapsible-content">{children}</div>;
  }

  return {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
  };
});

vi.mock("lucide-react", () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-down" className={className} aria-hidden="true" />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | undefined>) => cnSpy(...args),
}));

describe("SettingsSection", () => {
  beforeEach(() => {
    cardPropsSpy.mockClear();
    badgePropsSpy.mockClear();
    cnSpy.mockClear();
    collapsibleState.open = true;
    collapsibleState.defaultOpen = true;
  });

  it("rend la carte simple avec titre, description, icône, children et className", () => {
    render(
      <SettingsSection
        title="Préférences générales"
        description="Gérez les options principales"
        icon={<span data-testid="custom-icon">I</span>}
        className="section-class"
      >
        <div>Contenu métier</div>
      </SettingsSection>
    );

    expect(screen.getByTestId("card")).toHaveAttribute("data-classname", "section-class");
    expect(cardPropsSpy).toHaveBeenCalledWith("section-class");
    expect(screen.getByTestId("card-title")).toHaveTextContent("Préférences générales");
    expect(screen.getByTestId("card-description")).toHaveTextContent("Gérez les options principales");
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toHaveTextContent("Contenu métier");
    expect(screen.queryByTestId("collapsible")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chevron-down")).not.toBeInTheDocument();
  });

  it("affiche le badge recommandé avec le bon variant et le bon texte", () => {
    render(
      <SettingsSection title="Sauvegarde" badge="recommandé">
        <div>Réglage</div>
      </SettingsSection>
    );

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Recommandé");
    expect(badge).toHaveAttribute("data-variant", "default");
    expect(badgePropsSpy).toHaveBeenCalledWith({
      variant: "default",
      className: "text-xs",
      text: "Recommandé",
    });
  });

  it("affiche le badge avancé avec le bon variant et le bon texte", () => {
    render(
      <SettingsSection title="Mode expert" badge="avancé">
        <div>Réglage avancé</div>
      </SettingsSection>
    );

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Avancé");
    expect(badge).toHaveAttribute("data-variant", "secondary");
  });

  it("affiche le badge admin avec le bon variant et le bon texte", () => {
    render(
      <SettingsSection title="Administration" badge="admin">
        <div>Réglage admin</div>
      </SettingsSection>
    );

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Admin");
    expect(badge).toHaveAttribute("data-variant", "outline");
  });

  it("rend une section repliable ouverte par défaut avec chevron rotaté et contenu visible deux fois", () => {
    render(
      <SettingsSection title="Notifications" collapsible defaultOpen>
        <div>Choix des alertes</div>
      </SettingsSection>
    );

    expect(screen.getByTestId("collapsible")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("collapsible-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("collapsible-content")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-down")).toHaveClass("rotate-180");
    expect(cnSpy).toHaveBeenCalledWith(
      "h-5 w-5 text-muted-foreground transition-transform",
      "rotate-180"
    );
    expect(screen.getAllByText("Choix des alertes")).toHaveLength(2);
  });

  it("rend une section repliable fermée par défaut avec chevron non rotaté et contenu secondaire masqué", async () => {
    const user = userEvent.setup();

    render(
      <SettingsSection title="Sécurité" collapsible defaultOpen={false}>
        <div>Authentification forte</div>
      </SettingsSection>
    );

    expect(screen.getByTestId("collapsible")).toHaveAttribute("data-open", "false");
    expect(screen.getByTestId("chevron-down")).not.toHaveClass("rotate-180");
    expect(cnSpy).toHaveBeenCalledWith(
      "h-5 w-5 text-muted-foreground transition-transform",
      false
    );
    expect(screen.queryByTestId("collapsible-content")).not.toBeInTheDocument();
    expect(screen.getAllByText("Authentification forte")).toHaveLength(1);

    await user.click(screen.getByTestId("collapsible-trigger"));

    expect(screen.getByTestId("collapsible")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("collapsible-content")).toBeInTheDocument();
    expect(screen.getAllByText("Authentification forte")).toHaveLength(2);
  });
});