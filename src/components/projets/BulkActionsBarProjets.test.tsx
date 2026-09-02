import React from 'react'
import { render, screen, waitFor, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'

const {
  PROFILES,
  TASKS,
  selectedIds,
  toastSpy,
  sanitizeSpy,
  exportSpy,
  getStatusLabelFrSpy,
  invalidateSpy,
  onClearSelectionSpy,
  supabaseState,
  mockFrom,
  updateSpy,
  inSpy,
  builder,
} = vi.hoisted(() => {
  const PROFILES = [
    { id: 'p1', prenom: 'Alice', nom: 'Martin' },
    { id: 'p2', prenom: 'Benoit', nom: 'Durand' },
  ]

  const TASKS = [
    { id: 't1', titre: 'Tâche 1' },
    { id: 't2', titre: 'Tâche 2' },
    { id: 't3', titre: 'Tâche 3' },
  ]

  const selectedIds = ['t1', 't3']

  const toastSpy = vi.fn()
  const sanitizeSpy = vi.fn((err: unknown) => {
    if (typeof err === 'object' && err && 'message' in err) return String((err as { message?: unknown }).message ?? 'err')
    return 'err'
  })

  const exportSpy = vi.fn()
  const getStatusLabelFrSpy = vi.fn((s: string) => `FR:${s}`)

  const invalidateSpy = vi.fn()
  const onClearSelectionSpy = vi.fn()

  const supabaseState: {
    updateResult: { error: null | { message: string } }
  } = {
    updateResult: { error: null },
  }

  const updateSpy = vi.fn()
  const inSpy = vi.fn()

  const createThenable = (value: unknown) => ({
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(value).then(onFulfilled),
    catch: (onRejected: (e: unknown) => unknown) => Promise.resolve(value).catch(onRejected),
  })

  const builder: {
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
    then: (onFulfilled: (v: unknown) => unknown) => Promise<unknown>
    catch: (onRejected: (e: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn((col: string, ids: string[]) => {
      inSpy(col, ids)
      return createThenable(supabaseState.updateResult)
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn((data: unknown) => {
      updateSpy(data)
      return builder
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  }

  const mockFrom = vi.fn((_table: string) => builder)

  return {
    PROFILES,
    TASKS,
    selectedIds,
    toastSpy,
    sanitizeSpy,
    exportSpy,
    getStatusLabelFrSpy,
    invalidateSpy,
    onClearSelectionSpy,
    supabaseState,
    mockFrom,
    updateSpy,
    inSpy,
    builder,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    type,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    'aria-label'?: string
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/select', () => {
  const Select = ({
    onValueChange,
    disabled,
    children,
  }: {
    onValueChange?: (v: string) => void
    disabled?: boolean
    children?: React.ReactNode
  }) => (
    <div data-testid="select-root" data-disabled={disabled ? '1' : '0'}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        if ((child.type as { displayName?: string }).displayName === 'SelectContent') {
          return React.cloneElement(child, { onValueChange })
        }
        return child
      })}
    </div>
  )

  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>

  const SelectContent = ({
    children,
    onValueChange,
  }: {
    children?: React.ReactNode
    onValueChange?: (v: string) => void
  }) => (
    <div>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        const value = (child.props as { value?: string }).value
        return React.cloneElement(child, { onValueChange, value })
      })}
    </div>
  )
  ;(SelectContent as { displayName?: string }).displayName = 'SelectContent'

  const SelectItem = ({
    value,
    children,
    onValueChange,
  }: {
    value: string
    children?: React.ReactNode
    onValueChange?: (v: string) => void
  }) => (
    <button type="button" data-select-value={value} onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  )

  return { Select, SelectTrigger, SelectContent, SelectItem }
})

vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="icon-x" />,
  Download: () => <svg data-testid="icon-download" />,
  UserPlus: () => <svg data-testid="icon-userplus" />,
  CheckCircle: () => <svg data-testid="icon-checkcircle" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Archive: () => <svg data-testid="icon-archive" />,
  CheckCheck: () => <svg data-testid="icon-checkcheck" />,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: vi.fn(() => ({ data: PROFILES })),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: unknown) => sanitizeSpy(e),
}))

