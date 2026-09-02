import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import DpoExemple from "./DpoExemple";

const { mockUseIntersectionObserver, mockConfig } = vi.hoisted(() => {
  const mockUseIntersectionObserverImpl = vi.fn().mockReturnValue({
    ref: vi.fn(),
    inView: false,
  });

  const mockConfigImpl = {
    etablissement: "Centre Hospitalier de Martinique",
    stats: [
      { label: "Patients accompagnés", value: "10 000+" },
      { label: "Professionnels formés", value: "250" },
    ],
    engagements: [
      { title: "Transparence", description: "Description transparence" },
      { title: "Sécurité", description: "Description sécurité" },
    ],
    hebergement: [
      { title: "France", description: "Données hébergées en France" },
    ],
    securite: [
      { title: "Chiffrement", description: "Chiffrement des données" },
    ],
    traitements: [
      { title: "Gestion patient", description: "Traitement des dossiers" },
    ],
    droits: [
      { title: "Accès", description: "Droit d'accès aux données" },
    ],
    contactDpo: {
      email: "dpo@example.test",
      adressePostale: "Adresse DPO Martinique",
      telephone: "0199001234",
    },
    faq: [
      { question: "Comment exercer mes droits ?", answer: "Par email." },
    ],
  };

  return {
    mockUseIntersectionObserver: mockUseIntersectionObserverImpl,
    mockConfig: mockConfigImpl,
  };
});

vi.mock("@/components/formations/ScrollProgress", () => ({
  ScrollProgress: () => <div data-testid="scroll-progress">ScrollProgress</div>,
}));

