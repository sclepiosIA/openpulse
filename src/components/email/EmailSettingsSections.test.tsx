import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react-dom/test-utils";
import { EmailSettingsSections } from "./EmailSettingsSections";

const { mockUsePendingContactsCount, mockSettingsSection, mockAccordion, mockAccordionItem, mockAccordionTrigger, mockAccordionContent, mockEmailAccountConnection, mockEmailSignatureEditor, mockManualSyncButton, mockFixThreadDatesButton, mockPendingContactsValidation, mockBackfillContactsButton, mockCleanupInternalContactsButton, mockManualEmailAnalysisTrigger, mockRegenerateDetailedSummariesButton, mockMyTransfersSection } =
  vi.hoisted(() => {
    const mockUsePendingContactsCount = vi.fn();
    const mockSettingsSection = vi.fn(({ title, description, icon, badge, children }) => (
      <section data-testid={`settings-section-${title}`}>
        <h2>{title}</h2>
        <p>{description}</p>
        {badge ? <span>{badge}</span> : null}
        <div data-testid={`settings-section-icon-${title}`}>{icon}</div>
        <div>{children}</div>
      </section>
    ));
    const mockAccordion = vi.fn(({ children, ...props }) => (
      <div data-testid="accordion" {...props}>
        {children}
      </div>
    ));
    const mockAccordionItem = vi.fn(({ value, children, ...props }) => (
      <div data-testid={`accordion-item-${value}`} {...props}>
        {children}
      </div>
    ));
    const mockAccordionTrigger = vi.fn(({ children, ...props }) => (
      <button data-testid="accordion-trigger" {...props}>
        {children}
      </button>
    ));
    const mockAccordionContent = vi.fn(({ children, ...props }) => (
      <div data-testid="accordion-content" {...props}>
        {children}
      </div>
    ));
    const mockEmailAccountConnection = vi.fn(() => (
      <div data-testid="email-account-connection">EmailAccountConnection</div>
    ));
    const mockEmailSignatureEditor = vi.fn(({ profileId, initialSignature }) => (
      <div data-testid="email-signature-editor">
        <span>profile:{profileId}</span>
        <span>signature:{initialSignature}</span>
      </div>
    ));
    const mockManualSyncButton = vi.fn(() => (
      <button data-testid="manual-sync-button">ManualSync</button>
    ));
    const mockFixThreadDatesButton = vi.fn(() => (
      <button data-testid="fix-thread-dates-button">FixThreadDates</button>
    ));
    const mockPendingContactsValidation = vi.fn(() => (
      <div data-testid="pending-contacts-validation">PendingContactsValidation</div>
    ));
    const mockBackfillContactsButton = vi.fn(() => (
      <button data-testid="backfill-contacts-button">BackfillContacts</button>
    ));
    const mockCleanupInternalContactsButton = vi.fn(() => (
      <button data-testid="cleanup-internal-contacts-button">CleanupInternalContacts</button>
    ));
    const mockManualEmailAnalysisTrigger = vi.fn(() => (
      <button data-testid="manual-email-analysis-trigger">ManualEmailAnalysis</button>
    ));
    const mockRegenerateDetailedSummariesButton = vi.fn(() => (
      <button data-testid="regenerate-detailed-summaries-button">RegenerateSummaries</button>
    ));
    const mockMyTransfersSection = vi.fn(() => (
      <div data-testid="my-transfers-section">MyTransfersSection</div>
    ));

    return {
      mockUsePendingContactsCount,
      mockSettingsSection,
      mockAccordion,
      mockAccordionItem,
      mockAccordionTrigger,
      mockAccordionContent,
      mockEmailAccountConnection,
      mockEmailSignatureEditor,
      mockManualSyncButton,
      mockFixThreadDatesButton,
      mockPendingContactsValidation,
      mockBackfillContactsButton,
      mockCleanupInternalContactsButton,
      mockManualEmailAnalysisTrigger,
      mockRegenerateDetailedSummariesButton,
      mockMyTransfersSection,
    };
  });

vi.mock("@/components/ui/SettingsSection", () => ({
  SettingsSection: mockSettingsSection,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: mockAccordion,
  AccordionItem: mockAccordionItem,
  AccordionTrigger: mockAccordionTrigger,
  AccordionContent: mockAccordionContent,
}));

vi.mock("./EmailAccountConnection", () => ({
  EmailAccountConnection: mockEmailAccountConnection,
}));

vi.mock("./EmailSignatureEditor", () => ({
  EmailSignatureEditor: mockEmailSignatureEditor,
}));

vi.mock("./ManualSyncButton", () => ({
  ManualSyncButton: mockManualSyncButton,
}));

vi.mock("./FixThreadDatesButton", () => ({
  FixThreadDatesButton: mockFixThreadDatesButton,
}));

vi.mock("./PendingContactsValidation", () => ({
  PendingContactsValidation: mockPendingContactsValidation,
}));

vi.mock("./BackfillContactsButton", () => ({
  BackfillContactsButton: mockBackfillContactsButton,
}));

vi.mock("./CleanupInternalContactsButton", () => ({
  CleanupInternalContactsButton: mockCleanupInternalContactsButton,
}));

