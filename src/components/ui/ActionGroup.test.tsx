// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { ActionGroup } from "./ActionGroup";

const { cardCalls, cnMock } = vi.hoisted(() => {
  return {
    cardCalls: {
      card: vi.fn(),
      header: vi.fn(),
      title: vi.fn(),
      description: vi.fn(),
      content: vi.fn(),
    },
    cnMock: vi.fn((...classes: Array<string | undefined | false | null>) =>
      classes.filter(Boolean).join(" ")
    ),
  };
});

vi.mock("./card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    cardCalls.card({ className });
    return (
      <section data-testid="card" data-classname={className ?? ""}>
        {children}
      </section>
    );
  },
  CardHeader: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    cardCalls.header({ className });
    return (
      <header data-testid="card-header" data-classname={className ?? ""}>
        {children}
      </header>
    );
  },
  CardTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    cardCalls.title({ className, children });
    return (
      <h2 data-testid="card-title" data-classname={className ?? ""}>
        {children}
      </h2>
    );
  },
  CardDescription: ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    cardCalls.description({ children });
    return <p data-testid="card-description">{children}</p>;
  },
  CardContent: ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    cardCalls.content({});
    return <div data-testid="card-content">{children}</div>;
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}));

describe("ActionGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend un conteneur simple horizontal sans Card quand title et description sont absents", () => {
    const { container } = render(
      <ActionGroup className="extra-class">
        <button>One</button>
        <button>Two</button>
      </ActionGroup>
    );

    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root?.tagName).toBe("DIV");
    expect(root?.className).toBe("flex gap-3 flex-row flex-wrap extra-class");

    expect(cnMock).toHaveBeenCalledWith(
      "flex gap-3",
      "flex-row flex-wrap",
      "extra-class"
    );
    expect(cardCalls.card).not.toHaveBeenCalled();
  });

  it("rend un conteneur simple vertical sans Card quand orientation=vertical et sans en-tête", () => {
    const { container } = render(
      <ActionGroup orientation="vertical">
        <span>Alpha</span>
      </ActionGroup>
    );

    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root?.className).toBe("flex gap-3 flex-col");

    expect(cnMock).toHaveBeenCalledWith("flex gap-3", "flex-col", undefined);
  });

  it("rend une Card avec title, description et orientation horizontale", () => {
    render(
      <ActionGroup
        title="Actions rapides"
        description="Choisissez une action"
        className="wrapper-class"
      >
        <button>Créer</button>
        <button>Modifier</button>
      </ActionGroup>
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card")).toHaveAttribute(
      "data-classname",
      "wrapper-class"
    );

    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toHaveAttribute(
      "data-classname",
      "pb-3"
    );

    expect(screen.getByTestId("card-title")).toHaveTextContent("Actions rapides");
    expect(screen.getByTestId("card-title")).toHaveAttribute(
      "data-classname",
      "text-base"
    );
    expect(screen.getByTestId("card-description")).toHaveTextContent(
      "Choisissez une action"
    );

    expect(screen.getByTestId("card-content")).toBeInTheDocument();
    expect(screen.getByText("Créer")).toBeInTheDocument();
    expect(screen.getByText("Modifier")).toBeInTheDocument();

    expect(cardCalls.card).toHaveBeenCalledWith({ className: "wrapper-class" });
    expect(cardCalls.header).toHaveBeenCalledWith({ className: "pb-3" });
    expect(cardCalls.title).toHaveBeenCalledWith({
      className: "text-base",
      children: "Actions rapides",
    });
    expect(cardCalls.description).toHaveBeenCalledWith({
      children: "Choisissez une action",
    });

    expect(cnMock).toHaveBeenCalledWith("flex gap-3", "flex-row flex-wrap");
  });

  it("rend seulement le title si la description est absente", () => {
    render(
      <ActionGroup title="Titre seul">
        <span>Contenu</span>
      </ActionGroup>
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-title")).toHaveTextContent("Titre seul");
    expect(screen.queryByTestId("card-description")).not.toBeInTheDocument();
    expect(screen.getByText("Contenu")).toBeInTheDocument();

    expect(cardCalls.title).toHaveBeenCalledTimes(1);
    expect(cardCalls.description).not.toHaveBeenCalled();
  });

  it("rend seulement la description si le title est absent", () => {
    render(
      <ActionGroup description="Description seule" orientation="vertical">
        <span>Élément</span>
      </ActionGroup>
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.queryByTestId("card-title")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-description")).toHaveTextContent(
      "Description seule"
    );
    expect(screen.getByText("Élément")).toBeInTheDocument();

    expect(cardCalls.title).not.toHaveBeenCalled();
    expect(cardCalls.description).toHaveBeenCalledWith({
      children: "Description seule",
    });
    expect(cnMock).toHaveBeenCalledWith("flex gap-3", "flex-col");
  });
});