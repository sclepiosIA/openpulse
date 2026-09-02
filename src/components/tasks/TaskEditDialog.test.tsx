import React from 'react'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskEditDialog } from './TaskEditDialog'

const {
  toastFn,
  mockUpdateMutateAsync,
  mockDeleteMutateAsync,
  mockArchiveMutateAsync,
  mockUseUpdateTache,
  mockUseDeleteTache,
  mockUseArchiveTache,
  mockUseTachesDocuments,
  mockUseProfiles,
  PROFILES,
  DOCUMENTS,
  mockDebugError,
  mockCn,
  mockFrom,
} = vi.hoisted(() => {
  const toastFn = vi.fn()

  const mockUpdateMutateAsync = vi.fn<[], Promise<unknown>>()
  const mockDeleteMutateAsync = vi.fn<[], Promise<unknown>>()
  const mockArchiveMutateAsync = vi.fn<[], Promise<unknown>>()

  const mockUseUpdateTache = vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }))
  const mockUseDeleteTache = vi.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }))
  const mockUseArchiveTache = vi.fn(() => ({
    mutateAsync: mockArchiveMutateAsync,
    isPending: false,
  }))

  const DOCUMENTS = [{ id: 'd1' }, { id: 'd2' }]
  const PROFILES = [
    { id: 'u1', full_name: 'Alice Example', email: 'alice@example.test' },
    { id: 'u2', full_name: 'Bob Example', email: 'bob@example.test' },
  ]

  const mockUseTachesDocuments = vi.fn((_taskId: string) => ({ data: DOCUMENTS, isLoading: false, isError: false }))
  const mockUseProfiles = vi.fn(() => ({ data: PROFILES, isLoading: false, isError: false }))

  const mockDebugError = vi.fn()

  const mockCn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

  const mockFrom = vi.fn(() => {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    const resolve = async () => ({ data: [], error: null })

    Object.assign(builder, {
      select: chain,
      eq: chain,
      gte: chain,
      lte: chain,
      in: chain,
      order: chain,
      limit: chain,
      insert: chain,
      update: chain,
      delete: chain,
      upsert: chain,
      maybeSingle: resolve,
      single: resolve,
      then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
      catch: (onRejected?: (e: unknown) => unknown) => resolve().catch(onRejected),
    })

    return builder
  })

  return {
    toastFn,
    mockUpdateMutateAsync,
    mockDeleteMutateAsync,
    mockArchiveMutateAsync,
    mockUseUpdateTache,
    mockUseDeleteTache,
    mockUseArchiveTache,
    mockUseTachesDocuments,
    mockUseProfiles,
    PROFILES,
    DOCUMENTS,
    mockDebugError,
    mockCn,
    mockFrom,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useUpdateTache: mockUseUpdateTache,
  useDeleteTache: mockUseDeleteTache,
  useArchiveTache: mockUseArchiveTache,
}))

vi.mock('@/hooks/tasks/useTachesDocuments', () => ({
  useTachesDocuments: mockUseTachesDocuments,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: mockUseProfiles,
}))

vi.mock('@/components/tasks/TacheDocuments', () => ({
  TacheDocuments: () => null,
  default: () => null,
}))

vi.mock('@/components/portail-client/ClientPortalTaskConversation', () => ({
  ClientPortalTaskConversation: () => null,
  default: () => null,
}))

vi.mock('lucide-react', async () => {
  const ReactMod = await import('react')
  const Icon = (props: React.SVGProps<SVGSVGElement>) => ReactMod.createElement('svg', props)
  return {
    Loader2: Icon,
    Trash2: Icon,
    Archive: Icon,
    CheckCircle: Icon,
    Edit: Icon,
    UserPlus: Icon,
    AlertTriangle: Icon,
    Clock: Icon,
    Circle: Icon,
    Repeat: Icon,
    MessageSquare: Icon,
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const ReactMod = await import('react')
  const Ctx = ReactMod.createContext<{ open?: boolean; onOpenChange?: (o: boolean) => void }>({})
  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean
    onOpenChange?: (o: boolean) => void
    children: React.ReactNode
  }) => ReactMod.createElement(Ctx.Provider, { value: { open, onOpenChange } }, children)

  const DialogTrigger = ({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) =>
    ReactMod.cloneElement(children, {
      onClick: (e: unknown) => {
        children.props.onClick?.(e)
      },
    })

  const DialogContent = ({ children }: { children: React.ReactNode }) =>
    ReactMod.createElement('div', { 'data-testid': 'dialog-content' }, children)
  const DialogHeader = ({ children }: { children: React.ReactNode }) => ReactMod.createElement('div', null, children)
  const DialogFooter = ({ children }: { children: React.ReactNode }) => ReactMod.createElement('div', null, children)
  const DialogTitle = ({ children, className }: { children: React.ReactNode; className?: string }) =>
    ReactMod.createElement('h2', { className }, children)
  const DialogDescription = ({ children }: { children: React.ReactNode }) => ReactMod.createElement('p', null, children)
  return {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
  }
})

