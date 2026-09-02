import React, { type PropsWithChildren } from 'react'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  activityLoadingState,
  taskLoadingState,
  activityStatsState,
  taskStatsState,
  updateGroupeState,
  toast,
  mutateAsyncMock,
} = vi.hoisted(() => {
  const activityLoadingState = { value: true }
  const taskLoadingState = { value: true }
  const activityStatsState = {
    value: {
      total: 12,
      recentCount: 3,
      byStatus: { completed: 8, in_progress: 4 },
    },
  }
  const taskStatsState = {
    value: {
      groupeTotal: 7,
      etablissementTotal: 5,
      completed: 6,
      inProgress: 2,
    },
  }
  const updateGroupeState = {
    isPending: false,
    shouldReject: false,
    lastPayload: null as unknown,
  }

  const mutateAsyncMock = vi.fn(async (payload: unknown) => {
    updateGroupeState.lastPayload = payload
    if (updateGroupeState.shouldReject) {
      throw new Error('mutation failed')
    }
    return { ok: true }
  })

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  }

  return {
    activityLoadingState,
    taskLoadingState,
    activityStatsState,
    taskStatsState,
    updateGroupeState,
    toast,
    mutateAsyncMock,
  }
})

vi.mock('@/hooks/crm/useGroupeActivities', () => ({
  useGroupeActivityStats: (groupeId: string) => {
    void groupeId
    return {
      stats: activityStatsState.value,
      isLoading: activityLoadingState.value,
    }
  },
}))

vi.mock('@/hooks/crm/useGroupeTasksWithEstablishments', () => ({
  useGroupeTaskStats: (groupeId: string) => {
    void groupeId
    return {
      stats: taskStatsState.value,
      isLoading: taskLoadingState.value,
    }
  },
}))

vi.mock('@/hooks/crm/useGroupes', () => ({
  useUpdateGroupe: () => ({
    mutateAsync: mutateAsyncMock,
    get isPending() {
      return updateGroupeState.isPending
    },
  }),
}))

vi.mock('sonner', () => ({
  toast,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: PropsWithChildren) => <label>{children}</label>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/dialog', () => {
  const Dialog = ({ open, children }: PropsWithChildren<{ open?: boolean; onOpenChange?: (v: boolean) => void }>) => (
    <div data-testid="dialog-root" data-open={open ? 'true' : 'false'}>
      {children}
    </div>
  )

  const DialogTrigger = ({ asChild, children }: PropsWithChildren<{ asChild?: boolean }>) => {
    void asChild
    return <>{children}</>
  }

  const DialogContent = ({ children, onClick }: PropsWithChildren<{ onClick?: React.MouseEventHandler }>) => (
    <div role="dialog" onClick={onClick}>
      {children}
    </div>
  )

  const DialogHeader = ({ children }: PropsWithChildren) => <div>{children}</div>
  const DialogTitle = ({ children }: PropsWithChildren) => <h2>{children}</h2>

  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger }
})

vi.mock('@/components/ui/popover', () => {
  const Popover = ({ children }: PropsWithChildren) => <div>{children}</div>
  const PopoverTrigger = ({ asChild, children }: PropsWithChildren<{ asChild?: boolean }>) => {
    void asChild
    return <>{children}</>
  }
  const PopoverContent = ({ children, onClick }: PropsWithChildren<{ className?: string; align?: string; onClick?: React.MouseEventHandler }>) => (
    <div data-testid="popover-content" onClick={onClick}>
      {children}
    </div>
  )
  return { Popover, PopoverContent, PopoverTrigger }
})