vi.mock("./ManualEmailAnalysisTrigger", () => ({
  ManualEmailAnalysisTrigger: mockManualEmailAnalysisTrigger,
}));

vi.mock("./RegenerateDetailedSummariesButton", () => ({
  RegenerateDetailedSummariesButton: mockRegenerateDetailedSummariesButton,
}));

vi.mock("./MyTransfersSection", () => ({
  MyTransfersSection: mockMyTransfersSection,
}));

vi.mock("@/hooks/crm/usePendingContactsCount", () => ({
  usePendingContactsCount: mockUsePendingContactsCount,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode }) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("EmailSettingsSections", () => {
  beforeEach(() => {
    mockUsePendingContactsCount.mockReset();
  });

  it("affiche les sections principales sans compteur de contacts en attente lorsque la requête est en chargement", async () => {
    mockUsePendingContactsCount.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithClient(
      <EmailSettingsSections profileId="p1" initialSignature="InitSig" />,
    );

    expect(
      screen.getByTestId("settings-section-Comptes Email"),
    ).toBeInTheDocument();
    expect(screen.getByText("Comptes Email")).toBeInTheDocument();
    expect(screen.getByText("recommandé")).toBeInTheDocument();
    expect(screen.getByTestId("email-account-connection")).toBeInTheDocument();

    expect(
      screen.getByTestId("settings-section-Signature Email"),
    ).toBeInTheDocument();
    expect(screen.getByText("Signature Email")).toBeInTheDocument();
    expect(screen.getByTestId("email-signature-editor")).toHaveTextContent(
      "profile:p1",
    );
    expect(screen.getByTestId("email-signature-editor")).toHaveTextContent(
      "signature:InitSig",
    );

    expect(
      screen.getByTestId("settings-section-Mes transferts"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("my-transfers-section")).toBeInTheDocument();

    const triggers = screen.getAllByTestId("accordion-trigger");
    expect(triggers[0]).toHaveTextContent("Outils & Maintenance");

    const badges = screen.queryAllByTestId("badge");
    const pendingCountBadge = badges.find((b) => b.textContent === "0");
    expect(pendingCountBadge).toBeUndefined();
  });

  it("affiche le badge de contacts en attente lorsque la requête réussit avec un nombre > 0", async () => {
    mockUsePendingContactsCount.mockReturnValue({
      data: 5,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithClient(<EmailSettingsSections />);

    const triggers = screen.getAllByTestId("accordion-trigger");
    await act(async () => {
      fireEvent.click(triggers[0]);
    });

    expect(
      screen.getByText("Gestion des Contacts"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("pending-contacts-validation"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("backfill-contacts-button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("cleanup-internal-contacts-button"),
    ).toBeInTheDocument();

    const badges = screen.getAllByTestId("badge");
    const pendingCountBadge = badges.find((b) => b.textContent === "5");
    expect(pendingCountBadge).toBeDefined();
  });

  it("n'affiche pas le badge de contacts en attente lorsque la requête est en erreur", async () => {
    mockUsePendingContactsCount.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "Erreur de chargement" },
    });

    renderWithClient(<EmailSettingsSections />);

    const triggers = screen.getAllByTestId("accordion-trigger");
    await act(async () => {
      fireEvent.click(triggers[0]);
    });

    const badges = screen.queryAllByTestId("badge");
    const pendingCountBadge = badges.find((b) => b.textContent === "5");
    expect(pendingCountBadge).toBeUndefined();
  });

  it("n'affiche pas la section Signature Email lorsque profileId est absent", () => {
    mockUsePendingContactsCount.mockReturnValue({
      data: 0,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithClient(<EmailSettingsSections />);

    expect(
      screen.queryByTestId("settings-section-Signature Email"),
    ).toBeNull();
    expect(screen.queryByTestId("email-signature-editor")).toBeNull();
  });

  it("passe une signature vide à l'éditeur lorsque initialSignature n'est pas fournie", () => {
    mockUsePendingContactsCount.mockReturnValue({
      data: 0,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithClient(<EmailSettingsSections profileId="p2" />);

    expect(
      screen.getByTestId("settings-section-Signature Email"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("email-signature-editor")).toHaveTextContent(
      "profile:p2",
    );
    expect(screen.getByTestId("email-signature-editor")).toHaveTextContent(
      "signature:",
    );
  });

  it("affiche les boutons de synchronisation et d'analyse dans l'accordéon", async () => {
    mockUsePendingContactsCount.mockReturnValue({
      data: 2,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithClient(<EmailSettingsSections />);

    const triggers = screen.getAllByTestId("accordion-trigger");
    await act(async () => {
      fireEvent.click(triggers[0]);
    });

    expect(
      screen.getByTestId("manual-sync-button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("fix-thread-dates-button"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("manual-email-analysis-trigger"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("regenerate-detailed-summaries-button"),
    ).toBeInTheDocument();

    const badges = screen.getAllByTestId("badge");
    const advancedBadge = badges.find((b) => b.textContent === "Avancé");
    expect(advancedBadge).toBeDefined();
  });
});