vi.mock('@/lib/projetsUtils', () => ({
  exportTasksToCSV: (...args: unknown[]) => exportSpy(...args),
  TASK_STATUSES: ['À faire', 'En cours', 'Terminé'],
  getStatusLabelFr: (s: string) => getStatusLabelFrSpy(s),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

import { BulkActionsBarProjets } from './BulkActionsBarProjets'

function createTestQueryClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const originalInvalidate = qc.invalidateQueries.bind(qc)
  qc.invalidateQueries = ((...args: Parameters<typeof originalInvalidate>) => {
    invalidateSpy(...args)
    return Promise.resolve()
  }) as typeof qc.invalidateQueries

  return qc
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = React.useMemo(() => createTestQueryClient(), [])
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('BulkActionsBarProjets', () => {
  it('ne rend rien si aucune sélection', () => {
    const { container } = render(
      <BulkActionsBarProjets selectedIds={[]} tasks={TASKS} onClearSelection={onClearSelectionSpy} />,
      { wrapper: Wrapper }
    )
    expect(container.firstChild).toBeNull()
  })

  it('loading -> affiche puis retire le loader pendant une mutation', async () => {
    supabaseState.updateResult = { error: null }
    updateSpy.mockClear()
    inSpy.mockClear()

    let resolveUpdate: (() => void) | null = null
    const updatePromise = new Promise<void>((resolve) => {
      resolveUpdate = resolve
    })

    builder.in.mockImplementationOnce((col: string, ids: string[]) => {
      inSpy(col, ids)
      return {
        then: (onFulfilled: (v: unknown) => unknown) =>
          updatePromise.then(() => onFulfilled(supabaseState.updateResult)),
        catch: (onRejected: (e: unknown) => unknown) =>
          updatePromise.then(() => supabaseState.updateResult).catch(onRejected),
      }
    })

    const user = userEvent.setup()
    render(
      <BulkActionsBarProjets selectedIds={selectedIds} tasks={TASKS} onClearSelection={onClearSelectionSpy} />,
      { wrapper: Wrapper }
    )

    expect(screen.queryByTestId('icon-loader')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Terminer' }))

    expect(screen.getByTestId('icon-loader')).toBeInTheDocument()

    await act(async () => {
      resolveUpdate?.()
      await updatePromise
    })

    await waitFor(() => {
      expect(screen.queryByTestId('icon-loader')).toBeNull()
    })
  })

  it('succès: terminer met à jour statut (avec date) + invalide + clear + toast', async () => {
    supabaseState.updateResult = { error: null }
    mockFrom.mockClear()
    updateSpy.mockClear()
    inSpy.mockClear()
    invalidateSpy.mockClear()
    onClearSelectionSpy.mockClear()
    toastSpy.mockClear()

    const user = userEvent.setup()

    render(
      <BulkActionsBarProjets selectedIds={selectedIds} tasks={TASKS} onClearSelection={onClearSelectionSpy} />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('2 sélectionnés')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Terminer' }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches')
      expect(updateSpy).toHaveBeenCalledTimes(1)
      expect(inSpy).toHaveBeenCalledWith('id', selectedIds)
    })

    const updateArg = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(updateArg.statut).toBe('Terminé')
    expect(typeof updateArg.date_realisation).toBe('string')
    expect((updateArg.date_realisation as string).length).toBe(10)

    expect(toastSpy).toHaveBeenCalledWith({ title: '2 tâche(s) mise(s) à jour' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taches'] })
    expect(onClearSelectionSpy).toHaveBeenCalledTimes(1)
  })

  it('erreur: assign responsable -> toast destructive avec message sanitizé et pas de clear', async () => {
    supabaseState.updateResult = { error: { message: 'x' } }
    mockFrom.mockClear()
    updateSpy.mockClear()
    inSpy.mockClear()
    invalidateSpy.mockClear()
    onClearSelectionSpy.mockClear()
    toastSpy.mockClear()
    sanitizeSpy.mockClear()

    const user = userEvent.setup()

    render(
      <BulkActionsBarProjets selectedIds={selectedIds} tasks={TASKS} onClearSelection={onClearSelectionSpy} />,
      { wrapper: Wrapper }
    )

    const assignP1 = screen.getByRole('button', { name: 'Alice Martin' })
    await user.click(assignP1)

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches')
      expect(updateSpy).toHaveBeenCalledWith({ responsable_id: 'p1' })
      expect(inSpy).toHaveBeenCalledWith('id', selectedIds)
    })

    expect(sanitizeSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'x',
      variant: 'destructive',
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(onClearSelectionSpy).not.toHaveBeenCalled()
  })

  it('export: exporte uniquement les tâches sélectionnées et toast', async () => {
    exportSpy.mockClear()
    toastSpy.mockClear()
    onClearSelectionSpy.mockClear()

    const user = userEvent.setup()

    render(
      <BulkActionsBarProjets selectedIds={selectedIds} tasks={TASKS} onClearSelection={onClearSelectionSpy} />,
      { wrapper: Wrapper }
    )

    await user.click(screen.getByRole('button', { name: 'CSV' }))

    expect(exportSpy).toHaveBeenCalledTimes(1)
    const [exportedTasks, filename] = exportSpy.mock.calls[0] as [unknown, unknown]
    expect(filename).toBe('taches_selection')
    expect(Array.isArray(exportedTasks)).toBe(true)
    expect((exportedTasks as Array<{ id: string }>).map((t) => t.id)).toEqual(['t1', 't3'])

    expect(toastSpy).toHaveBeenCalledWith({ title: '2 tâche(s) exportée(s)' })
    expect(onClearSelectionSpy).not.toHaveBeenCalled()
  })

  it('bouton fermer: appelle onClearSelection', async () => {
    onClearSelectionSpy.mockClear()
    const user = userEvent.setup()

    render(
      <BulkActionsBarProjets selectedIds={selectedIds} tasks={TASKS} onClearSelection={onClearSelectionSpy} />,
      { wrapper: Wrapper }
    )

    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClearSelectionSpy).toHaveBeenCalledTimes(1)
  })

  it('hook: renderHook + QueryClientProvider expose le client (règle wrapper)', () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useQueryClient(), { wrapper })
    expect(result.current).toBe(qc)
  })
})