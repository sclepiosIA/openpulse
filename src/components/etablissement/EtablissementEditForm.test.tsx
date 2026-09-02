/* @vitest-environment jsdom */
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { renderHook } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EtablissementEditForm } from "./EtablissementEditForm"

const {
  ETABLISSEMENT,
  PROFILES,
  AUTH_STATE,
  mockInvalidateQueries,
  mockMutateAsync,
  mockUseUpdateEtablissement,
  mockUseProfilesWithRoles,
  mockBuildDefaults,
  mockSanitizePayload,
  mockDebugLog,
  mockDebugError,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const ETABLISSEMENT = {
    id: "eta-1",
    nom: "CHU Lyon",
    type: "CHU",
    ville: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    adresse: "1 rue de la République",
    code_postal: "69001",
    telephone: "0102030405",
    email: "contact@chu-nord.example.org",
    nombre_passages_urgences_annuel: 120000,
    dpi: "ORBIS",
    directeur_general_prenom: "Jean",
    directeur_general_nom: "Martin",
    directeur_general_email: "jean.martin@chu-nord.example.org",
    siren_client: "123456789",
    date_signature: "2024-01-15",
    date_previsionnelle_signature: "2024-01-10",
    date_fin_contrat: "2027-01-15",
    logo_url: "https://logo.local/chu.png",
  }

  const PROFILES = [
    { id: "p1", first_name: "Alice", last_name: "Admin", role: "admin" },
    { id: "p2", first_name: "Bob", last_name: "Manager", role: "manager" },
  ]

  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }

  const mockInvalidateQueries = vi.fn()
  const mockMutateAsync = vi.fn()
  const mockUseUpdateEtablissement = vi.fn()
  const mockUseProfilesWithRoles = vi.fn()
  const mockBuildDefaults = vi.fn()
  const mockSanitizePayload = vi.fn()
  const mockDebugLog = vi.fn()
  const mockDebugError = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockNavigate = vi.fn()
  const mockFrom = vi.fn()

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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }

  return {
    ETABLISSEMENT,
    PROFILES,
    AUTH_STATE,
    mockInvalidateQueries,
    mockMutateAsync,
    mockUseUpdateEtablissement,
    mockUseProfilesWithRoles,
    mockBuildDefaults,
    mockSanitizePayload,
    mockDebugLog,
    mockDebugError,
    mockToastSuccess,
    mockToastError,
    mockNavigate,
    mockFrom,
    builder,
  }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => builder),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    log: mockDebugLog,
    error: mockDebugError,
  },
}))

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useUpdateEtablissement: mockUseUpdateEtablissement,
}))

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: mockUseProfilesWithRoles,
}))

vi.mock("@/lib/validations", () => ({
  CreateEtablissementSchema: {},
}))

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => undefined,
}))

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("./etablissementFormHelpers", () => ({
  buildEtablissementFormDefaults: mockBuildDefaults,
  sanitizeEtablissementPayload: mockSanitizePayload,
}))

vi.mock("./EtablissementAuSuccesPricing", () => ({
  EtablissementAuSuccesPricing: () => <div data-testid="au-succes-pricing">Au succès pricing</div>,
}))

vi.mock("@/components/ui/EntityLogoUpload", () => ({
  EntityLogoUpload: ({
    currentLogoUrl,
    onLogoChange,
  }: {
    currentLogoUrl: string | null
    onLogoChange: (url: string | null) => void
  }) => (
    <div>
      <div data-testid="logo-url">{currentLogoUrl ?? "no-logo"}</div>
      <button type="button" onClick={() => onLogoChange("https://logo.local/new-logo.png")}>
        Changer logo
      </button>
    </div>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
  }) => (open ? <div data-testid="dialog-root" data-open="true" onClick={() => onOpenChange(true)}>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock("@/components/ui/form", async () => {
  const actual = await vi.importActual<typeof import("react-hook-form")>("react-hook-form")
  return {
    Form: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
    FormMessage: () => null,
    FormField: ({
      control,
      name,
      render: renderProp,
    }: {
      control: unknown
      name: string
      render: (props: {
        field: {
          name: string
          value: unknown
          onChange: (value: unknown) => void
          onBlur: () => void
          ref: React.Ref<HTMLElement>
        }
      }) => React.ReactNode
    }) => (
      <actual.Controller
        control={control as Parameters<typeof actual.Controller>[0]["control"]}
        name={name}
        render={({ field }) => renderProp({ field })}
      />
    ),
  }
})

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
    return <input ref={ref} {...props} />
  }),
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
    return <textarea ref={ref} {...props} />
  }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <select
      data-testid="mock-select"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder ?? ""}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
  BarChart3: () => <span data-testid="chart-icon" />,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