vi.mock("@/components/dpo", () => ({
  DpoHeroSection: ({ etablissement, stats, onScrollToEngagements }: { etablissement: string; stats: { label: string; value: string }[]; onScrollToEngagements: () => void }) => (
    <div data-testid="dpo-hero">
      <div data-testid="hero-etablissement">{etablissement}</div>
      <button onClick={onScrollToEngagements}>Go to engagements</button>
      {stats.map((s) => (
        <div key={s.label}>
          <span>{s.label}</span>
          <span>{s.value}</span>
        </div>
      ))}
    </div>
  ),
  DpoNavigationScrollSpy: ({ onDesktopVisibilityChange }: { onDesktopVisibilityChange: (open: boolean) => void }) => (
    <div data-testid="dpo-nav">
      <button onClick={() => onDesktopVisibilityChange(true)}>Open</button>
      <button onClick={() => onDesktopVisibilityChange(false)}>Close</button>
    </div>
  ),
  DpoEngagementsSection: ({ engagements }: { engagements: { title: string; description: string }[] }) => (
    <div data-testid="engagements-section">
      {engagements.map((e) => (
        <div key={e.title}>{e.title}</div>
      ))}
    </div>
  ),
  DpoHebergementSection: ({ items }: { items: { title: string; description: string }[] }) => (
    <div data-testid="hebergement-section">
      {items.map((e) => (
        <div key={e.title}>{e.title}</div>
      ))}
    </div>
  ),
  DpoSecuriteSection: ({ items }: { items: { title: string; description: string }[] }) => (
    <div data-testid="securite-section">
      {items.map((e) => (
        <div key={e.title}>{e.title}</div>
      ))}
    </div>
  ),
  DpoTraitementsSection: ({ traitements }: { traitements: { title: string; description: string }[] }) => (
    <div data-testid="traitements-section">
      {traitements.map((e) => (
        <div key={e.title}>{e.title}</div>
      ))}
    </div>
  ),
  DpoDroitsSection: ({ droits }: { droits: { title: string; description: string }[] }) => (
    <div data-testid="droits-section">
      {droits.map((e) => (
        <div key={e.title}>{e.title}</div>
      ))}
    </div>
  ),
  DpoContactSection: ({ contactDpo, faq }: { contactDpo: { email: string; adressePostale: string; telephone: string }; faq: { question: string; answer: string }[] }) => (
    <div data-testid="contact-section">
      <div>{contactDpo.email}</div>
      <div>{contactDpo.adressePostale}</div>
      <div>{contactDpo.telephone}</div>
      {faq.map((q) => (
        <div key={q.question}>{q.question}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/hooks/shared/useIntersectionObserver", () => ({
  useIntersectionObserver: (options: unknown) => {
    return mockUseIntersectionObserver(options);
  },
}));

vi.mock("@/lib/dpo-content", () => ({
  dpoConfigExemple: mockConfig,
}));

describe("DpoExemple", () => {
  it("rend toutes les sections avec le contenu de configuration", () => {
    render(<DpoExemple />);

    expect(screen.getByTestId("scroll-progress")).toBeInTheDocument();
    expect(screen.getByTestId("dpo-nav")).toBeInTheDocument();
    expect(screen.getByTestId("dpo-hero")).toBeInTheDocument();

    expect(screen.getByTestId("hero-etablissement")).toHaveTextContent(
      mockConfig.etablissement
    );

    mockConfig.stats.forEach((stat) => {
      expect(screen.getByText(stat.label)).toBeInTheDocument();
      expect(screen.getByText(stat.value)).toBeInTheDocument();
    });

    const engagementsSection = screen.getByTestId("engagements-section");
    mockConfig.engagements.forEach((engagement) => {
      expect(engagementsSection).toHaveTextContent(engagement.title);
    });

    const hebergementSection = screen.getByTestId("hebergement-section");
    mockConfig.hebergement.forEach((item) => {
      expect(hebergementSection).toHaveTextContent(item.title);
    });

    const securiteSection = screen.getByTestId("securite-section");
    mockConfig.securite.forEach((item) => {
      expect(securiteSection).toHaveTextContent(item.title);
    });

    const traitementsSection = screen.getByTestId("traitements-section");
    mockConfig.traitements.forEach((item) => {
      expect(traitementsSection).toHaveTextContent(item.title);
    });

    const droitsSection = screen.getByTestId("droits-section");
    mockConfig.droits.forEach((item) => {
      expect(droitsSection).toHaveTextContent(item.title);
    });

    const contactSection = screen.getByTestId("contact-section");
    expect(contactSection).toHaveTextContent(mockConfig.contactDpo.email);
    expect(contactSection).toHaveTextContent(mockConfig.contactDpo.adressePostale);
    expect(contactSection).toHaveTextContent(mockConfig.contactDpo.telephone);
    mockConfig.faq.forEach((item) => {
      expect(contactSection).toHaveTextContent(item.question);
    });
  });

  it("gère l'ouverture et la fermeture de la sidebar via DpoNavigationScrollSpy", () => {
    const { container } = render(<DpoExemple />);
    const rootDiv = container.firstChild as HTMLElement;

    expect(rootDiv.className).toContain("lg:pl-64");

    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);
    expect(rootDiv.className).not.toContain("lg:pl-64");

    const openButton = screen.getByText("Open");
    fireEvent.click(openButton);
    expect(rootDiv.className).toContain("lg:pl-64");
  });

  it("fait défiler vers la section engagements lorsque l'action du héros est déclenchée", () => {
    const scrollToMock = vi.fn();
    const getBoundingClientRectMock = vi.fn().mockReturnValue({
      top: 250,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const originalScrollTo = window.scrollTo;
    const originalGetElementById = document.getElementById;

    (window as unknown as { scrollTo: (options: ScrollToOptions) => void }).scrollTo = scrollToMock as unknown as typeof window.scrollTo;
    (document as unknown as { getElementById: (id: string) => HTMLElement | null }).getElementById = vi
      .fn()
      .mockImplementation((id: string) => {
        if (id === "engagements") {
          return {
            getBoundingClientRect: getBoundingClientRectMock,
          } as unknown as HTMLElement;
        }
        return originalGetElementById.call(document, id);
      });

    render(<DpoExemple />);

    const button = screen.getByText("Go to engagements");
    fireEvent.click(button);

    expect(getBoundingClientRectMock).toHaveBeenCalledTimes(1);
    expect(scrollToMock).toHaveBeenCalledTimes(1);
    const args = scrollToMock.mock.calls[0][0] as ScrollToOptions;
    expect(args.top).toBe(250 + window.scrollY - 100);
    expect(args.behavior).toBe("smooth");

    window.scrollTo = originalScrollTo;
    document.getElementById = originalGetElementById;
  });

  it("ne fait rien si la section ciblée est introuvable", () => {
    const scrollToMock = vi.fn();
    const originalScrollTo = window.scrollTo;
    const originalGetElementById = document.getElementById;

    (window as unknown as { scrollTo: (options: ScrollToOptions) => void }).scrollTo = scrollToMock as unknown as typeof window.scrollTo;
    (document as unknown as { getElementById: (id: string) => HTMLElement | null }).getElementById = vi
      .fn()
      .mockReturnValue(null);

    render(<DpoExemple />);

    const button = screen.getByText("Go to engagements");
    fireEvent.click(button);

    expect(scrollToMock).not.toHaveBeenCalled();

    window.scrollTo = originalScrollTo;
    document.getElementById = originalGetElementById;
  });
});