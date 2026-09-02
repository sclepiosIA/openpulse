// @vitest-environment jsdom
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { EtablissementDocuments } from "./EtablissementDocuments"

const {
  TACHES_ROWS,
  DOCS_ROWS,
  TOAST_RESULT,
  DELETE_MUTATION_RESULT,
  DELETE_MUTATE_ASYNC,
  GET_DOCUMENT_URL,
  STORAGE_DOWNLOAD_RESPONSE,
  mockFrom,
  mockStorageFrom,
  mockStorageDownload,
  builderState,
  debugWarn,
  debugError,
} = vi.hoisted(() => {
  const TACHES_ROWS = [
    { id: "t1", titre: "Contrôle qualité" },
    { id: "t2", titre: "Maintenance annuelle" },
  ]

  const DOCS_ROWS = [
    {
      id: "d1",
      nom_fichier: "rapport.pdf",
      chemin_fichier: "docs/rapport.pdf",
      type_mime: "application/pdf",
      taille_fichier: 2048,
      created_at: "2024-03-10T09:30:00.000Z",
      updated_at: "2024-03-10T09:30:00.000Z",
      uploaded_by: "u1",
      tache_id: "t1",
      profiles: { nom: "Dupont", prenom: "Jean" },
    },
    {
      id: "d2",
      nom_fichier: "photo-site.jpg",
      chemin_fichier: "docs/photo-site.jpg",
      type_mime: "image/jpeg",
      taille_fichier: 512,
      created_at: "2024-03-11T10:15:00.000Z",
      updated_at: "2024-03-11T10:15:00.000Z",
      uploaded_by: "u1",
      tache_id: "t2",
      profiles: { nom: "Martin", prenom: "Claire" },
    },
  ]

  const TOAST_FN = vi.fn()
  const TOAST_RESULT = { toast: TOAST_FN }
  const DELETE_MUTATE_ASYNC = vi.fn().mockResolvedValue({ success: true })
  const DELETE_MUTATION_RESULT = { mutateAsync: DELETE_MUTATE_ASYNC }
  const GET_DOCUMENT_URL = vi.fn().mockResolvedValue("https://local.test/doc")
  const STORAGE_DOWNLOAD_RESPONSE = { data: { file: "content" }, error: null }
  const mockStorageDownload = vi.fn(async () => STORAGE_DOWNLOAD_RESPONSE)
  const mockStorageFrom = vi.fn(() => ({
    download: mockStorageDownload,
  }))
  const debugWarn = vi.fn()
  const debugError = vi.fn()

  type QueryResponse = { data: unknown; error: unknown }

  const builderState: {
    table: string
    filters: Record<string, unknown>
    inValues: unknown[]
    orderArgs: unknown[]
    limitValue: number | null
    responseByTable: Record<string, QueryResponse>
  } = {
    table: "",
    filters: {},
    inValues: [],
    orderArgs: [],
    limitValue: null,
    responseByTable: {
      taches: { data: TACHES_ROWS, error: null },
      taches_documents: { data: DOCS_ROWS, error: null },
    },
  }

  type Builder = {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: <TResult1 = QueryResponse, TResult2 = never>(
      onFulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>
    catch: <TResult = never>(
      onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) => Promise<QueryResponse | TResult>
  }

  const resolveCurrentResponse = () => builderState.responseByTable[builderState.table] ?? { data: null, error: null }

  const createBuilder = (): Builder => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        builderState.filters[column] = value
        return builder
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn((column: string, values: unknown[]) => {
        builderState.filters[column] = values
        builderState.inValues = values
        return builder
      }),
      order: vi.fn((...args: unknown[]) => {
        builderState.orderArgs = args
        return builder
      }),
      limit: vi.fn((value: number) => {
        builderState.limitValue = value
        return builder
      }),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => resolveCurrentResponse()),
      maybeSingle: vi.fn(async () => resolveCurrentResponse()),
      then: <TResult1 = QueryResponse, TResult2 = never>(
        onFulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise.resolve(resolveCurrentResponse()).then(onFulfilled, onRejected),
      catch: <TResult = never>(
        onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
      ) => Promise.resolve(resolveCurrentResponse()).catch(onRejected),
    }

    return builder
  }

  const mockFrom = vi.fn((table: string) => {
    builderState.table = table
    return createBuilder()
  })

  return {
    TACHES_ROWS,
    DOCS_ROWS,
    TOAST_RESULT,
    DELETE_MUTATION_RESULT,
    DELETE_MUTATE_ASYNC,
    GET_DOCUMENT_URL,
    STORAGE_DOWNLOAD_RESPONSE,
    mockFrom,
    mockStorageFrom,
    mockStorageDownload,
    builderState,
    debugWarn,
    debugError,
  }
})

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}))

vi.mock("@/lib/debug", () => ({
  debug: {
    warn: debugWarn,
    error: debugError,
  },
}))

