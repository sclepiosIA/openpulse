// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EnqueteShell } from "./EnqueteShell";

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h2 data-testid="card-title">{children}</h2>,
  CardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type,
    disabled,
    className,
    onClick,
  }: {
    children?: React.ReactNode;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button type={type} disabled={disabled} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

describe("EnqueteShell", () => {
  it("affiche un loader plein écran pendant le chargement", () => {
    const onSubmit = vi.fn();

    const { container } = render(
      <EnqueteShell
        title="Titre"
        subtitle="Sous-titre"
        onSubmit={onSubmit}
        isSubmitting={false}
        isSuccess={false}
        isLoading
      >
        <div>Contenu formulaire</div>
      </EnqueteShell>,
    );

    expect(screen.queryByText("Titre")).not.toBeInTheDocument();
    expect(screen.queryByText("Contenu formulaire")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("affiche le formulaire avec le titre, le sous-titre, les enfants et le footer", () => {
    const onSubmit = vi.fn();

    render(
      <EnqueteShell
        title="Enquête satisfaction"
        subtitle="Merci de répondre à ces questions"
        onSubmit={onSubmit}
        isSubmitting={false}
        isSuccess={false}
      >
        <div>Question 1</div>
        <div>Question 2</div>
      </EnqueteShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Enquête satisfaction" })).toBeInTheDocument();
    expect(screen.getByText("Merci de répondre à ces questions")).toBeInTheDocument();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoyer mes réponses" })).toBeEnabled();
    expect(
      screen.getByText("Vos réponses sont confidentielles et utilisées uniquement pour améliorer OpenPulse."),
    ).toBeInTheDocument();
  });

  it("soumet le formulaire via onSubmit", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => {
      e.preventDefault();
    });

    render(
      <EnqueteShell
        title="Enquête"
        onSubmit={onSubmit}
        isSubmitting={false}
        isSuccess={false}
      >
        <input aria-label="champ" />
      </EnqueteShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Envoyer mes réponses" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("désactive le bouton et affiche le libellé de soumission quand isSubmitting=true", () => {
    const onSubmit = vi.fn();

    const { container } = render(
      <EnqueteShell
        title="Enquête"
        onSubmit={onSubmit}
        isSubmitting
        isSuccess={false}
      >
        <div>Bloc</div>
      </EnqueteShell>,
    );

    expect(screen.getByRole("button", { name: /Envoi en cours…/ })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it.each([
    ["token_invalide", "Ce lien d'enquête est inconnu ou n'existe plus."],
    ["token_expire", "Ce lien d'enquête a expiré."],
    ["deja_repondu", "Cette enquête a déjà été remplie. Merci !"],
    ["autre_erreur", "Une erreur est survenue."],
  ])("affiche le bon message d'erreur pour %s", (code, message) => {
    const onSubmit = vi.fn();

    render(
      <EnqueteShell
        title="Enquête"
        onSubmit={onSubmit}
        isSubmitting={false}
        isSuccess={false}
        isError={code}
      >
        <div>Contenu</div>
      </EnqueteShell>,
    );

    expect(screen.getByTestId("card-title")).toHaveTextContent("Lien invalide");
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Envoyer mes réponses" })).not.toBeInTheDocument();
  });

  it("affiche l'écran de succès et notifie parent, ReactNativeWebView et webkit", async () => {
    const onSubmit = vi.fn();
    const parentPostMessage = vi.fn();
    const rnPostMessage = vi.fn();
    const webkitPostMessage = vi.fn();

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage: parentPostMessage },
    });

    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage: rnPostMessage },
    });

    Object.defineProperty(window, "webkit", {
      configurable: true,
      value: {
        messageHandlers: {
          marqueEnquete: {
            postMessage: webkitPostMessage,
          },
        },
      },
    });

    render(
      <EnqueteShell
        title="Enquête"
        onSubmit={onSubmit}
        isSubmitting={false}
        isSuccess
      >
        <div>Contenu</div>
      </EnqueteShell>,
    );

    expect(screen.getByText("Merci pour votre retour !")).toBeInTheDocument();
    expect(
      screen.getByText("Vos réponses ont bien été enregistrées et vont permettre d'améliorer OpenPulse."),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(parentPostMessage).toHaveBeenCalledWith(
        { type: "marque:enquete:completed", source: "marque-ia" },
        "*",
      );
      expect(rnPostMessage).toHaveBeenCalledWith(
        JSON.stringify({ type: "marque:enquete:completed", source: "marque-ia" }),
      );
      expect(webkitPostMessage).toHaveBeenCalledWith({
        type: "marque:enquete:completed",
        source: "marque-ia",
      });
    });
  });

  it("n'échoue pas si les handlers natifs lancent une erreur", () => {
    const onSubmit = vi.fn();

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        postMessage: () => {
          throw new Error("parent fail");
        },
      },
    });

    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: {
        postMessage: () => {
          throw new Error("rn fail");
        },
      },
    });

    Object.defineProperty(window, "webkit", {
      configurable: true,
      value: {
        messageHandlers: {
          marqueEnquete: {
            postMessage: () => {
              throw new Error("webkit fail");
            },
          },
        },
      },
    });

    expect(() =>
      render(
        <EnqueteShell
          title="Enquête"
          onSubmit={onSubmit}
          isSubmitting={false}
          isSuccess
        >
          <div>Contenu</div>
        </EnqueteShell>,
      ),
    ).not.toThrow();

    expect(screen.getByText("Merci pour votre retour !")).toBeInTheDocument();
  });
});