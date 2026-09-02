// @vitest-environment jsdom
import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PartenaireCreateForm } from "./PartenaireCreateForm"

const {
  PROFILES,
  createMutateAsyncMock,
  createMutationState,
  debugErrorMock,
  lastPartenaireFormProps,
} = vi.hoisted(() => ({
  PROFILES: [
    { id: "p1", first_name: "Alice", last_name: "Martin", role: "admin" },
    { id: "p2", first_name: "Bob", last_name: "Durand", role: "user" },
  ],
  createMutateAsyncMock: vi.fn(),
  createMutationState: {
    isPending: false,
  },
  debugErrorMock: vi.fn(),
  lastPartenaireFormProps: { current: null as null | Record<string, unknown> },
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: vi.fn(() => undefined),
}))

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: vi.fn(() => ({
    data: PROFILES,
    isLoading: false,
    isError: false,
    error: null,
  })),
}))

vi.mock("@/hooks/crm/usePartenaires", () => ({
  useCreatePartenaire: vi.fn(() => ({
    mutateAsync: createMutateAsyncMock,
    get isPending() {
      return createMutationState.isPending
    },
  })),
}))

vi.mock("@/lib/validations", () => ({
  CreatePartenaireSchema: {},
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) =>
    open ? (
      <div data-testid="dialog-root">
        <button type="button" onClick={() => onOpenChange(false)}>
          close-dialog
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock("@/components/partenaire/PartenaireForm", () => ({
  PartenaireForm: (props: {
    form: { getValues: () => Record<string, unknown> }
    onSubmit: (data: Record<string, unknown>) => Promise<void>
    onCancel: () => void
    submitLabel: string
    isLoading: boolean
    allProfiles: Array<Record<string, unknown>>
  }) => {
    lastPartenaireFormProps.current = props as unknown as Record<string, unknown>
    const values = props.form.getValues()
    return (
      <div data-testid="partenaire-form">
        <div data-testid="submit-label">{props.submitLabel}</div>
        <div data-testid="is-loading">{String(props.isLoading)}</div>
        <div data-testid="profiles-count">{String(props.allProfiles.length)}</div>
        <div data-testid="default-nom">{String(values.nom)}</div>
        <div data-testid="default-type">{String(values.type_partenaire)}</div>
        <div data-testid="default-pays">{String(values.pays)}</div>
        <div data-testid="default-statut">{String(values.statut_relation)}</div>
        <div data-testid="default-engagement">{String(values.engagement_score)}</div>
        <div data-testid="default-domains">{JSON.stringify(values.email_domains)}</div>
        <button
          type="button"
          onClick={() =>
            props.onSubmit({
              nom: "Partenaire Test",
              type_partenaire: "industriel",
              sous_type: "",
              adresse: "",
              code_postal: "",
              ville: "",
              region: "",
              pays: "France",
              telephone: "",
              email: "",
              site_web: "",
              email_domains: ["ignored.org"],
              statut_relation: "prospect",
              date_debut_partenariat: "",
              date_fin_partenariat: "",
              responsable_marque_id: "none",
              engagement_score: 0,
              dernier_contact: "",
              prochaine_action: "",
              valeur_partenariat: undefined,
              notes: "",
              tags: [],
            })
          }
        >
          submit-success
        </button>
        <button
          type="button"
          onClick={() =>
            props.onSubmit({
              nom: "Partenaire Erreur",
              type_partenaire: "institutionnel",
              sous_type: "",
              adresse: "",
              code_postal: "",
              ville: "",
              region: "",
              pays: "France",
              telephone: "",
              email: "",
              site_web: "",
              email_domains: [],
              statut_relation: "prospect",
              date_debut_partenariat: "",
              date_fin_partenariat: "",
              responsable_marque_id: "",
              engagement_score: 0,
              dernier_contact: "",
              prochaine_action: "",
              valeur_partenariat: undefined,
              notes: "",
              tags: [],
            })
          }
        >
          submit-error
        </button>
        <button type="button" onClick={props.onCancel}>
          cancel-form
        </button>
      </div>
    )
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("PartenaireCreateForm", () => {
  beforeEach(() => {
    createMutateAsyncMock.mockReset()
    debugErrorMock.mockReset()
    createMutationState.isPending = false
    lastPartenaireFormProps.current = null
  })

  it("affiche les valeurs par défaut métier et transmet les profils ainsi que l'état de chargement", () => {
    createMutationState.isPending = true
    const onOpenChange = vi.fn()

    render(<PartenaireCreateForm open={true} onOpenChange={onOpenChange} initialDomain="clinic.fr" />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText("Créer un nouveau partenaire")).toBeInTheDocument()
    expect(screen.getByText("Ajoutez un nouveau partenaire institutionnel, industriel ou prestataire")).toBeInTheDocument()
    expect(screen.getByTestId("submit-label")).toHaveTextContent("Créer le partenaire")
    expect(screen.getByTestId("is-loading")).toHaveTextContent("true")
    expect(screen.getByTestId("profiles-count")).toHaveTextContent("2")
    expect(screen.getByTestId("default-nom")).toHaveTextContent("")
    expect(screen.getByTestId("default-type")).toHaveTextContent("institutionnel")
    expect(screen.getByTestId("default-pays")).toHaveTextContent("France")
    expect(screen.getByTestId("default-statut")).toHaveTextContent("prospect")
    expect(screen.getByTestId("default-engagement")).toHaveTextContent("0")
    expect(screen.getByTestId("default-domains")).toHaveTextContent('["clinic.fr"]')
  })

  it("soumet les données transformées, remplace email_domains par initialDomain et ferme la modale en succès", async () => {
    createMutateAsyncMock.mockResolvedValue({ data: { id: "new-1" }, error: null })
    const onOpenChange = vi.fn()

    render(<PartenaireCreateForm open={true} onOpenChange={onOpenChange} initialDomain="hopital.fr" />, {
      wrapper: createWrapper(),
    })

    fireEvent.click(screen.getByText("submit-success"))

    await waitFor(() => {
      expect(createMutateAsyncMock).toHaveBeenCalledTimes(1)
    })

    expect(createMutateAsyncMock).toHaveBeenCalledWith({
      nom: "Partenaire Test",
      type_partenaire: "industriel",
      sous_type: undefined,
      adresse: undefined,
      code_postal: undefined,
      ville: undefined,
      region: undefined,
      pays: "France",
      telephone: undefined,
      email: undefined,
      site_web: undefined,
      email_domains: ["hopital.fr"],
      statut_relation: "prospect",
      date_debut_partenariat: undefined,
      date_fin_partenariat: undefined,
      responsable_marque_id: undefined,
      engagement_score: 0,
      dernier_contact: undefined,
      prochaine_action: undefined,
      valeur_partenariat: undefined,
      notes: undefined,
      tags: [],
    })

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("gère l'annulation en fermant la modale", () => {
    const onOpenChange = vi.fn()

    render(<PartenaireCreateForm open={true} onOpenChange={onOpenChange} />, {
      wrapper: createWrapper(),
    })

    fireEvent.click(screen.getByText("cancel-form"))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("capture l'erreur de mutation via debug.error et ne ferme pas la modale", async () => {
    const failure = { data: null, error: { message: "x" } }
    createMutateAsyncMock.mockRejectedValue(failure)
    const onOpenChange = vi.fn()

    render(<PartenaireCreateForm open={true} onOpenChange={onOpenChange} />, {
      wrapper: createWrapper(),
    })

    fireEvent.click(screen.getByText("submit-error"))

    await waitFor(() => {
      expect(debugErrorMock).toHaveBeenCalledTimes(1)
    })

    expect(debugErrorMock).toHaveBeenCalledWith("Error creating partenaire:", failure)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})