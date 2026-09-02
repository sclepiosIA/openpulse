import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { mockFrom, mockToast, builder, builderState } = vi.hoisted(() => {
  const builderState: { result: { data: unknown; error: { message: string } | null } } = {
    result: { data: null, error: null },
  }
  const builder: Record<string, unknown> = {}
  const chainMethods = ["select", "eq", "gte", "lte", "in", "order", "limit", "insert", "update", "delete"]
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(builderState.result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(builderState.result))
  builder.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(builderState.result).then(onFulfilled, onRejected)
  builder.catch = (onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(builderState.result).catch(onRejected)
  const mockFrom = vi.fn(() => builder)
  const mockToast = vi.fn()
  return { mockFrom, mockToast, builder, builderState }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/hooks/crm/useProspectsNextTasks", () => ({
  PROSPECTS_NEXT_TASKS_KEY: ["prospects-next-tasks"],
}))

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="icon-loader" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
    function MockInput(props, ref) {
      return <input ref={ref} {...props} />
    },
  ),
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
    function MockTextarea(props, ref) {
      return <textarea ref={ref} {...props} />
    },
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode
    onValueChange?: (v: string) => void
  }) => (
    <div>
      {children}
      <button
        type="button"
        data-testid="select-choose-vendu"
        onClick={() => onValueChange?.("Vendu")}
      >
        choisir Vendu
      </button>
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}))

