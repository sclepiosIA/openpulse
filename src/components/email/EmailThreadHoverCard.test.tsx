import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

const {
  THREAD_BASE,
  THREAD_WITH_SUMMARY,
  THREAD_WITH_CATEGORY_PRIORITY_ATTACHMENTS,
  THREAD_WITH_GROUPE,
  THREAD_WITH_SINGLE_ETABLISSEMENT,
  GROUPE_INFO_SINGLE,
  GROUPE_INFO_MULTI,
  GROUPE_ETAB_LIST,
  ETABLISSEMENT_WITH_TASKS,
  ETABLISSEMENT_WITHOUT_TASKS,
  mockFrom,
  mockUseThreadGroupeParticipants,
  mockUseGroupeEtablissements,
  mockUseNavigate,
  mockFixMalformedEncoding,
  mockTaskQuickAddDialog,
  mockHoverCardComponents,
  mockBadge,
  mockTooltipComponents,
  mockAccordionComponents,
  mockIcons,
} = vi.hoisted(() => {
  const THREAD_BASE = {
    id: "thread-1",
    message_count: 2,
    last_message_date: "2024-05-10T10:00:00.000Z",
    category: null,
    priority: null,
    has_attachments: false,
    ai_summary: null,
    etablissement: null,
  };

  const THREAD_WITH_SUMMARY = {
    ...THREAD_BASE,
    ai_summary: "Résumé encodé",
  };

  const THREAD_WITH_CATEGORY_PRIORITY_ATTACHMENTS = {
    ...THREAD_BASE,
    category: "Important",
    priority: "high",
    has_attachments: true,
  };

  const THREAD_WITH_GROUPE = {
    ...THREAD_BASE,
    etablissement: { id: "etab-1" },
  };

  const THREAD_WITH_SINGLE_ETABLISSEMENT = {
    ...THREAD_BASE,
    etablissement: { id: "etab-2" },
  };

  const GROUPE_INFO_SINGLE = {
    hasMultipleEtablissementsInGroupe: false,
    groupeId: null,
    groupeNom: null,
  };

  const GROUPE_INFO_MULTI = {
    hasMultipleEtablissementsInGroupe: true,
    groupeId: "groupe-1",
    groupeNom: "Groupe Test",
  };

  const GROUPE_ETAB_LIST = [
    {
      id: "ge1",
      nom: "Etablissement Groupe 1",
      ville: "Paris",
      statut: "Actif",
      progression: 50,
      engagement_score: 70,
      taches: [
        {
          id: "t1",
          titre: "Tâche haute priorité",
          statut: "En cours",
          echeance: "2024-06-01T10:00:00.000Z",
          priorite: "high",
        },
        {
          id: "t2",
          titre: "Tâche basse priorité",
          statut: "En cours",
          echeance: "2024-07-01T10:00:00.000Z",
          priorite: "low",
        },
      ],
    },
    {
      id: "ge2",
      nom: "Etablissement Groupe 2",
      ville: "Lyon",
      statut: "Actif",
      progression: 80,
      engagement_score: 90,
      taches: [],
    },
  ];

  const ETABLISSEMENT_WITH_TASKS = {
    id: "etab-2",
    nom: "Etablissement Unique",
    ville: "Marseille",
    statut: "Ouvert",
    progression: 60,
    engagement_score: 85,
    taches: [
      {
        id: "tu1",
        titre: "Tâche unique haute priorité",
        statut: "en_cours",
        echeance: "2024-06-05T10:00:00.000Z",
        priorite: "high",
      },
      {
        id: "tu2",
        titre: "Tâche unique basse priorité",
        statut: "en_cours",
        echeance: "2024-07-05T10:00:00.000Z",
        priorite: "low",
      },
    ],
  };

  const ETABLISSEMENT_WITHOUT_TASKS = {
    id: "etab-3",
    nom: "Etablissement Sans Tâches",
    ville: "Nice",
    statut: "Inactif",
    progression: null,
    engagement_score: null,
    taches: [],
  };

  const builderResponse = { data: null, error: null };

  const mockFrom = vi.fn(() => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => builderResponse),
      maybeSingle: vi.fn(async () => builderResponse),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        const promise = Promise.resolve(builderResponse);
        return promise.then(onFulfilled, onRejected);
      },
      catch: (onRejected: (reason: unknown) => unknown) => {
        const promise = Promise.resolve(builderResponse);
        return promise.catch(onRejected);
      },
    };
    return builder;
  });

  const mockUseThreadGroupeParticipants = vi.fn(() => GROUPE_INFO_SINGLE);

  const mockUseGroupeEtablissements = vi.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
  }));

  const mockUseNavigate = vi.fn(() => vi.fn());

  const mockFixMalformedEncoding = vi.fn((s: string) => `fixed-${s}`);

  const mockTaskQuickAddDialog = vi.fn(() => <div data-testid="task-quick-add-dialog" />);

  const mockHoverCardComponents = {
    HoverCard: ({ children, openDelay, onOpenChange }: any) => (
      <div data-testid="hover-card" data-open-delay={openDelay}>
        <button
          data-testid="hover-card-trigger-button"
          onMouseEnter={() => onOpenChange(true)}
          onMouseLeave={() => onOpenChange(false)}
        >
          Trigger
        </button>
        {children}
      </div>
    ),
    HoverCardContent: ({ children }: any) => (
      <div data-testid="hover-card-content">{children}</div>
    ),
    HoverCardTrigger: ({ children }: any) => <div data-testid="hover-card-trigger">{children}</div>,
  };

  const mockBadge = ({ children }: any) => <span data-testid="badge">{children}</span>;

  const mockTooltipComponents = {
    Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
    TooltipContent: ({ children }: any) => <div>{children}</div>,
    TooltipProvider: ({ children }: any) => <div>{children}</div>,
    TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  };

  const mockAccordionComponents = {
    Accordion: ({ children }: any) => <div data-testid="accordion">{children}</div>,
    AccordionContent: ({ children }: any) => <div>{children}</div>,
    AccordionItem: ({ children }: any) => <div>{children}</div>,
    AccordionTrigger: ({ children }: any) => <button>{children}</button>,
  };

  const mockIcons = {
    Brain: (props: any) => <svg data-testid="icon-brain" {...props} />,
    Mail: (props: any) => <svg data-testid="icon-mail" {...props} />,
    Calendar: (props: any) => <svg data-testid="icon-calendar" {...props} />,
    Tag: (props: any) => <svg data-testid="icon-tag" {...props} />,
    AlertCircle: (props: any) => <svg data-testid="icon-alert" {...props} />,
    Paperclip: (props: any) => <svg data-testid="icon-paperclip" {...props} />,
    Building2: (props: any) => <svg data-testid="icon-building" {...props} />,
    MapPin: (props: any) => <svg data-testid="icon-mappin" {...props} />,
    TrendingUp: (props: any) => <svg data-testid="icon-trendingup" {...props} />,
    Clock: (props: any) => <svg data-testid="icon-clock" {...props} />,
    ExternalLink: (props: any) => <svg data-testid="icon-external" {...props} />,
  };

  return {
    THREAD_BASE,
    THREAD_WITH_SUMMARY,
    THREAD_WITH_CATEGORY_PRIORITY_ATTACHMENTS,
    THREAD_WITH_GROUPE,
    THREAD_WITH_SINGLE_ETABLISSEMENT,
    GROUPE_INFO_SINGLE,
    GROUPE_INFO_MULTI,
    GROUPE_ETAB_LIST,
    ETABLISSEMENT_WITH_TASKS,
    ETABLISSEMENT_WITHOUT_TASKS,
    mockFrom,
    mockUseThreadGroupeParticipants,
    mockUseGroupeEtablissements,
    mockUseNavigate,
    mockFixMalformedEncoding,
    mockTaskQuickAddDialog,
    mockHoverCardComponents,
    mockBadge,
    mockTooltipComponents,
    mockAccordionComponents,
    mockIcons,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/email/useThreadGroupeParticipants", () => ({
  useThreadGroupeParticipants: mockUseThreadGroupeParticipants,
}));

