// @vitest-environment jsdom
import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const h = vi.hoisted(() => {
  const state = { listFail: false, insertFail: false }
  const LATEST = {
    id: "act-1",
    activity_type: "call",
    title: "Appel de qualification initial",
    description: "Discussion budget et besoins",
    activity_date: "2024-05-10T10:30:00.000Z",
  }
  const ROWS = [
    {
      id: "act-1",
      etablissement_id: "etab-1",
      activity_type: "call",
      title: "Appel de qualification initial",
      description: "Discussion budget et besoins",
      activity_date: "2024-05-10T10:30:00.000Z",
    },
    {
      id: "act-2",
      etablissement_id: "etab-1",
      activity_type: "email",
      title: "Envoi de la plaquette",
      description: null,
      activity_date: "2024-05-08T09:00:00.000Z",
    },
  ]
  const mockInsert = vi.fn()
  const toastSuccess = vi.fn()
  const toastError = vi.fn()

  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() =>
      state.listFail
        ? Promise.resolve({ data: null, error: { message: "latest failed" } })
        : Promise.resolve({ data: LATEST, error: null })
    ),
    single: vi.fn(() => Promise.resolve({ data: LATEST, error: null })),
    insert: vi.fn((payload: unknown) => {
      mockInsert(payload)
      return Promise.resolve(
        state.insertFail ? { error: { message: "insert failed" } } : { error: null }
      )
    }),
    then: (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) =>
      Promise.resolve(
        state.listFail
          ? { data: null, error: { message: "list failed" } }
          : { data: ROWS, error: null }
      ).then(onFulfilled, onRejected),
    catch: () => Promise.resolve({ data: ROWS, error: null }),
  })

  const mockFrom = vi.fn(() => builder)
  return { state, LATEST, ROWS, mockFrom, mockInsert, toastSuccess, toastError }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: h.mockFrom },
}))

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: { from: h.mockFrom },
}))

vi.mock("sonner", () => ({
  toast: { success: h.toastSuccess, error: h.toastError },
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children?: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}))

import { ProspectInteractionsCell } from "./ProspectInteractionsCell"

function renderCell() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ProspectInteractionsCell etablissementId="etab-1" etablissementNom="Lycée Victor Hugo" />
    </QueryClientProvider>
  )
}

describe("ProspectInteractionsCell", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.state.listFail = false
    h.state.insertFail = false
  })

  it("affiche les deux boutons d'action et charge la dernière interaction", async () => {
    renderCell()

    expect(screen.getByLabelText("Voir l'historique des interactions")).toBeTruthy()
    expect(screen.getByLabelText("Ajouter une interaction")).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText("Appel de qualification initial")).toBeTruthy()
    })
    expect(screen.getByText("Appel")).toBeTruthy()
    expect(screen.getByText("Discussion budget et besoins")).toBeTruthy()
    expect(h.mockFrom).toHaveBeenCalledWith("customer_activities")
  })

  it("affiche 'Aucune interaction enregistrée' quand la requête échoue", async () => {
    h.state.listFail = true
    renderCell()

    await waitFor(() => {
      expect(screen.getByText("Aucune interaction enregistrée")).toBeTruthy()
    })
    expect(screen.queryByText("Appel de qualification initial")).toBeNull()
  })

  it("ouvre le sheet d'historique et liste les interactions", async () => {
    renderCell()

    fireEvent.click(screen.getByLabelText("Voir l'historique des interactions"))

    expect(screen.getByTestId("sheet")).toBeTruthy()
    expect(screen.getByText("Historique des interactions")).toBeTruthy()
    expect(screen.getByText("Lycée Victor Hugo")).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText("Envoi de la plaquette")).toBeTruthy()
    })
    expect(screen.getAllByText("Appel de qualification initial").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Email")).toBeTruthy()
  })

  it("affiche le message vide dans le sheet quand la liste échoue", async () => {
    h.state.listFail = true
    renderCell()

    fireEvent.click(screen.getByLabelText("Voir l'historique des interactions"))

    await waitFor(() => {
      expect(
        screen.getByText("Aucune interaction enregistrée pour cet établissement.")
      ).toBeTruthy()
    })
  })

  it("ouvre le dialog d'ajout et insère une interaction avec les bonnes valeurs", async () => {
    renderCell()

    fireEvent.click(screen.getByLabelText("Ajouter une interaction"))
    expect(screen.getByTestId("dialog")).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText("Ex : Appel de qualification"), {
      target: { value: "Mon appel de suivi" },
    })
    fireEvent.change(screen.getByPlaceholderText("Notes, points abordés, next steps…"), {
      target: { value: "Prochaine étape : démo" },
    })

    await act(async () => {
      fireEvent.click(screen.getByText("Enregistrer"))
    })

    await waitFor(() => {
      expect(h.mockInsert).toHaveBeenCalledTimes(1)
    })
    expect(h.mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        etablissement_id: "etab-1",
        activity_type: "note",
        title: "Mon appel de suivi",
        description: "Prochaine étape : démo",
        status: "completed",
        activity_date: expect.any(String),
      })
    )
    await waitFor(() => {
      expect(h.toastSuccess).toHaveBeenCalledWith("Interaction ajoutée")
    })
    expect(screen.queryByTestId("dialog")).toBeNull()
  })

  it("affiche un toast d'erreur quand l'insertion échoue", async () => {
    h.state.insertFail = true
    renderCell()

    fireEvent.click(screen.getByLabelText("Ajouter une interaction"))

    await act(async () => {
      fireEvent.click(screen.getByText("Enregistrer"))
    })

    await waitFor(() => {
      expect(h.toastError).toHaveBeenCalledWith("insert failed")
    })
    expect(h.toastSuccess).not.toHaveBeenCalled()
    expect(screen.getByTestId("dialog")).toBeTruthy()
  })
})