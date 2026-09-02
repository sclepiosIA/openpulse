/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DomainClassificationPanel } from "./DomainClassificationPanel";

const {
  DOMAINS,
  toastMock,
  mutateAsyncMock,
  sanitizeSupabaseErrorMock,
  sanitizeEmailSubjectMock,
  invalidateQueriesMock,
  mockFrom,
  insertMock,
  updateMock,
  isMock,
  inMock,
  builderThenMock,
  builderCatchMock,
} = vi.hoisted(() => {
  const DOMAINS = [
    {
      domain: "clinic.test",
      emailCount: 3,
      threadCount: 2,
      exampleThreads: [
        { id: "th-1", subject: "Re: Rendez-vous", from_address: "doc@clinic.test" },
        { id: "th-2", subject: "Facture", from_address: "admin@clinic.test" },
        { id: "th-3", subject: "Compte-rendu", from_address: "noreply@clinic.test" },
      ],
    },
    {
      domain: "partner.test",
      emailCount: 1,
      threadCount: 1,
      exampleThreads: [
        { id: "th-4", subject: "Convention", from_address: "hello@partner.test" },
      ],
    },
  ] as const;

  const toastMock = vi.fn();
  const mutateAsyncMock = vi.fn();
  const sanitizeSupabaseErrorMock = vi.fn((error: unknown) => {
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message: string }).message);
    }
    return "unknown";
  });
  const sanitizeEmailSubjectMock = vi.fn((subject: string) => `sanitized:${subject}`);
  const invalidateQueriesMock = vi.fn();

  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const isMock = vi.fn();
  const inMock = vi.fn();
  const builderThenMock = vi.fn();
  const builderCatchMock = vi.fn();

  const mockFrom = vi.fn();

  return {
    DOMAINS,
    toastMock,
    mutateAsyncMock,
    sanitizeSupabaseErrorMock,
    sanitizeEmailSubjectMock,
    invalidateQueriesMock,
    mockFrom,
    insertMock,
    updateMock,
    isMock,
    inMock,
    builderThenMock,
    builderCatchMock,
  };
});

vi.mock("@/hooks/email/useUnclassifiedDomains", () => ({
  useUnclassifiedDomains: vi.fn(),
}));