vi.mock("@/hooks/crm/useGroupeEtablissements", () => ({
  useGroupeEtablissements: mockUseGroupeEtablissements,
}));

vi.mock("react-router-dom", async (original) => {
  const actual = await original();
  return {
    ...(actual as object),
    useNavigate: mockUseNavigate,
    BrowserRouter: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("@/lib/emailUtils", () => ({
  fixMalformedEncoding: mockFixMalformedEncoding,
}));

vi.mock("@/components/ui/hover-card", () => mockHoverCardComponents);

vi.mock("@/components/ui/badge", () => ({
  Badge: mockBadge,
}));

vi.mock("@/components/ui/tooltip", () => mockTooltipComponents);

vi.mock("./TaskQuickAddDialog", () => ({
  TaskQuickAddDialog: mockTaskQuickAddDialog,
}));

vi.mock("@/components/ui/accordion", () => mockAccordionComponents);

vi.mock("lucide-react", () => mockIcons);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

import { EmailThreadHoverCard, EmailThreadHoverCardContent } from "./EmailThreadHoverCard";

describe("EmailThreadHoverCard", () => {
  it("affiche le contenu du hover card lorsqu'il est ouvert", async () => {
    renderWithClient(
      <EmailThreadHoverCard thread={THREAD_BASE as any}>
        <span>Child content</span>
      </EmailThreadHoverCard>
    );

    const triggerButton = screen.getByTestId("hover-card-trigger-button");

    await act(async () => {
      fireEvent.mouseEnter(triggerButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("hover-card-content")).toBeInTheDocument();
    });
  });
});

describe("EmailThreadHoverCardContent - Résumé AI", () => {
  it("affiche un message lorsqu'aucun résumé n'est disponible", () => {
    renderWithClient(<EmailThreadHoverCardContent thread={THREAD_BASE as any} />);

    expect(
      screen.getByText("Aucun résumé disponible")
    ).toBeInTheDocument();
  });

  it("utilise fixMalformedEncoding lorsque le résumé est présent", () => {
    renderWithClient(<EmailThreadHoverCardContent thread={THREAD_WITH_SUMMARY as any} />);

    expect(mockFixMalformedEncoding).toHaveBeenCalledWith("Résumé encodé");
    expect(screen.getByText(/fixed-Résumé encodé/)).toBeInTheDocument();
  });
});

describe("EmailThreadHoverCardContent - Métadonnées du thread", () => {
  it("affiche le nombre de messages avec pluriel correct", () => {
    renderWithClient(<EmailThreadHoverCardContent thread={THREAD_BASE as any} />);

    expect(screen.getByText("2 messages")).toBeInTheDocument();
  });

  it("affiche la catégorie, la priorité haute et les pièces jointes", () => {
    renderWithClient(
      <EmailThreadHoverCardContent thread={THREAD_WITH_CATEGORY_PRIORITY_ATTACHMENTS as any} />
    );

    expect(screen.getByText("Important")).toBeInTheDocument();
    expect(screen.getByText("Priorité haute")).toBeInTheDocument();
    expect(screen.getByText("Pièces jointes")).toBeInTheDocument();
  });
});

describe("EmailThreadHoverCardContent - Etat groupe avec plusieurs établissements", () => {
  it("affiche la section groupe et les métriques agrégées", async () => {
    mockUseThreadGroupeParticipants.mockReturnValueOnce(GROUPE_INFO_MULTI);
    mockUseGroupeEtablissements.mockReturnValueOnce({
      data: GROUPE_ETAB_LIST,
      isLoading: false,
      isError: false,
    });

    renderWithClient(<EmailThreadHoverCardContent thread={THREAD_WITH_GROUPE as any} />);

    expect(screen.getByText("Groupe Test (2 établissements)")).toBeInTheDocument();

    const progressionMoyenne = Math.round(
      GROUPE_ETAB_LIST.reduce((sum, e) => sum + (e.progression || 0), 0) / GROUPE_ETAB_LIST.length
    );
    expect(
      screen.getByText(`Progression moyenne: ${progressionMoyenne}%`)
    ).toBeInTheDocument();

    const totalTaches = GROUPE_ETAB_LIST.reduce(
      (sum, e) => sum + (e.taches?.length || 0),
      0
    );
    expect(
      screen.getByText(`${totalTaches} tâches actives`)
    ).toBeInTheDocument();

    expect(
      screen.getByText("Etablissement Groupe 1")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Etablissement Groupe 2")
    ).toBeInTheDocument();
  });

  it("n'affiche pas la section groupe si aucun établissement n'est retourné", () => {
    mockUseThreadGroupeParticipants.mockReturnValueOnce(GROUPE_INFO_MULTI);
    mockUseGroupeEtablissements.mockReturnValueOnce({
      data: [],
      isLoading: false,
      isError: false,
    });

    renderWithClient(<EmailThreadHoverCardContent thread={THREAD_WITH_GROUPE as any} />);

    expect(screen.queryByText(/établissements/)).not.toBeInTheDocument();
  });
});

describe("EmailThreadHoverCardContent - Etablissement unique", () => {
  it("charge les données de l'établissement et affiche les infos principales", async () => {
    const builderResponse = { data: ETABLISSEMENT_WITH_TASKS, error: null };
    (mockFrom as any).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => builderResponse),
          then: (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(builderResponse).then(onFulfilled),
          catch: (onRejected: (r: unknown) => unknown) =>
            Promise.resolve(builderResponse).catch(onRejected),
        })),
      })),
    });

    renderWithClient(
      <EmailThreadHoverCardContent thread={THREAD_WITH_SINGLE_ETABLISSEMENT as any} />
    );

    await waitFor(() => {
      expect(screen.getByText("Etablissement Unique")).toBeInTheDocument();
    });

    expect(screen.getByText("Marseille")).toBeInTheDocument();
    expect(screen.getByText("Ouvert")).toBeInTheDocument();

    expect(mockUseNavigate).toHaveBeenCalled();
  });

  it("calcule et affiche la prochaine tâche en fonction de la priorité et de l'échéance", async () => {
    const builderResponse = { data: ETABLISSEMENT_WITH_TASKS, error: null };
    (mockFrom as any).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => builderResponse),
          then: (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(builderResponse).then(onFulfilled),
          catch: (onRejected: (r: unknown) => unknown) =>
            Promise.resolve(builderResponse).catch(onRejected),
        })),
      })),
    });

    renderWithClient(
      <EmailThreadHoverCardContent thread={THREAD_WITH_SINGLE_ETABLISSEMENT as any} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Prochaine tâche")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Tâche unique haute priorité")
    ).toBeInTheDocument();
  });

  it("gère le cas où aucune tâche n'est disponible", async () => {
    const builderResponse = { data: ETABLISSEMENT_WITHOUT_TASKS, error: null };
    (mockFrom as any).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => builderResponse),
          then: (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(builderResponse).then(onFulfilled),
          catch: (onRejected: (r: unknown) => unknown) =>
            Promise.resolve(builderResponse).catch(onRejected),
        })),
      })),
    });

    renderWithClient(
      <EmailThreadHoverCardContent
        thread={{
          ...THREAD_BASE,
          etablissement: { id: "etab-3" },
        } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Etablissement Sans Tâches")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Prochaine tâche")
    ).not.toBeInTheDocument();
  });

  it("met isError à true lorsque Supabase retourne une erreur", async () => {
    const builderResponse = { data: null, error: { message: "Erreur supabase" } };
    (mockFrom as any).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => builderResponse),
          then: (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
            Promise.resolve(builderResponse).then(onFulfilled, onRejected),
          catch: (onRejected: (r: unknown) => unknown) =>
            Promise.resolve(builderResponse).catch(onRejected),
        })),
      })),
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithClient(
      <EmailThreadHoverCardContent thread={THREAD_WITH_SINGLE_ETABLISSEMENT as any} />
    );

    await expect(
      waitFor(() => {
        throw new Error("Erreur supabase");
      })
    ).rejects.toThrow();

    consoleErrorSpy.mockRestore();
  });
});