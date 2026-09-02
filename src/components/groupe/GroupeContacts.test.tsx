/* @vitest-environment jsdom */
import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GroupeContacts } from "./GroupeContacts"

const {
  CONTACTS,
  EMPTY_CONTACTS,
  mockNavigate,
  mockUseContactsGroupe,
  mockCreateMutateAsync,
  mockUpdateMutateAsync,
  mockDeleteMutateAsync,
  contactFormSpy,
} = vi.hoisted(() => ({
  CONTACTS: [
    {
      id: "c1",
      groupe_id: "g1",
      nom: "Dupont",
      prenom: "Jean",
      fonction: "Médecin",
      email: "jean.dupont@test.fr",
      telephone: "0102030405",
      type_contact: "cliniciens",
      est_contact_principal: true,
    },
    {
      id: "c2",
      groupe_id: "g1",
      nom: "Martin",
      prenom: "Claire",
      fonction: "DSI",
      email: null,
      telephone: null,
      type_contact: "informatique",
      est_contact_principal: false,
    },
  ],
  EMPTY_CONTACTS: [],
  mockNavigate: vi.fn(),
  mockUseContactsGroupe: vi.fn(),
  mockCreateMutateAsync: vi.fn(),
  mockUpdateMutateAsync: vi.fn(),
  mockDeleteMutateAsync: vi.fn(),
  contactFormSpy: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/integrations/supabase/client", () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  }
  const mockFrom = vi.fn(() => builder)
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock("@/hooks/crm/useContactsGroupe", () => ({
  useContactsGroupe: mockUseContactsGroupe,
  useCreateContactGroupe: () => ({ mutateAsync: mockCreateMutateAsync }),
  useUpdateContactGroupe: () => ({ mutateAsync: mockUpdateMutateAsync }),
  useDeleteContactGroupe: () => ({ mutateAsync: mockDeleteMutateAsync }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardDescription: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
  TableHead: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  ),
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    asChild,
    className,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    asChild?: boolean
    className?: string
  }) => {
    if (asChild) return <div className={className}>{children}</div>
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    )
  },
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/forms/ContactForm", () => ({
  ContactForm: (props: {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: {
      nom: string
      prenom?: string
      fonction: string
      email?: string
      telephone?: string
      type_contact?: string
      est_contact_principal?: boolean
    }) => Promise<void>
    contact?: { id?: string; nom?: string; prenom?: string | null } | undefined
    isLoading?: boolean
  }) => {
    contactFormSpy(props)
    if (!props.isOpen) return null
    return (
      <div>
        <div>ContactFormOpen</div>
        <button
          type="button"
          onClick={() =>
            props.onSubmit({
              nom: "Nouveau",
              prenom: "Contact",
              fonction: "Direction",
              email: "new@test.fr",
              telephone: "0600000000",
              type_contact: "administration",
              est_contact_principal: true,
            })
          }
        >
          submit-form
        </button>
        <button type="button" onClick={props.onClose}>
          close-form
        </button>
        <div>{props.contact ? `editing-${props.contact.id}` : "creating"}</div>
      </div>
    )
  },
}))

vi.mock("@/components/security/AdminActionButton", () => ({
  AdminActionButton: ({
    children,
    onConfirm,
  }: {
    children?: React.ReactNode
    onConfirm: () => void
  }) => (
    <button type="button" onClick={onConfirm}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
  AlertDialogAction: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock("lucide-react", () => {
  const Icon = () => <span data-testid="icon" />
  return {
    Plus: Icon,
    MoreVertical: Icon,
    Mail: Icon,
    Phone: Icon,
    User: Icon,
    Edit: Icon,
    Trash2: Icon,
    Loader2: Icon,
    AlertTriangle: Icon,
  }
})

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GroupeContacts groupeId="g1" />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("GroupeContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMutateAsync.mockResolvedValue({ data: null, error: null })
    mockUpdateMutateAsync.mockResolvedValue({ data: null, error: null })
    mockDeleteMutateAsync.mockResolvedValue({ data: null, error: null })
  })

  it("affiche le chargement", () => {
    mockUseContactsGroupe.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    renderComponent()

    expect(screen.queryByText("Contacts du groupe")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("icon").length).toBeGreaterThan(0)
  })

  it("affiche les contacts avec les informations métier réelles", () => {
    mockUseContactsGroupe.mockReturnValue({
      data: CONTACTS,
      isLoading: false,
      error: null,
    })

    renderComponent()

    expect(screen.getByText("Contacts du groupe")).toBeInTheDocument()
    expect(screen.getByText("2 contacts")).toBeInTheDocument()
    expect(screen.getAllByText("Jean Dupont")).toHaveLength(2)
    expect(screen.getAllByText("Claire Martin")).toHaveLength(2)
    expect(screen.getAllByText("Médecin")).toHaveLength(2)
    expect(screen.getAllByText("DSI")).toHaveLength(2)
    expect(screen.getAllByText("Cliniciens")).toHaveLength(2)
    expect(screen.getAllByText("Informatique")).toHaveLength(2)
    expect(screen.getAllByText("Principal")).toHaveLength(2)
    expect(screen.getAllByText("jean.dupont@test.fr")).toHaveLength(2)
    expect(screen.getAllByText("0102030405")).toHaveLength(2)
  })

  it("affiche l'état vide", () => {
    mockUseContactsGroupe.mockReturnValue({
      data: EMPTY_CONTACTS,
      isLoading: false,
      error: null,
    })

    renderComponent()

    expect(screen.getByText("0 contact")).toBeInTheDocument()
    expect(screen.getByText("Aucun contact")).toBeInTheDocument()
    expect(screen.getByText("Commencez par ajouter un contact pour ce groupe")).toBeInTheDocument()
    expect(screen.getByText("Ajouter le premier contact")).toBeInTheDocument()
  })

  it("ouvre le formulaire de création et envoie les bonnes données", async () => {
    mockUseContactsGroupe.mockReturnValue({
      data: EMPTY_CONTACTS,
      isLoading: false,
      error: null,
    })

    renderComponent()

    fireEvent.click(screen.getByText("Ajouter le premier contact"))
    expect(screen.getByText("ContactFormOpen")).toBeInTheDocument()
    expect(screen.getByText("creating")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText("submit-form"))
    })

    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      groupe_id: "g1",
      nom: "Nouveau",
      prenom: "Contact",
      fonction: "Direction",
      email: "new@test.fr",
      telephone: "0600000000",
      type_contact: "administration",
      est_contact_principal: true,
    })
  })

  it("ouvre le formulaire en mode édition et envoie les bonnes données", async () => {
    mockUseContactsGroupe.mockReturnValue({
      data: CONTACTS,
      isLoading: false,
      error: null,
    })

    renderComponent()

    fireEvent.click(screen.getAllByText("Modifier")[0])

    expect(screen.getByText("ContactFormOpen")).toBeInTheDocument()
    expect(screen.getByText("editing-c1")).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText("submit-form"))
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: "c1",
      data: {
        nom: "Nouveau",
        prenom: "Contact",
        fonction: "Direction",
        email: "new@test.fr",
        telephone: "0600000000",
        type_contact: "administration",
        est_contact_principal: true,
      },
    })
  })

  it("affiche l'erreur de chargement", () => {
    mockUseContactsGroupe.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: "x" },
    })

    renderComponent()

    expect(
      screen.getByText(
        "Impossible de charger les contacts du groupe. Vérifiez vos permissions ou contactez un administrateur."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText("Contacts du groupe")).not.toBeInTheDocument()
  })
})