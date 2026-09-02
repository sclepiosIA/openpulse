import React from "react"
import { render, screen, fireEvent, within, act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BlockedEtablissementsSection } from "./BlockedEtablissementsSection"

const {
  stableUser,
  toast,
  updateMutation,
  calculateEtablissementValueMock,
  formatNumberMock,
  nowIsoDate,
  setupUpdateMutationState,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const stableUser = { id: "u1", email: "t@t.co" }

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }

  const updateMutation = {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as null | { message: string },
  }

  const calculateEtablissementValueMock = vi.fn<(e: { id: string }) => number>()
  const formatNumberMock = vi.fn<(n: number) => string>()

  const setupUpdateMutationState = (state: { isPending?: boolean; isError?: boolean; error?: { message: string } | null }) => {
    updateMutation.isPending = Boolean(state.isPending)
    updateMutation.isError = Boolean(state.isError)
    updateMutation.error = state.error ?? null
  }

  const nowIsoDate = "2024-05-06"

  const builder: Record<string, unknown> = {}
  const chain = () => builder

  const methods = [
    "select",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "contains",
    "overlaps",
    "like",
    "ilike",
    "is",
    "or",
    "order",
    "range",
    "limit",
    "insert",
    "upsert",
    "update",
    "delete",
    "rpc",
  ] as const

  for (const m of methods) builder[m] = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  builder.then = vi.fn((onFulfilled: (v: unknown) => unknown) => Promise.resolve(onFulfilled({ data: null, error: null })))
  builder.catch = vi.fn(() => Promise.resolve({ data: null, error: null }))

  const mockFrom = vi.fn(() => builder)

  return {
    stableUser,
    toast,
    updateMutation,
    calculateEtablissementValueMock,
    formatNumberMock,
    nowIsoDate,
    setupUpdateMutationState,
    builder,
    mockFrom,
  }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
  },
}))

vi.mock("sonner", () => ({ toast }))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: stableUser, session: { user: stableUser }, isLoading: false }),
}))
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: stableUser, session: { user: stableUser }, isLoading: false }),
}))
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: stableUser, session: { user: stableUser }, isLoading: false }),
}))

vi.mock("@/lib/valueCalculations", () => ({
  calculateEtablissementValue: calculateEtablissementValueMock,
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
  formatNumber: formatNumberMock,
}))

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useUpdateEtablissement: () => updateMutation,
}))

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

vi.mock("lucide-react", () => ({
  AlertTriangle: (p: React.SVGProps<SVGSVGElement>) => <svg aria-label="alert-triangle" {...p} />,
  ChevronDown: (p: React.SVGProps<SVGSVGElement>) => <svg aria-label="chevron-down" {...p} />,
  ChevronUp: (p: React.SVGProps<SVGSVGElement>) => <svg aria-label="chevron-up" {...p} />,
  Unlock: (p: React.SVGProps<SVGSVGElement>) => <svg aria-label="unlock" {...p} />,
  Calendar: (p: React.SVGProps<SVGSVGElement>) => <svg aria-label="calendar" {...p} />,
  FileText: (p: React.SVGProps<SVGSVGElement>) => <svg aria-label="file-text" {...p} />,
  Building2: (p: React.SVGProps<SVGSVGElement>) => <svg aria-label="building2" {...p} />,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...p }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...p}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...p }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header" {...p}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...p }: { children: React.ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...p}>{children}</h3>,
  CardDescription: ({ children, ...p }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
  CardContent: ({ children, ...p }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" {...p}>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="button" {...p}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...p }: { children: React.ReactNode } & React.HTMLAttributes<HTMLSpanElement>) => <span {...p}>{children}</span>,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange?: (v: boolean) => void
    children: React.ReactNode
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    value: string
    onValueChange: (v: string) => void
  } | null>(null)

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string
      onValueChange: (v: string) => void
      children: React.ReactNode
    }) => <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>,
    SelectTrigger: ({ id, children }: { id?: string; children: React.ReactNode }) => (
      <button type="button" id={id}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(SelectContext)
      return (
        <button type="button" onClick={() => ctx?.onValueChange(value)}>
          {children}
        </button>
      )
    },
  }
})

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} />,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...p }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) => <label {...p}>{children}</label>,
}))