vi.mock("@/hooks/tasks/useTachesDocuments", () => ({
  useDeleteTacheDocument: vi.fn(() => DELETE_MUTATION_RESULT),
  getDocumentUrl: GET_DOCUMENT_URL,
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => TOAST_RESULT,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    asChild,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    asChild?: boolean
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="separator" {...props} />,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />
  return {
    FileText: Icon,
    Download: Icon,
    Calendar: Icon,
    User: Icon,
    Search: Icon,
    Eye: Icon,
    Trash2: Icon,
  }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderComponent(etablissementId = "etab-1") {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <EtablissementDocuments etablissementId={etablissementId} />
    </QueryClientProvider>
  )
}

describe("EtablissementDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    builderState.table = ""
    builderState.filters = {}
    builderState.inValues = []
    builderState.orderArgs = []
    builderState.limitValue = null
    builderState.responseByTable = {
      taches: { data: TACHES_ROWS, error: null },
      taches_documents: { data: DOCS_ROWS, error: null },
    }
  })

  afterEach(() => {
    cleanup()
  })

  it("affiche un état de chargement puis la liste des documents agrégés avec les informations métier", async () => {
    renderComponent()

    expect(document.querySelector(".animate-spin")).toBeTruthy()

    expect(await screen.findByText("Documents de l'établissement")).toBeInTheDocument()
    expect(screen.getByText("Tous les documents associés aux tâches de cet établissement")).toBeInTheDocument()

    expect(screen.getAllByText("photo-site.jpg").length).toBeGreaterThan(0)
    expect(screen.getAllByText("rapport.pdf").length).toBeGreaterThan(0)

    expect(screen.getByText("Tâche: Maintenance annuelle")).toBeInTheDocument()
    expect(screen.getByText("Tâche: Contrôle qualité")).toBeInTheDocument()

    expect(screen.getByText("Claire Martin")).toBeInTheDocument()
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument()

    expect(screen.getByText("512 o")).toBeInTheDocument()
    expect(screen.getByText("2 Ko")).toBeInTheDocument()

    expect(mockFrom).toHaveBeenCalledWith("taches")
    expect(mockFrom).toHaveBeenCalledWith("taches_documents")
    expect(builderState.filters.etablissement_id).toBe("etab-1")
    expect(builderState.inValues).toEqual(["t1", "t2"])
  })

  it("filtre les documents par recherche puis par type de fichier", async () => {
    renderComponent()

    await screen.findAllByText("photo-site.jpg")

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "rapport" },
    })

    await waitFor(() => {
      expect(screen.getAllByText("rapport.pdf").length).toBeGreaterThan(0)
      expect(screen.queryAllByText("photo-site.jpg")).toHaveLength(0)
    })

    fireEvent.change(screen.getByDisplayValue("Tous les types"), {
      target: { value: "image" },
    })

    await waitFor(() => {
      expect(screen.getByText("Aucun document trouvé")).toBeInTheDocument()
      expect(screen.getByText("Aucun document ne correspond à vos critères de recherche.")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "" },
    })

    await waitFor(() => {
      expect(screen.getAllByText("photo-site.jpg").length).toBeGreaterThan(0)
      expect(screen.queryAllByText("rapport.pdf")).toHaveLength(0)
    })
  })

  it("télécharge le premier document affiché et affiche un toast de succès", async () => {
    const createObjectURL = vi.fn(() => "blob:doc")
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    })

    const appendSpy = vi.spyOn(document.body, "appendChild")
    const removeSpy = vi.spyOn(document.body, "removeChild")
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    renderComponent()

    await screen.findAllByText("photo-site.jpg")

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Télécharger/i })[0])
    })

    await waitFor(() => {
      expect(mockStorageFrom).toHaveBeenCalledWith("taches-documents")
      expect(mockStorageDownload).toHaveBeenCalledWith("docs/photo-site.jpg")
    })

    expect(createObjectURL).toHaveBeenCalledWith(STORAGE_DOWNLOAD_RESPONSE.data)
    expect(appendSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:doc")
    expect(TOAST_RESULT.toast).toHaveBeenCalledWith({
      title: "Téléchargement réussi",
      description: "photo-site.jpg téléchargé avec succès.",
    })
  })

  it("déclenche la suppression via la mutation dédiée", async () => {
    renderComponent()

    await screen.findAllByText("rapport.pdf")

    const destructiveButtons = screen
      .getAllByRole("button", { name: /^Supprimer$/i })
      .filter((button) => button.className.includes("bg-destructive"))

    expect(destructiveButtons).toHaveLength(2)

    const rapportDeleteAction = destructiveButtons[1]
    expect(rapportDeleteAction).toBeDefined()

    if (rapportDeleteAction) {
      await act(async () => {
        fireEvent.click(rapportDeleteAction)
      })
    }

    await waitFor(() => {
      expect(DELETE_MUTATE_ASYNC).toHaveBeenCalledWith({
        documentId: "d1",
        filePath: "docs/rapport.pdf",
      })
    })
  })

  it("affiche l'état vide quand Supabase renvoie une réponse en erreur sans données", async () => {
    builderState.responseByTable = {
      taches: { data: null, error: { message: "x" } },
      taches_documents: { data: null, error: { message: "x" } },
    }

    renderComponent()

    expect(await screen.findByText("Documents de l'établissement")).toBeInTheDocument()
    expect(screen.getByText("Aucun document trouvé")).toBeInTheDocument()
    expect(screen.getByText("Aucun document n'a encore été ajouté aux tâches de cet établissement.")).toBeInTheDocument()
    expect(screen.queryAllByText("rapport.pdf")).toHaveLength(0)
    expect(screen.queryAllByText("photo-site.jpg")).toHaveLength(0)
  })
})