// @vitest-environment jsdom
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { ProspectLastExchangesHoverCard } from "./ProspectLastExchangesHoverCard"

const {
  THREAD_ROWS,
  MESSAGE_ROW,
  EMPTY_THREADS,
  mockFrom,
  hoverCardContentProps,
} = vi.hoisted(() => ({
  THREAD_ROWS: [
    {
      id: "thread-1",
      subject: "Sujet prospect",
      ai_generated_title: "Relance commerciale",
      last_message_date: "2024-05-15T10:00:00.000Z",
    },
  ],
  MESSAGE_ROW: {
    from_name: "Alice Martin",
    from_address: "alice@example.test",
    body_text: "Bonjour,\nVoici un récapitulatif de nos derniers échanges.".repeat(8),
    sent_date: "2024-05-16T14:30:00.000Z",
  },
  EMPTY_THREADS: [] as Array<{
    id: string
    subject: string
    ai_generated_title: string
    last_message_date: string
  }>,
  mockFrom: vi.fn(),
  hoverCardContentProps: vi.fn(),
}))

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-root">{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-trigger">{children}</div>,
  HoverCardContent: ({
    children,
    ...props
  }: {
    children: React.ReactNode
    side?: string
    align?: string
    className?: string
  }) => {
    hoverCardContentProps(props)
    return <div data-testid="hover-card-content">{children}</div>
  },
}))

vi.mock("lucide-react", () => ({
  Mail: () => <svg data-testid="icon-mail" />,
  MessageSquare: () => <svg data-testid="icon-message-square" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
}))

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createThenableResult<T>(result: T) {
  return {
    then: (resolve: (value: T) => unknown) => Promise.resolve(resolve(result)),
    catch: () => Promise.resolve(result),
  }
}

function createBuilder(result: { data: unknown; error: unknown }) {
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
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: createThenableResult(result).then,
    catch: createThenableResult(result).catch,
  }
  return builder
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("ProspectLastExchangesHoverCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("affiche le résumé IA et le dernier email avec les valeurs métiers attendues", async () => {
    const threadBuilder = createBuilder({ data: THREAD_ROWS, error: null })
    const messageBuilder = createBuilder({ data: MESSAGE_ROW, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === "email_threads") return threadBuilder
      if (table === "email_messages") return messageBuilder
      return createBuilder({ data: null, error: null })
    })

    renderWithClient(
      <ProspectLastExchangesHoverCard
        etablissementId="eta-1"
        aiSummary="Le prospect a demandé une proposition tarifaire."
        summaryUpdatedAt="2024-05-17T09:45:00.000Z"
      >
        <button>Ouvrir</button>
      </ProspectLastExchangesHoverCard>,
    )

    expect(screen.getByText("Derniers échanges")).toBeInTheDocument()
    expect(screen.getByText("Ouvrir")).toBeInTheDocument()
    expect(screen.getByText("Résumé IA")).toBeInTheDocument()
    expect(screen.getByText("Le prospect a demandé une proposition tarifaire.")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_threads")
      expect(mockFrom).toHaveBeenCalledWith("email_messages")
    })

    expect(await screen.findByText("Alice Martin")).toBeInTheDocument()
    expect(screen.getByText("Relance commerciale")).toBeInTheDocument()
    expect(
      screen.getByText((content) => content.includes("Bonjour,") && content.includes("récapitulatif")),
    ).toBeInTheDocument()
    expect(screen.getByText(format(new Date("2024-05-17T09:45:00.000Z"), "d MMM yyyy 'à' HH:mm", { locale: fr }))).toBeInTheDocument()
    expect(screen.getByText(format(new Date(MESSAGE_ROW.sent_date), "d MMM yyyy 'à' HH:mm", { locale: fr }))).toBeInTheDocument()
    expect(screen.getByText("Clic droit sur la ligne pour envoyer un email")).toBeInTheDocument()

    expect(threadBuilder.select).toHaveBeenCalledWith("id, subject, ai_generated_title, last_message_date")
    expect(threadBuilder.eq).toHaveBeenCalledWith("etablissement_id", "eta-1")
    expect(threadBuilder.order).toHaveBeenCalledWith("last_message_date", { ascending: false })
    expect(threadBuilder.limit).toHaveBeenCalledWith(1)

    expect(messageBuilder.select).toHaveBeenCalledWith("from_name, from_address, body_text, sent_date")
    expect(messageBuilder.eq).toHaveBeenCalledWith("thread_id", "thread-1")
    expect(messageBuilder.order).toHaveBeenCalledWith("sent_date", { ascending: false })
    expect(messageBuilder.limit).toHaveBeenCalledWith(1)
    expect(messageBuilder.maybeSingle).toHaveBeenCalled()

    expect(hoverCardContentProps).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "left",
        align: "start",
        className: "w-96 p-0",
      }),
    )
  })

  it("affiche le message vide quand aucun résumé ni échange récent n'existe", async () => {
    const threadBuilder = createBuilder({ data: EMPTY_THREADS, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === "email_threads") return threadBuilder
      return createBuilder({ data: null, error: null })
    })

    renderWithClient(
      <ProspectLastExchangesHoverCard etablissementId="eta-2">
        <span>Trigger</span>
      </ProspectLastExchangesHoverCard>,
    )

    expect(
      await screen.findByText("Aucun échange récent enregistré pour ce prospect."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Résumé IA")).not.toBeInTheDocument()
    expect(screen.queryByTestId("icon-mail")).not.toBeInTheDocument()
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith("email_threads")
  })

  it("tolère une erreur de requête et conserve le rendu statique sans contenu métier", async () => {
    const threadBuilder = createBuilder({ data: null, error: { message: "x" } })

    mockFrom.mockImplementation((table: string) => {
      if (table === "email_threads") return threadBuilder
      return createBuilder({ data: null, error: null })
    })

    renderWithClient(
      <ProspectLastExchangesHoverCard etablissementId="eta-3">
        <span>Voir</span>
      </ProspectLastExchangesHoverCard>,
    )

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_threads")
    })

    expect(screen.getByText("Derniers échanges")).toBeInTheDocument()
    expect(screen.getByText("Voir")).toBeInTheDocument()
    expect(
      screen.getByText("Aucun échange récent enregistré pour ce prospect."),
    ).toBeInTheDocument()
    expect(screen.getByText("Clic droit sur la ligne pour envoyer un email")).toBeInTheDocument()
    expect(screen.queryByText("Résumé IA")).not.toBeInTheDocument()
  })
})