import {
  EditableStatut,
  EditableText,
  EditableNumber,
  EditableDate,
  EditableNextStep,
} from "./ProspectInlineEdit"

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("ProspectInlineEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builderState.result = { data: null, error: null }
  })

  describe("EditableText", () => {
    it("affiche la valeur et enregistre une nouvelle valeur dpi via Enter", async () => {
      renderWithClient(
        <EditableText
          prospectId="p1"
          value="ancien-dpi"
          display={<span>ancien-dpi</span>}
          column="dpi"
          label="DPI"
        />,
      )
      expect(screen.getByText("ancien-dpi")).toBeTruthy()
      expect(screen.getByText("DPI")).toBeTruthy()

      const input = screen.getByDisplayValue("ancien-dpi")
      await act(async () => {
        fireEvent.change(input, { target: { value: "nouveau-dpi" } })
        fireEvent.keyDown(input, { key: "Enter" })
      })

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("etablissements")
      })
      expect(builder.update).toHaveBeenCalledWith({ dpi: "nouveau-dpi" })
      expect(builder.eq).toHaveBeenCalledWith("id", "p1")
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "DPI mis à jour" })
      })
    })

    it("ne fait aucun appel supabase si la valeur est inchangée", async () => {
      renderWithClient(
        <EditableText
          prospectId="p1"
          value="inchangé"
          display={<span>inchangé</span>}
          column="dpi"
          label="DPI"
        />,
      )
      const input = screen.getByDisplayValue("inchangé")
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" })
      })
      expect(mockFrom).not.toHaveBeenCalled()
      expect(mockToast).not.toHaveBeenCalled()
    })

    it("affiche un toast destructif en cas d'erreur supabase", async () => {
      builderState.result = { data: null, error: { message: "x" } }
      renderWithClient(
        <EditableText
          prospectId="p1"
          value=""
          display={<span>—</span>}
          column="dpi"
          label="DPI"
        />,
      )
      const input = screen.getByDisplayValue("")
      await act(async () => {
        fireEvent.change(input, { target: { value: "valeur" } })
        fireEvent.keyDown(input, { key: "Enter" })
      })
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Erreur",
          description: "x",
          variant: "destructive",
        })
      })
    })
  })

  describe("EditableStatut", () => {
    it("met à jour le statut via le select", async () => {
      renderWithClient(
        <EditableStatut prospectId="p2" value="Prospect" display={<span>Prospect</span>} />,
      )
      expect(screen.getByText("Statut")).toBeTruthy()

      await act(async () => {
        fireEvent.click(screen.getByTestId("select-choose-vendu"))
      })

      await waitFor(() => {
        expect(builder.update).toHaveBeenCalledWith({ statut: "Vendu" })
      })
      expect(builder.eq).toHaveBeenCalledWith("id", "p2")
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Statut mis à jour" })
      })
    })
  })

  describe("EditableNumber", () => {
    it("parse la valeur avec espaces et enregistre un nombre", async () => {
      renderWithClient(
        <EditableNumber
          prospectId="p3"
          value="500"
          display={<span>500</span>}
          column="nombre_passages_urgences_annuel"
          label="Passages urgences"
        />,
      )
      const input = screen.getByDisplayValue("500")
      await act(async () => {
        fireEvent.change(input, { target: { value: "1 000" } })
        fireEvent.keyDown(input, { key: "Enter" })
      })
      await waitFor(() => {
        expect(builder.update).toHaveBeenCalledWith({ nombre_passages_urgences_annuel: 1000 })
      })
      expect(builder.eq).toHaveBeenCalledWith("id", "p3")
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Passages urgences mis à jour" })
      })
    })

    it("refuse une valeur non numérique sans appeler supabase", async () => {
      renderWithClient(
        <EditableNumber
          prospectId="p3"
          value={null}
          display={<span>—</span>}
          column="nombre_passages_urgences_annuel"
          label="Passages urgences"
        />,
      )
      const input = screen.getByDisplayValue("")
      await act(async () => {
        fireEvent.change(input, { target: { value: "abc" } })
        fireEvent.keyDown(input, { key: "Enter" })
      })
      expect(mockToast).toHaveBeenCalledWith({ title: "Valeur invalide", variant: "destructive" })
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe("EditableDate", () => {
    it("enregistre une nouvelle date", async () => {
      renderWithClient(
        <EditableDate
          prospectId="p4"
          value="2024-01-15T00:00:00Z"
          display={<span>15/01/2024</span>}
          column="date_previsionnelle_signature"
          label="Signature prévue"
        />,
      )
      const input = screen.getByDisplayValue("2024-01-15")
      await act(async () => {
        fireEvent.change(input, { target: { value: "2024-06-30" } })
        fireEvent.keyDown(input, { key: "Enter" })
      })
      await waitFor(() => {
        expect(builder.update).toHaveBeenCalledWith({
          date_previsionnelle_signature: "2024-06-30",
        })
      })
      expect(builder.eq).toHaveBeenCalledWith("id", "p4")
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Signature prévue mis à jour" })
      })
    })
  })

  describe("EditableNextStep", () => {
    it("persiste le next step directement sur l'établissement", async () => {
      renderWithClient(
        <EditableNextStep prospectId="p5" display={<span>Aucune tâche</span>} />,
      )
      const textarea = screen.getByPlaceholderText("Ex : Relancer par email, envoyer une étude…")
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "Relancer le prospect" } })
      })
      const saveButton = screen.getByTestId("icon-check").closest("button")
      expect(saveButton).toBeTruthy()
      await act(async () => {
        if (saveButton) fireEvent.click(saveButton)
      })
      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith("etablissements")
      })
      expect(builder.update).toHaveBeenCalledWith({
        prochaine_action_orga: "Relancer le prospect",
        date_action_orga: null,
      })
      expect(builder.eq).toHaveBeenCalledWith("id", "p5")
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Next step mis à jour" })
      })
    })

    it("ignore le taskId de compatibilité et met à jour l'établissement", async () => {
      renderWithClient(
        <EditableNextStep
          prospectId="p5"
          taskId="t1"
          title="Ancien titre"
          echeance="2024-02-01T00:00:00Z"
          display={<span>Ancien titre</span>}
        />,
      )
      const textarea = screen.getByDisplayValue("Ancien titre")
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "Nouveau titre" } })
      })
      const saveButton = screen.getByTestId("icon-check").closest("button")
      await act(async () => {
        if (saveButton) fireEvent.click(saveButton)
      })
      await waitFor(() => {
        expect(builder.update).toHaveBeenCalledWith({
          prochaine_action_orga: "Nouveau titre",
          date_action_orga: "2024-02-01",
        })
      })
      expect(mockFrom).toHaveBeenCalledWith("etablissements")
      expect(builder.eq).toHaveBeenCalledWith("id", "p5")
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Next step mis à jour" })
      })
    })

    it("refuse un titre vide sans appeler supabase", async () => {
      renderWithClient(<EditableNextStep prospectId="p5" display={<span>—</span>} />)
      const saveButton = screen.getByTestId("icon-check").closest("button")
      await act(async () => {
        if (saveButton) fireEvent.click(saveButton)
      })
      expect(mockToast).toHaveBeenCalledWith({ title: "Titre requis", variant: "destructive" })
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })
})