vi.mock('@/components/ui/tooltip', () => {
  const TooltipProvider = ({ children }: PropsWithChildren) => <>{children}</>
  const Tooltip = ({ children }: PropsWithChildren) => <>{children}</>
  const TooltipTrigger = ({ asChild, children }: PropsWithChildren<{ asChild?: boolean }>) => {
    void asChild
    return <>{children}</>
  }
  const TooltipContent = ({ children }: PropsWithChildren) => <div>{children}</div>
  return { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
})

vi.mock('lucide-react', () => ({
  StickyNote: (props: Record<string, unknown>) => <svg data-testid="icon-sticky" {...props} />,
  ListTodo: (props: Record<string, unknown>) => <svg data-testid="icon-todo" {...props} />,
  Activity: (props: Record<string, unknown>) => <svg data-testid="icon-activity" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="icon-loader" {...props} />,
}))

import { GroupeQuickActions } from './GroupeQuickActions'

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

describe('GroupeQuickActions', () => {
  it('affiche les loaders pendant le chargement puis les stats métier (tâches/activités) et badges', async () => {
    activityLoadingState.value = true
    taskLoadingState.value = true

    const { rerender } = renderWithClient(
      <GroupeQuickActions groupeId="g1" groupeNom="Groupe A" currentNotes="Notes existantes" />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Aperçu des tâches' }))
    const popovers = screen.getAllByTestId('popover-content')
    const tasksPopover = popovers[0]
    expect(within(tasksPopover).getAllByTestId('icon-loader').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Aperçu des activités' }))
    const popovers2 = screen.getAllByTestId('popover-content')
    const activitiesPopover = popovers2[1]
    expect(within(activitiesPopover).getAllByTestId('icon-loader').length).toBeGreaterThan(0)

    taskLoadingState.value = false
    activityLoadingState.value = false

    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <GroupeQuickActions groupeId="g1" groupeNom="Groupe A" currentNotes="Notes existantes" />
      </QueryClientProvider>
    )

    expect(screen.getByRole('button', { name: 'Aperçu des tâches' })).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: 'Aperçu des activités' })).toHaveTextContent('3')

    expect(within(tasksPopover).getByText('Tâches du groupe')).toBeTruthy()
    expect(within(tasksPopover).getByText('7')).toBeTruthy()
    expect(within(tasksPopover).getByText('Tâches groupe')).toBeTruthy()
    expect(within(tasksPopover).getByText('5')).toBeTruthy()
    expect(within(tasksPopover).getByText('Tâches établ.')).toBeTruthy()
    expect(within(tasksPopover).getByText('6 terminées')).toBeTruthy()
    expect(within(tasksPopover).getByText('2 en cours')).toBeTruthy()

    expect(within(activitiesPopover).getByText('Activités récentes')).toBeTruthy()
    expect(within(activitiesPopover).getByText('12')).toBeTruthy()
    expect(within(activitiesPopover).getByText('Total')).toBeTruthy()
    expect(within(activitiesPopover).getByText('3')).toBeTruthy()
    expect(within(activitiesPopover).getByText('Ce mois')).toBeTruthy()
    expect(within(activitiesPopover).getByText(/8 terminées •\s*4 en cours/)).toBeTruthy()
  })

  it("ajoute une note (mutation) et appelle toast.success avec le payload attendu", async () => {
    updateGroupeState.isPending = false
    updateGroupeState.shouldReject = false
    toast.success.mockClear()
    toast.error.mockClear()
    mutateAsyncMock.mockClear()

    renderWithClient(<GroupeQuickActions groupeId="g1" groupeNom="Groupe A" currentNotes="Ancienne note" />)

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }))

    expect(screen.getByRole('heading', { name: /Note rapide - Groupe A/ })).toBeTruthy()

    const textarea = screen.getByPlaceholderText('Saisissez votre note...')
    await userEvent.type(textarea, 'Nouvelle note')

    const saveButton = screen.getByRole('button', { name: 'Enregistrer' })
    expect(saveButton).not.toBeDisabled()

    await act(async () => {
      await userEvent.click(saveButton)
    })

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
    const payload = mutateAsyncMock.mock.calls[0]?.[0] as { id: string; data: { notes: string } }
    expect(payload.id).toBe('g1')
    expect(payload.data.notes).toContain('Ancienne note')
    expect(payload.data.notes).toContain('Nouvelle note')
    expect(payload.data.notes).toMatch(/\[\d{2}\/\d{2}\/\d{4}\]/)

    expect(toast.success).toHaveBeenCalledWith('Note ajoutée')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("gère l'erreur de mutation et appelle toast.error", async () => {
    updateGroupeState.isPending = false
    updateGroupeState.shouldReject = true
    toast.success.mockClear()
    toast.error.mockClear()
    mutateAsyncMock.mockClear()

    renderWithClient(<GroupeQuickActions groupeId="g1" groupeNom="Groupe A" currentNotes={undefined} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une note' }))

    const textarea = screen.getByPlaceholderText('Saisissez votre note...')
    await userEvent.type(textarea, 'Texte en échec')

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    })

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
    const payload = mutateAsyncMock.mock.calls[0]?.[0] as { id: string; data: { notes: string } }
    expect(payload.id).toBe('g1')
    expect(payload.data.notes).toContain('Texte en échec')
    expect(payload.data.notes).not.toContain('undefined')

    expect(toast.error).toHaveBeenCalledWith("Erreur lors de l'ajout de la note")
    expect(toast.success).not.toHaveBeenCalled()
  })
})