vi.mock("@/hooks/email/useEmailDomainMappings", () => ({
  useAddDomainMapping: vi.fn(() => ({
    mutateAsync: mutateAsyncMock,
  })),
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: sanitizeEmailSubjectMock,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardFooter: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertTitle: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("./DomainMultiAssociationDialog", () => ({
  DomainMultiAssociationDialog: ({
    open,
    domain,
    onConfirm,
  }: {
    open: boolean;
    domain: string;
    onConfirm: (ids: string[], level: "high" | "medium" | "low") => Promise<void>;
  }) =>
    open ? (
      <div data-testid="multi-dialog">
        <div>{domain}</div>
        <button type="button" onClick={() => void onConfirm(["eta-1", "eta-2"], "high")}>
          confirm-multi
        </button>
      </div>
    ) : null,
}));

vi.mock("./DomainGroupeAssociationDialog", () => ({
  DomainGroupeAssociationDialog: ({
    open,
    domain,
    onConfirm,
  }: {
    open: boolean;
    domain: string;
    onConfirm: (id: string, level: "high" | "medium" | "low") => Promise<void>;
  }) =>
    open ? (
      <div data-testid="groupe-dialog">
        <div>{domain}</div>
        <button type="button" onClick={() => void onConfirm("grp-1", "medium")}>
          confirm-groupe
        </button>
      </div>
    ) : null,
}));

vi.mock("./DomainPartenaireAssociationDialog", () => ({
  DomainPartenaireAssociationDialog: ({
    open,
    domain,
    onConfirm,
  }: {
    open: boolean;
    domain: string;
    onConfirm: (id: string, level: "high" | "medium" | "low") => Promise<void>;
  }) =>
    open ? (
      <div data-testid="partenaire-dialog">
        <div>{domain}</div>
        <button type="button" onClick={() => void onConfirm("part-1", "low")}>
          confirm-partenaire
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/etablissement/EtablissementCreateForm", () => ({
  EtablissementCreateForm: ({
    open,
    initialDomain,
  }: {
    open: boolean;
    initialDomain: string;
  }) => (open ? <div data-testid="etablissement-create-form">{initialDomain}</div> : null),
}));

vi.mock("@/components/partenaire/PartenaireCreateForm", () => ({
  PartenaireCreateForm: ({
    open,
    initialDomain,
  }: {
    open: boolean;
    initialDomain: string;
  }) => (open ? <div data-testid="partenaire-create-form">{initialDomain}</div> : null),
}));

vi.mock("./EmailSpecificMappingDialog", () => ({
  EmailSpecificMappingDialog: ({
    open,
  }: {
    open: boolean;
  }) => (open ? <div data-testid="email-specific-dialog">email-specific-open</div> : null),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Loader2: Icon,
    Mail: Icon,
    Ban: Icon,
    Link: Icon,
    ChevronRight: Icon,
    Building2: Icon,
    AtSign: Icon,
    Handshake: Icon,
    Info: Icon,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { useUnclassifiedDomains } from "@/hooks/email/useUnclassifiedDomains";

function createBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: inMock.mockImplementation(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: insertMock.mockImplementation(async () => ({ error: null })),
    update: updateMock.mockImplementation(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    is: isMock.mockImplementation(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: builderThenMock.mockImplementation(
      (onFulfilled?: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
    ),
    catch: builderCatchMock.mockImplementation(
      (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    ),
  };
  return builder;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderPanel() {
  const queryClient = createQueryClient();
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(invalidateQueriesMock);
  return render(
    <QueryClientProvider client={queryClient}>
      <DomainClassificationPanel />
    </QueryClientProvider>,
  );
}

describe("DomainClassificationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createBuilder());
  });

  it("affiche le loader pendant le chargement", () => {
    vi.mocked(useUnclassifiedDomains).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = renderPanel();

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText("Classification par domaines")).not.toBeInTheDocument();
  });

  it("affiche les domaines, les compteurs, les sujets assainis et ouvre les dialogs locaux", async () => {
    vi.mocked(useUnclassifiedDomains).mockReturnValue({
      data: DOMAINS,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByText("Classification par domaines")).toBeInTheDocument();
    expect(screen.getByText("2 domaines à classifier (4 emails)")).toBeInTheDocument();
    expect(screen.getByText("clinic.test")).toBeInTheDocument();
    expect(screen.getByText("partner.test")).toBeInTheDocument();
    expect(screen.getByText("3 emails • 2 conversations")).toBeInTheDocument();
    expect(screen.getByText("1 email • 1 conversation")).toBeInTheDocument();

    expect(screen.getByText("sanitized:Re: Rendez-vous")).toBeInTheDocument();
    expect(screen.getByText("sanitized:Facture")).toBeInTheDocument();
    expect(screen.getByText("sanitized:Compte-rendu")).toBeInTheDocument();
    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith("Re: Rendez-vous");
    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith("Convention");

    await user.click(screen.getByRole("button", { name: /affilier un email spécifique/i }));
    expect(screen.getByTestId("email-specific-dialog")).toHaveTextContent("email-specific-open");

    await user.click(screen.getAllByRole("button", { name: /créer établissement/i })[0]);
    expect(screen.getByTestId("etablissement-create-form")).toHaveTextContent("clinic.test");

    await user.click(screen.getAllByRole("button", { name: /créer partenaire/i })[0]);
    expect(screen.getByTestId("partenaire-create-form")).toHaveTextContent("clinic.test");
  });

  it("exclut et ignore un domaine via la mutation dédiée", async () => {
    vi.mocked(useUnclassifiedDomains).mockReturnValue({
      data: DOMAINS,
      isLoading: false,
    });
    mutateAsyncMock.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getAllByRole("button", { name: /hors établissement/i })[0]);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      domain: "clinic.test",
      isExcluded: true,
    });

    await user.click(screen.getAllByRole("button", { name: /^ignorer$/i })[0]);
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      domain: "clinic.test",
      preventAuto: true,
    });
  });

  it("associe un domaine à plusieurs établissements, insère les mappings, rattache les threads et invalide les queries", async () => {
    vi.mocked(useUnclassifiedDomains).mockReturnValue({
      data: DOMAINS,
      isLoading: false,
    });

    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getAllByRole("button", { name: /associer à établissement/i })[0]);
    expect(screen.getByTestId("multi-dialog")).toHaveTextContent("clinic.test");

    await user.click(screen.getByRole("button", { name: "confirm-multi" }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenNthCalledWith(1, "email_domain_mappings");
      expect(mockFrom).toHaveBeenNthCalledWith(2, "email_threads");
    });

    expect(insertMock).toHaveBeenCalledWith([
      {
        etablissement_id: "eta-1",
        domain: "clinic.test",
        niveau_mapping: "etablissement",
        confidence_level: "high",
        verified: true,
        is_excluded: false,
      },
      {
        etablissement_id: "eta-2",
        domain: "clinic.test",
        niveau_mapping: "etablissement",
        confidence_level: "high",
        verified: true,
        is_excluded: false,
      },
    ]);

    expect(updateMock).toHaveBeenCalledWith({ etablissement_id: "eta-1" });
    expect(isMock).toHaveBeenCalledWith("etablissement_id", null);
    expect(inMock).toHaveBeenCalledWith("id", ["th-1", "th-2", "th-3"]);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["email-domain-mappings"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["unclassified-domains"] });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["email-threads"] });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Domaine associé",
      description: "Le domaine clinic.test a été associé à 2 établissements",
    });
  });

  it("associe un domaine à un groupe puis à un partenaire avec les bons paramètres métier", async () => {
    vi.mocked(useUnclassifiedDomains).mockReturnValue({
      data: DOMAINS,
      isLoading: false,
    });
    mutateAsyncMock.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getAllByRole("button", { name: /associer à groupe/i })[0]);
    await user.click(screen.getByRole("button", { name: "confirm-groupe" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        groupeId: "grp-1",
        domain: "clinic.test",
        confidenceLevel: "medium",
      });
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Domaine associé au groupe",
      description: "Les futurs emails de ce domaine seront automatiquement liés au groupe",
    });

    await user.click(screen.getAllByRole("button", { name: /associer à partenaire/i })[0]);
    await user.click(screen.getByRole("button", { name: "confirm-partenaire" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        partenaireId: "part-1",
        domain: "clinic.test",
        confidenceLevel: "low",
      });
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Domaine associé au partenaire",
      description: "Les futurs emails de ce domaine seront automatiquement liés au partenaire",
    });
  });

  it("gère les erreurs Supabase lors de l'association établissement et affiche un toast destructif", async () => {
    vi.mocked(useUnclassifiedDomains).mockReturnValue({
      data: DOMAINS,
      isLoading: false,
    });
    insertMock.mockResolvedValueOnce({ error: { message: "insert failed" } });

    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getAllByRole("button", { name: /associer à établissement/i })[0]);
    await user.click(screen.getByRole("button", { name: "confirm-multi" }));

    await waitFor(() => {
      expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith({ message: "insert failed" });
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "Erreur",
      description: "insert failed",
      variant: "destructive",
    });
  });
});