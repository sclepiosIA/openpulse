/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import PublicLinkPlaceholder from "./PublicLinkPlaceholder";

vi.mock("lucide-react", () => ({
  Link2: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="link2-icon" className={className} {...props} />
  ),
}));

describe("PublicLinkPlaceholder", () => {
  it("affiche le contenu par défaut avec le lien de retour", () => {
    render(<PublicLinkPlaceholder />);

    expect(screen.getByRole("main")).toHaveClass(
      "min-h-dvh",
      "flex",
      "items-center",
      "justify-center"
    );

    expect(screen.getByTestId("link2-icon")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Lien spécifique requis"
    );
    expect(
      screen.getByText(
        "Cette page nécessite un identifiant fourni par votre interlocuteur OpenPulse Merci d'utiliser le lien complet qui vous a été transmis."
      )
    ).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: "Retour au site OpenPulse",
    });
    expect(link).toHaveAttribute("href", "https://exploitant.example.org");
    expect(link).toHaveClass("inline-block", "text-sm", "text-primary", "hover:underline");
  });

  it("affiche le titre et la description personnalisés", () => {
    render(
      <PublicLinkPlaceholder
        title="Accès invité"
        description="Utilisez le lien public complet pour consulter cette ressource."
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Accès invité");
    expect(
      screen.getByText("Utilisez le lien public complet pour consulter cette ressource.")
    ).toBeInTheDocument();
  });

  it("rend l'icône décorative comme cachée aux technologies d'assistance", () => {
    render(<PublicLinkPlaceholder />);

    const icon = screen.getByTestId("link2-icon");
    expect(icon).toHaveAttribute("aria-hidden");
  });
});