/* @vitest-environment jsdom */
import React from "react"
import { render, screen, fireEvent, renderHook, waitFor, act, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AssignResponsableDialog } from "./AssignResponsableDialog"

const {
  PROFILES_SUCCESS,
  AUTH_STATE,
  TOAST_FN,
  mockUseProfilesWithRoles,
  mockUseToast,
  mockFrom,
} = vi.hoisted(() => ({
  PROFILES_SUCCESS: [
    { id: "p1", prenom: "Alice", nom: "Martin", role: "commercial" },
    { id: "p2", prenom: "Bob", nom: "Durand", role: "csm" },
    { id: "p3", prenom: "Chloe", nom: "Admin", role: "admin" },
    { id: "p4", prenom: "David", nom: "Autre", role: "user" },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  TOAST_FN: vi.fn(),
  mockUseProfilesWithRoles: vi.fn(),
  mockUseToast: vi.fn(),
  mockFrom: vi.fn(),
}))

function createBuilder() {
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
    then: (
      onFulfilled: (value: { data: null; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }
  return builder
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => createBuilder()),
  },
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
  useSession: () => AUTH_STATE,
}))

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: () => mockUseProfilesWithRoles(),
}))

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => mockUseToast(),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    variant?: string
  }) => (
    <button type="button" data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode
    htmlFor?: string
  }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode; className?: string }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) => (
    <div data-testid="select-root" data-value={value}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ onValueChange?: (value: string) => void; currentValue?: string }>,
              { onValueChange, currentValue: value }
            )
          : child
      )}
    </div>
  ),
  SelectTrigger: ({
    children,
    id,
  }: {
    children: React.ReactNode
    id?: string
  }) => <div data-testid={id}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode
    onValueChange?: (value: string) => void
    currentValue?: string
  }) => (
    <div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ onValueChange?: (value: string) => void }>,
              { onValueChange }
            )
          : child
      )}
    </div>
  ),
  SelectItem: ({
    value,
    children,
    onValueChange,
  }: {
    value: string
    children: React.ReactNode
    onValueChange?: (value: string) => void
  }) => (
    <button type="button" onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  ),
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

describe("AssignResponsableDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseToast.mockReturnValue({ toast: TOAST_FN })
  })

  it("couvre le hook: loading puis succès puis erreur", async () => {
    mockUseProfilesWithRoles
      .mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, error: null })
      .mockReturnValueOnce({ data: PROFILES_SUCCESS, isLoading: false, isError: false, error: null })
      .mockReturnValueOnce({ data: null, isLoading: false, isError: true, error: { message: "x" } })

    const wrapper = createWrapper()
    const { result, rerender } = renderHook(() => mockUseProfilesWithRoles(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    rerender()
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(false)
      expect(result.current.data).toEqual(PROFILES_SUCCESS)
    })

    rerender()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      expect(result.current.error).toEqual({ message: "x" })
      expect(result.current.data).toBeNull()
    })
  })

  it("affiche les profils filtrés, le résumé des groupes et assigne les responsables sélectionnés", async () => {
    mockUseProfilesWithRoles.mockReturnValue({
      data: PROFILES_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    })

    const onOpenChange = vi.fn()
    const onAssign = vi.fn()

    render(
      <AssignResponsableDialog
        open={true}
        onOpenChange={onOpenChange}
        selectedGroupes={[
          { id: "g1", nom: "Alpha" },
          { id: "g2", nom: "Beta" },
          { id: "g3", nom: "Gamma" },
          { id: "g4", nom: "Delta" },
        ]}
        onAssign={onAssign}
      />
    )

    expect(screen.getByText("Assigner des responsables à 4 groupes")).toBeInTheDocument()
    expect(screen.getByText("Groupes concernés")).toBeInTheDocument()
    expect(screen.getByText("Alpha, Beta, Gamma et 1 autre(s)")).toBeInTheDocument()

    expect(screen.getAllByText("Alice Martin")).toHaveLength(1)
    expect(screen.getAllByText("Bob Durand")).toHaveLength(1)
    expect(screen.getAllByText("Chloe Admin")).toHaveLength(2)
    expect(screen.queryByText("David Autre")).not.toBeInTheDocument()

    const assignButton = screen.getByRole("button", { name: "Assigner" })
    expect(assignButton).toBeDisabled()

    const allButtons = screen.getAllByRole("button")
    const commercialOption = allButtons.find((button) => within(button).queryByText("Alice Martin"))
    const csmOption = allButtons.find((button) => within(button).queryByText("Bob Durand"))

    expect(commercialOption).toBeDefined()
    expect(csmOption).toBeDefined()

    await act(async () => {
      fireEvent.click(commercialOption as HTMLButtonElement)
      fireEvent.click(csmOption as HTMLButtonElement)
    })

    expect(assignButton).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(assignButton)
    })

    expect(onAssign).toHaveBeenCalledWith("p1", "p2")
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Responsables assignés",
      description: "Responsables assignés à 4 groupe(s)",
    })
  })

  it("permet d'annuler la boîte de dialogue", async () => {
    mockUseProfilesWithRoles.mockReturnValue({
      data: PROFILES_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    })

    const onOpenChange = vi.fn()
    const onAssign = vi.fn()

    render(
      <AssignResponsableDialog
        open={true}
        onOpenChange={onOpenChange}
        selectedGroupes={[{ id: "g1", nom: "Alpha" }]}
        onAssign={onAssign}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onAssign).not.toHaveBeenCalled()
    expect(TOAST_FN).not.toHaveBeenCalled()
  })

  it("gère l'état erreur du hook dans le rendu sans afficher de profils exploitables", () => {
    mockUseProfilesWithRoles.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    })

    render(
      <AssignResponsableDialog
        open={true}
        onOpenChange={vi.fn()}
        selectedGroupes={[{ id: "g1", nom: "Alpha" }]}
        onAssign={vi.fn()}
      />
    )

    expect(screen.getByText("Assigner des responsables à 1 groupe")).toBeInTheDocument()
    expect(screen.queryByText("Alice Martin")).not.toBeInTheDocument()
    expect(screen.queryByText("Bob Durand")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assigner" })).toBeDisabled()
  })
})