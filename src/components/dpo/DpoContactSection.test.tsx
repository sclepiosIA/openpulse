// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DpoContactSection } from "./DpoContactSection";

const {
  mockCard,
  mockCardContent,
  mockHeader,
  mockAccordion,
  mockAccordionItem,
  mockAccordionTrigger,
  mockAccordionContent,
  contactWithAllFields,
  contactWithoutOptionalFields,
  faqItems,
} = vi.hoisted(() => ({
  mockCard: vi.fn(
    ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="card" className={className}>
        {children}
      </div>
    ),
  ),
  mockCardContent: vi.fn(
    ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="card-content" className={className}>
        {children}
      </div>
    ),
  ),
  mockHeader: vi.fn(
    ({
      title,
      subtitle,
    }: {
      title: string;
      subtitle: string;
      icon: React.ComponentType;
    }) => (
      <div data-testid="section-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    ),
  ),
  mockAccordion: vi.fn(
    ({
      children,
      type,
      collapsible,
      className,
    }: {
      children: React.ReactNode;
      type: string;
      collapsible?: boolean;
      className?: string;
    }) => (
      <div
        data-testid="accordion"
        data-type={type}
        data-collapsible={String(Boolean(collapsible))}
        className={className}
      >
        {children}
      </div>
    ),
  ),
  mockAccordionItem: vi.fn(
    ({
      children,
      value,
      className,
    }: {
      children: React.ReactNode;
      value: string;
      className?: string;
    }) => (
      <div data-testid="accordion-item" data-value={value} className={className}>
        {children}
      </div>
    ),
  ),
  mockAccordionTrigger: vi.fn(
    ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <button className={className}>{children}</button>,
  ),
  mockAccordionContent: vi.fn(
    ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <div data-testid="accordion-content" className={className}>
        {children}
      </div>
    ),
  ),
  contactWithAllFields: {
    email: "dpo@test.fr",
    phone: "01 99 00 12 34",
    adresse: "12 rue de Paris, 75001 Paris",
  },
  contactWithoutOptionalFields: {
    email: "privacy@test.fr",
    phone: "",
    adresse: "",
  },
  faqItems: [
    {
      question: "Comment exercer mes droits ?",
      answer: "Vous pouvez nous contacter par email pour toute demande RGPD.",
    },
    {
      question: "Combien de temps gardez-vous mes données ?",
      answer: "La durée dépend de la finalité du traitement et des obligations légales.",
    },
  ],
}));

vi.mock("@/components/ui/card", () => ({
  Card: mockCard,
  CardContent: mockCardContent,
}));

vi.mock("@/components/formations/CharterSectionHeader", () => ({
  CharterSectionHeader: mockHeader,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: mockAccordion,
  AccordionItem: mockAccordionItem,
  AccordionTrigger: mockAccordionTrigger,
  AccordionContent: mockAccordionContent,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Phone: Icon,
    Mail: Icon,
    PhoneCall: Icon,
    HelpCircle: Icon,
    MapPin: Icon,
  };
});

describe("DpoContactSection", () => {
  it("affiche l'en-tête, les informations de contact et la FAQ avec les valeurs métier attendues", () => {
    render(<DpoContactSection contactDpo={contactWithAllFields} faq={faqItems} />);

    expect(screen.getByText("Contact DPO & FAQ")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Une question sur vos données ? Contactez notre délégué à la protection des données",
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Contactez le DPO")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pour toute question relative à la protection de vos données personnelles ou pour exercer vos droits, n'hésitez pas à nous contacter.",
      ),
    ).toBeInTheDocument();

    const emailLink = screen.getByRole("link", { name: "dpo@test.fr" });
    expect(emailLink).toHaveAttribute("href", "mailto:dpo@test.fr");

    const phoneLink = screen.getByRole("link", { name: "01 99 00 12 34" });
    expect(phoneLink).toHaveAttribute("href", "tel:0199001234");

    expect(screen.getByText("12 rue de Paris, 75001 Paris")).toBeInTheDocument();
    expect(
      screen.getByText("Délai de réponse : 30 jours maximum conformément au RGPD"),
    ).toBeInTheDocument();

    expect(screen.getByText("Questions fréquentes")).toBeInTheDocument();
    expect(screen.getByTestId("accordion")).toHaveAttribute("data-type", "single");
    expect(screen.getByTestId("accordion")).toHaveAttribute("data-collapsible", "true");

    expect(screen.getByRole("button", { name: "Comment exercer mes droits ?" })).toBeInTheDocument();
    expect(
      screen.getByText("Vous pouvez nous contacter par email pour toute demande RGPD."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Combien de temps gardez-vous mes données ?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "La durée dépend de la finalité du traitement et des obligations légales.",
      ),
    ).toBeInTheDocument();

    const items = screen.getAllByTestId("accordion-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-value", "faq-0");
    expect(items[1]).toHaveAttribute("data-value", "faq-1");
  });

  it("n'affiche pas le téléphone ni l'adresse quand les champs optionnels sont absents", () => {
    render(<DpoContactSection contactDpo={contactWithoutOptionalFields} faq={faqItems} />);

    const emailLink = screen.getByRole("link", { name: "privacy@test.fr" });
    expect(emailLink).toHaveAttribute("href", "mailto:privacy@test.fr");

    expect(screen.queryByRole("link", { name: "01 99 00 12 34" })).not.toBeInTheDocument();
    expect(screen.queryByText("12 rue de Paris, 75001 Paris")).not.toBeInTheDocument();
  });

  it("rend une FAQ vide sans erreur et sans item", async () => {
    const user = userEvent.setup();

    render(<DpoContactSection contactDpo={contactWithAllFields} faq={[]} />);

    expect(screen.getByText("Questions fréquentes")).toBeInTheDocument();
    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    expect(screen.queryAllByTestId("accordion-item")).toHaveLength(0);

    await user.tab();
    expect(screen.getByRole("link", { name: "dpo@test.fr" })).toHaveFocus();
  });
});