vi.mock('@/components/ui/button', async () => {
  const ReactMod = await import('react')
  const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
    ReactMod.createElement('button', { type: props.type ?? 'button', ...props }, props.children)
  return { Button, default: Button }
})

vi.mock('@/components/ui/input', async () => {
  const ReactMod = await import('react')
  const Input = ReactMod.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) =>
    ReactMod.createElement('input', { ...props, ref })
  )
  Input.displayName = 'Input'
  return { Input, default: Input }
})

vi.mock('@/components/ui/textarea', async () => {
  const ReactMod = await import('react')
  const Textarea = ReactMod.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) =>
    ReactMod.createElement('textarea', { ...props, ref })
  )
  Textarea.displayName = 'Textarea'
  return { Textarea, default: Textarea }
})

vi.mock('@/components/ui/label', async () => {
  const ReactMod = await import('react')
  const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) => ReactMod.createElement('label', props, props.children)
  return { Label, default: Label }
})

vi.mock('@/components/ui/badge', async () => {
  const ReactMod = await import('react')
  const Badge = (props: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) =>
    ReactMod.createElement('span', { ...props }, props.children)
  return { Badge, default: Badge }
})

vi.mock('@/components/ui/tabs', async () => {
  const ReactMod = await import('react')
  const Tabs = ({ children, defaultValue }: { children: React.ReactNode; defaultValue?: string }) =>
    ReactMod.createElement('div', { 'data-testid': 'tabs', 'data-default': defaultValue }, children)
  const TabsList = ({ children, className }: { children: React.ReactNode; className?: string }) =>
    ReactMod.createElement('div', { className }, children)
  const TabsTrigger = ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) =>
    ReactMod.createElement('button', { type: 'button', 'data-testid': `tab-${value}`, className }, children)
  const TabsContent = ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) =>
    ReactMod.createElement('div', { 'data-testid': `tab-content-${value}`, className }, children)
  return { Tabs, TabsList, TabsTrigger, TabsContent }
})

vi.mock('@/components/ui/select', async () => {
  const ReactMod = await import('react')
  type CtxT = { value?: string; onValueChange?: (v: string) => void }
  const Ctx = ReactMod.createContext<CtxT>({})
  const Select = ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    value?: string
    onValueChange?: (v: string) => void
  }) => ReactMod.createElement(Ctx.Provider, { value: { value, onValueChange } }, children)
  const SelectTrigger = ({ children }: { children: React.ReactNode }) => ReactMod.createElement('button', { type: 'button' }, children)
  const SelectValue = () => {
    const ctx = ReactMod.useContext(Ctx)
    return ReactMod.createElement('span', { 'data-testid': 'select-value' }, ctx.value ?? '')
  }
  const SelectContent = ({ children }: { children: React.ReactNode }) => ReactMod.createElement('div', null, children)
  const SelectItem = ({ children, value }: { children: React.ReactNode; value: string }) => {
    const ctx = ReactMod.useContext(Ctx)
    return ReactMod.createElement(
      'button',
      {
        type: 'button',
        'data-testid': `select-item-${value}`,
        onClick: () => ctx.onValueChange?.(value),
      },
      children
    )
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  toastFn.mockClear()
  mockUpdateMutateAsync.mockReset()
  mockDeleteMutateAsync.mockReset()
  mockArchiveMutateAsync.mockReset()
  mockUseUpdateTache.mockClear()
  mockUseDeleteTache.mockClear()
  mockUseArchiveTache.mockClear()
  mockUseTachesDocuments.mockClear()
  mockUseProfiles.mockClear()
  mockDebugError.mockClear()
  mockFrom.mockClear()
})