vi.mock("@/components/ui/icon-circle", () => ({
  IconCircle: ({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) => (
    <span data-testid="icon-circle">
      <Icon />
    </span>
  ),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createTestQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("BlockedEtablissementsSection", () => {
  it("chargement (renderHook wrapper QueryClientProvider) puis succès: affiche compteur + valeur totale puis détails après expansion", async () => {
    const wrapper = createWrapper()
    renderHook(() => ({ ok: true }), { wrapper })

    formatNumberMock.mockImplementation((n) => `n:${n}`)

    const etablissements = [
      {
        id: "e1",
        nom: "Alpha",
        ville: "Paris",
        statut: "Bloqué",
        notes: "🚫 [2024-01-10] Dossier incomplet\nAutre ligne",
      },
      {
        id: "e2",
        nom: "Bravo",
        ville: "Lyon",
        statut: "Prospect",
        notes: null,
      },
      {
        id: "e3",
        nom: "Charlie",
        ville: "Marseille",
        statut: "Bloqué",
        notes: "Texte sans motif",
      },
    ] as const

    calculateEtablissementValueMock.mockImplementation((e) => {
      if (e.id === "e1") return 1200
      if (e.id === "e3") return 0
      return 0
    })

    render(<BlockedEtablissementsSection etablissements={etablissements as unknown as Parameters<typeof BlockedEtablissementsSection>[0]["etablissements"]} />)

    expect(screen.getByText("Établissements bloqués")).toBeTruthy()
    expect(screen.getByText("2")).toBeTruthy()
    expect(formatNumberMock).toHaveBeenCalledWith(1200)
    expect(screen.getByText("Valeur totale bloquée : n:1200 €")).toBeTruthy()

    fireEvent.click(screen.getByTestId("card-header"))

    expect(screen.getByText("Alpha")).toBeTruthy()
    expect(screen.getByText("Paris")).toBeTruthy()
    expect(screen.getByText("Dossier incomplet")).toBeTruthy()
    expect(screen.getByText(/Bloqué le/i)).toBeTruthy()
    expect(screen.getByText("Valeur : n:1200 €")).toBeTruthy()

    expect(screen.getByText("Charlie")).toBeTruthy()
    expect(screen.getByText("Marseille")).toBeTruthy()
    expect(screen.getByText("Raison non spécifiée")).toBeTruthy()
  })

  it("mutation: ouvre le dialog, nécessite une raison, puis appelle mutate avec id+statut+notes et onSuccess ferme le dialog", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${nowIsoDate}T10:00:00.000Z`))

    setupUpdateMutationState({ isPending: false, isError: false, error: null })
    updateMutation.mutate.mockReset()

    formatNumberMock.mockImplementation((n) => `n:${n}`)
    calculateEtablissementValueMock.mockReturnValue(100)

    const etablissement = {
      id: "e1",
      nom: "Alpha",
      ville: "Paris",
      statut: "Bloqué",
      notes: "🚫 [2024-01-10] Dossier incomplet",
    } as const

    render(<BlockedEtablissementsSection etablissements={[etablissement] as unknown as Parameters<typeof BlockedEtablissementsSection>[0]["etablissements"]} />)

    fireEvent.click(screen.getByTestId("card-header"))

    fireEvent.click(screen.getByRole("button", { name: /Débloquer/i }))

    const dialog = screen.getByTestId("dialog")
    expect(within(dialog).getByText("Débloquer l'établissement")).toBeTruthy()
    expect(within(dialog).getByText(/Vous êtes sur le point de débloquer/i)).toBeTruthy()
    expect(within(dialog).getByText("Alpha")).toBeTruthy()

    const confirmButton = within(dialog).getByRole("button", { name: "Confirmer" })
    expect(confirmButton).toBeDisabled()

    const textarea = within(dialog).getByLabelText("Raison du déblocage") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Justifié" } })
    expect(confirmButton).not.toBeDisabled()

    fireEvent.click(within(dialog).getByRole("button", { name: "Contacté" }))

    await act(async () => {
      fireEvent.click(confirmButton)
    })

    expect(updateMutation.mutate).toHaveBeenCalledTimes(1)

    const call = updateMutation.mutate.mock.calls[0] as unknown as [
      { id: string; data: { statut: string; notes: string } },
      { onSuccess?: () => void },
    ]
    const payload = call[0]
    const options = call[1]

    expect(payload.id).toBe("e1")
    expect(payload.data.statut).toBe("Contacté")
    expect(payload.data.notes).toContain("🚫 [2024-01-10] Dossier incomplet")
    expect(payload.data.notes).toContain(`✅ [${nowIsoDate}] Débloqué: Justifié`)

    await act(async () => {
      options.onSuccess?.()
    })

    expect(screen.queryByTestId("dialog")).toBeNull()

    vi.useRealTimers()
  })

  it("ERREUR: quand le hook retourne isError et {data:null,error:{message:'x'}}, l'état d'erreur est exposé et le bouton est disabled si isPending", async () => {
    const wrapper = createWrapper()
    renderHook(() => ({ ok: true }), { wrapper })

    setupUpdateMutationState({ isPending: false, isError: true, error: { message: "x" } })

    formatNumberMock.mockImplementation((n) => `n:${n}`)
    calculateEtablissementValueMock.mockReturnValue(10)

    const etablissement = {
      id: "e1",
      nom: "Alpha",
      ville: "Paris",
      statut: "Bloqué",
      notes: null,
    } as const

    const { rerender } = render(
      <BlockedEtablissementsSection etablissements={[etablissement] as unknown as Parameters<typeof BlockedEtablissementsSection>[0]["etablissements"]} />,
    )

    fireEvent.click(screen.getByTestId("card-header"))
    fireEvent.click(screen.getByRole("button", { name: /Débloquer/i }))

    const dialog = screen.getByTestId("dialog")
    const confirmButton = within(dialog).getByRole("button", { name: "Confirmer" })

    const textarea = within(dialog).getByLabelText("Raison du déblocage") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Ok" } })

    expect(updateMutation.isError).toBe(true)
    expect(updateMutation.error?.message).toBe("x")
    expect(confirmButton).not.toBeDisabled()

    setupUpdateMutationState({ isPending: true, isError: true, error: { message: "x" } })
    rerender(
      <BlockedEtablissementsSection etablissements={[etablissement] as unknown as Parameters<typeof BlockedEtablissementsSection>[0]["etablissements"]} />,
    )

    const dialog2 = screen.getByTestId("dialog")
    const confirmButton2 = within(dialog2).getByRole("button", { name: /Déblocage\.\.\.|Confirmer/ })
    expect(confirmButton2).toBeDisabled()
  })
})