describe("EtablissementEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseProfilesWithRoles.mockReturnValue({
      data: PROFILES,
      isLoading: false,
      isError: false,
      error: null,
    })

    mockUseUpdateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })

    mockBuildDefaults.mockImplementation((etablissement) => ({
      nom: etablissement.nom,
      type: etablissement.type,
      ville: etablissement.ville,
      region: etablissement.region,
      adresse: etablissement.adresse,
      code_postal: etablissement.code_postal,
      telephone: etablissement.telephone,
      email: etablissement.email,
      nombre_passages_urgences_annuel: etablissement.nombre_passages_urgences_annuel,
      dpi: etablissement.dpi,
      directeur_general_prenom: etablissement.directeur_general_prenom,
      directeur_general_nom: etablissement.directeur_general_nom,
      directeur_general_email: etablissement.directeur_general_email,
      siren_client: etablissement.siren_client,
      date_signature: etablissement.date_signature,
      date_previsionnelle_signature: etablissement.date_previsionnelle_signature,
      date_fin_contrat: etablissement.date_fin_contrat,
    }))

    mockSanitizePayload.mockImplementation((data) => ({
      ...data,
      nom: String(data.nom).trim(),
    }))

    mockMutateAsync.mockResolvedValue({ id: ETABLISSEMENT.id })
  })

  it("crée le wrapper QueryClientProvider conforme pour les hooks", () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => React.useContext(React.createContext("ok")), { wrapper })
    expect(result.current).toBe("ok")
  })

  it("affiche les valeurs métier initiales de l'établissement", () => {
    const { wrapper } = createWrapper()

    render(
      <EtablissementEditForm etablissement={ETABLISSEMENT} open={true} onOpenChange={vi.fn()} />,
      { wrapper }
    )

    expect(screen.getByText("Modifier l'établissement")).toBeInTheDocument()
    expect(screen.getByText(/CHU Lyon/)).toBeInTheDocument()
    expect(screen.getByDisplayValue("CHU Lyon")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Lyon")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Auvergne-Rhône-Alpes")).toBeInTheDocument()
    expect(screen.getByDisplayValue("1 rue de la République")).toBeInTheDocument()
    expect(screen.getByDisplayValue("69001")).toBeInTheDocument()
    expect(screen.getByDisplayValue("0102030405")).toBeInTheDocument()
    expect(screen.getByDisplayValue("contact@chu-nord.example.org")).toBeInTheDocument()
    expect(screen.getByDisplayValue("120000")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Jean")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Martin")).toBeInTheDocument()
    expect(screen.getByDisplayValue("jean.martin@chu-nord.example.org")).toBeInTheDocument()
    expect(screen.getByDisplayValue("123456789")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2024-01-15")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2024-01-10")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2027-01-15")).toBeInTheDocument()
    expect(screen.getByTestId("logo-url")).toHaveTextContent("https://logo.local/chu.png")
    expect(mockBuildDefaults).toHaveBeenCalledWith(ETABLISSEMENT)
  })

  it("met à jour le logo courant et invalide la query établissement", async () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockImplementation(mockInvalidateQueries)

    render(
      <EtablissementEditForm etablissement={ETABLISSEMENT} open={true} onOpenChange={vi.fn()} />,
      { wrapper }
    )

    await userEvent.click(screen.getByRole("button", { name: "Changer logo" }))

    expect(screen.getByTestId("logo-url")).toHaveTextContent("https://logo.local/new-logo.png")
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["etablissement", "eta-1"] })
  })

  it("soumet le formulaire avec un payload sanitizé puis ferme la dialog au succès", async () => {
    const onOpenChange = vi.fn()
    const { wrapper } = createWrapper()

    render(
      <EtablissementEditForm etablissement={ETABLISSEMENT} open={true} onOpenChange={onOpenChange} />,
      { wrapper }
    )

    const nomInput = screen.getByDisplayValue("CHU Lyon")
    fireEvent.change(nomInput, { target: { value: "  CHU Lyon Nord  " } })

    const villeInput = screen.getByDisplayValue("Lyon")
    fireEvent.change(villeInput, { target: { value: "Villeurbanne" } })

    const form = document.querySelector("form")
    expect(form).not.toBeNull()

    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => {
      expect(mockSanitizePayload).toHaveBeenCalled()
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "eta-1",
        data: expect.objectContaining({
          nom: "CHU Lyon Nord",
          ville: "Villeurbanne",
          type: "CHU",
          region: "Auvergne-Rhône-Alpes",
        }),
      })
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockDebugLog).toHaveBeenCalledWith("🔍 Tentative de mise à jour établissement:", "CHU Lyon")
    expect(mockDebugLog).toHaveBeenCalledWith("✅ Mise à jour réussie")
  })

  it("gère l'erreur de mutation sans fermer la dialog", async () => {
    const onOpenChange = vi.fn()
    mockMutateAsync.mockRejectedValueOnce(new Error("x"))
    const { wrapper } = createWrapper()

    render(
      <EtablissementEditForm etablissement={ETABLISSEMENT} open={true} onOpenChange={onOpenChange} />,
      { wrapper }
    )

    const form = document.querySelector("form")
    expect(form).not.toBeNull()

    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalled()
    })

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("supporte un état d'erreur venant des dépendances de chargement", () => {
    mockUseProfilesWithRoles.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    })

    const { wrapper } = createWrapper()

    render(
      <EtablissementEditForm etablissement={ETABLISSEMENT} open={true} onOpenChange={vi.fn()} />,
      { wrapper }
    )

    expect(screen.getByText("Modifier l'établissement")).toBeInTheDocument()
    expect(mockUseProfilesWithRoles).toHaveBeenCalled()
  })
})