describe('TaskEditDialog', () => {
  it('chargement -> succès: pré-remplit et soumet updateTache avec données métier normalisées', async () => {
    mockUseTachesDocuments.mockReturnValueOnce({ data: undefined, isLoading: true, isError: false })
    mockUseProfiles.mockReturnValueOnce({ data: undefined, isLoading: true, isError: false })

    const tache = {
      id: 't1',
      titre: 'Titre initial',
      description: 'Desc initiale',
      statut: 'Statut invalide',
      priorite: 'prio-invalide',
      date_debut: null,
      echeance: null,
      responsable_id: null,
      archive: false,
      recurrence_rule: null,
    }

    const { rerender } = renderWithClient(<TaskEditDialog tache={tache} open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Modifier la tâche')).toBeTruthy()
    expect(screen.getByText('Modifiez les détails de la tâche ci-dessous')).toBeTruthy()

    mockUseTachesDocuments.mockReturnValueOnce({ data: DOCUMENTS, isLoading: false, isError: false })
    mockUseProfiles.mockReturnValueOnce({ data: PROFILES, isLoading: false, isError: false })

    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <TaskEditDialog tache={tache} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    const titreInput = screen.getByLabelText(/Titre/i) as HTMLInputElement
    const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement

    expect(titreInput.value).toBe('Titre initial')
    expect(descInput.value).toBe('Desc initiale')

    const badges = screen.getAllByText('A faire')
    expect(badges.length).toBeGreaterThan(0)

    fireEvent.change(titreInput, { target: { value: 'Nouveau titre' } })
    fireEvent.change(descInput, { target: { value: '' } })

    fireEvent.click(screen.getByTestId('select-item-En cours'))
    fireEvent.click(screen.getByTestId('select-item-high'))

    const startDate = screen.getByLabelText(/Date de début/i) as HTMLInputElement
    const dueDate = screen.getByLabelText(/Échéance/i) as HTMLInputElement
    fireEvent.change(startDate, { target: { value: '2024-02-10' } })
    fireEvent.change(dueDate, { target: { value: '' } })

    mockUpdateMutateAsync.mockResolvedValueOnce({ ok: true })

    const form = screen.getByTestId('tab-content-details').querySelector('form#task-edit-form')
    if (!form) throw new Error('form not found')

    await act(async () => {
      fireEvent.submit(form)
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1)
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 't1',
      data: {
        titre: 'Nouveau titre',
        description: undefined,
        statut: 'En cours',
        priorite: 'high',
        date_debut: '2024-02-10',
        echeance: undefined,
        responsable_id: undefined,
        recurrence_rule: null,
      },
    })

    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Succès',
        description: 'Tâche mise à jour avec succès',
      })
    )
  })

  it('erreur: updateTache rejette -> toast destructive + debug.error', async () => {
    mockUseTachesDocuments.mockReturnValueOnce({ data: DOCUMENTS, isLoading: false, isError: false })
    mockUseProfiles.mockReturnValueOnce({ data: PROFILES, isLoading: false, isError: false })

    const tache = {
      id: 't2',
      titre: 'Titre',
      description: null,
      statut: 'A faire',
      priorite: 'medium',
      date_debut: null,
      echeance: null,
      responsable_id: null,
      archive: false,
      recurrence_rule: null,
    }

    renderWithClient(<TaskEditDialog tache={tache} open={true} onOpenChange={vi.fn()} />)

    mockUpdateMutateAsync.mockRejectedValueOnce(new Error('boom'))

    const form = screen.getByTestId('tab-content-details').querySelector('form#task-edit-form')
    if (!form) throw new Error('form not found')

    const callsBefore = mockUpdateMutateAsync.mock.calls.length

    await act(async () => {
      fireEvent.submit(form)
    })

    expect(mockUpdateMutateAsync.mock.calls.length - callsBefore).toBe(1)
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la tâche',
        variant: 'destructive',
      })
    )
    expect(mockDebugError).toHaveBeenCalled()
  })

  it('tâche portail: affiche badge "Portail client" et masque l’onglet Documents', async () => {
    mockUseTachesDocuments.mockReturnValueOnce({ data: DOCUMENTS, isLoading: false, isError: false })
    mockUseProfiles.mockReturnValueOnce({ data: PROFILES, isLoading: false, isError: false })

    const tache = {
      id: 'portal-99',
      titre: 'Portail',
      description: 'x',
      statut: 'A faire',
      priorite: 'low',
      date_debut: null,
      echeance: null,
      responsable_id: null,
      archive: false,
      recurrence_rule: null,
    }

    renderWithClient(<TaskEditDialog tache={tache} open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText('Portail client')).toBeTruthy()
    expect(screen.getByText("Tâche échangée avec l'établissement via le portail client.")).toBeTruthy()
    expect(screen.queryByTestId('tab-documents')).toBeNull()
  })

  it('tache absente -> null (rien rendu)', () => {
    const { container } = renderWithClient(
      <TaskEditDialog tache={null as unknown as { id: string; titre: string }} open={true} onOpenChange={vi.fn()} />
    )
    expect(container.textContent).toBe('')
  })

  it('suppression: confirm false -> ne supprime pas', async () => {
    mockUseTachesDocuments.mockReturnValueOnce({ data: DOCUMENTS, isLoading: false, isError: false })
    mockUseProfiles.mockReturnValueOnce({ data: PROFILES, isLoading: false, isError: false })

    const tache = {
      id: 't3',
      titre: 'To delete',
      description: null,
      statut: 'A faire',
      priorite: 'medium',
      date_debut: null,
      echeance: null,
      responsable_id: null,
      archive: false,
      recurrence_rule: null,
    }

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderWithClient(<TaskEditDialog tache={tache} open={true} onOpenChange={vi.fn()} />)

    const dialog = screen.getByTestId('dialog-content')
    const iconButtons = within(dialog)
      .queryAllByRole('button')
      .filter((b) => b.querySelector('svg') !== null)

    await act(async () => {
      iconButtons.forEach((b) => fireEvent.click(b))
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })
})