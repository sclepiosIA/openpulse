import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmailMaintenanceActions } from './EmailMaintenanceActions'

const {
  COUNTS,
  THREAD_COUNTS_WITH_PHANTOMS,
  mockFrom,
  supabaseThenable,
  builder,
  mockInvoke,
  invokeResultsQueue,
  debugError,
  toast,
  refetchStats,
} = vi.hoisted(() => {
  const COUNTS = {
    nullCount: 2,
    emptyCount: 1,
  }

  const THREAD_COUNTS_WITH_PHANTOMS = [
    { id: 't1', message_count: 2, messages: [{ count: 0 }] },
    { id: 't2', message_count: 1, messages: [{ count: 0 }] },
    { id: 't3', message_count: 5, messages: [{ count: 5 }] },
  ]

  const invokeResultsQueue: Array<{ data: unknown; error: { message: string } | null }> = []

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }

  const debugError = vi.fn()

  const refetchStats = vi.fn()

  type QueryResult = { data?: unknown; error?: unknown; count?: number | null }
  type BuilderState = {
    table: string
    lastSelect: { columns: string; options?: Record<string, unknown> } | null
    filters: Array<{ op: string; column: string; value?: unknown }>
    result: QueryResult
  }

  const stateByBuilder = new WeakMap<object, BuilderState>()

  const resolveForState = async (st: BuilderState): Promise<QueryResult> => {
    if (st.table === 'email_messages') {
      if (st.lastSelect?.options && st.lastSelect.options['head'] === true && st.lastSelect.options['count'] === 'exact') {
        const hasIsHtmlNull = st.filters.some((f) => f.op === 'is' && f.column === 'body_html' && f.value === null)
        const hasIsTextNull = st.filters.some((f) => f.op === 'is' && f.column === 'body_text' && f.value === null)
        const hasEqHtmlEmpty = st.filters.some((f) => f.op === 'eq' && f.column === 'body_html' && f.value === '')
        const hasEqTextEmpty = st.filters.some((f) => f.op === 'eq' && f.column === 'body_text' && f.value === '')

        if (hasIsHtmlNull && hasIsTextNull) return { count: COUNTS.nullCount }
        if (hasEqHtmlEmpty && hasEqTextEmpty) return { count: COUNTS.emptyCount }
        return { count: 0 }
      }
      return { data: [] }
    }

    if (st.table === 'email_threads') {
      const hasGtMessageCount = st.filters.some((f) => f.op === 'gt' && f.column === 'message_count')
      if (hasGtMessageCount) return { data: THREAD_COUNTS_WITH_PHANTOMS }
      return { data: [] }
    }

    return st.result
  }

  const supabaseThenable = (b: object) => ({
    then: (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      resolveForState(stateByBuilder.get(b) as BuilderState).then(onFulfilled, onRejected),
    catch: (onRejected: (e: unknown) => unknown) =>
      resolveForState(stateByBuilder.get(b) as BuilderState).catch(onRejected),
  })

  const makeBuilder = (table: string) => {
    const b: Record<string, unknown> = {}
    const st: BuilderState = { table, lastSelect: null, filters: [], result: { data: null, error: null, count: null } }
    stateByBuilder.set(b, st)

    const chain = () => b

    b.select = (columns: string, options?: Record<string, unknown>) => {
      st.lastSelect = { columns, options }
      return chain()
    }
    b.eq = (column: string, value: unknown) => {
      st.filters.push({ op: 'eq', column, value })
      return chain()
    }
    b.is = (column: string, value: unknown) => {
      st.filters.push({ op: 'is', column, value })
      return chain()
    }
    b.gt = (column: string, value: unknown) => {
      st.filters.push({ op: 'gt', column, value })
      return chain()
    }
    b.gte = (column: string, value: unknown) => {
      st.filters.push({ op: 'gte', column, value })
      return chain()
    }
    b.lte = (column: string, value: unknown) => {
      st.filters.push({ op: 'lte', column, value })
      return chain()
    }
    b.in = (column: string, value: unknown) => {
      st.filters.push({ op: 'in', column, value })
      return chain()
    }
    b.order = () => chain()
    b.limit = () => chain()
    b.insert = () => chain()
    b.update = () => chain()
    b.delete = () => chain()
    b.single = async () => resolveForState(st)
    b.maybeSingle = async () => resolveForState(st)

    b.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      supabaseThenable(b).then(onFulfilled, onRejected)
    b.catch = (onRejected: (e: unknown) => unknown) => supabaseThenable(b).catch(onRejected)

    return b
  }

  const builder = {
    makeBuilder,
  }

  const mockFrom = vi.fn((table: string) => builder.makeBuilder(table))

  const mockInvoke = vi.fn(async (_fnName: string, _args?: unknown) => {
    const next = invokeResultsQueue.shift()
    if (!next) return { data: null, error: { message: 'no queued result' } }
    return next
  })

  return {
    COUNTS,
    THREAD_COUNTS_WITH_PHANTOMS,
    mockFrom,
    supabaseThenable,
    builder,
    mockInvoke,
    invokeResultsQueue,
    debugError,
    toast,
    refetchStats,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

vi.mock('@/hooks/email/useEmailClassificationStats', () => ({
  useEmailClassificationStats: () => ({ refetch: refetchStats }),
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: debugError, log: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('sonner', () => ({ toast }))

vi.mock('lucide-react', () => ({
  Loader2: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'loader2', ...props }),
  FileText: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'filetext', ...props }),
  Wrench: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'wrench', ...props }),
  Shield: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'shield', ...props }),
  AlertCircle: (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': 'alertcircle', ...props }),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => React.createElement('div', props, children),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) =>
    React.createElement('button', props, children),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: { value: number }) => React.createElement('div', { role: 'progressbar', 'aria-valuenow': value, ...props }),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = createQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('EmailMaintenanceActions', () => {
  it('charge les stats et affiche les compteurs (succès) puis active le bouton resync', async () => {
    renderWithQueryClient(<EmailMaintenanceActions />)

    await waitFor(() => {
      expect(screen.getByText(String(COUNTS.nullCount + COUNTS.emptyCount))).toBeTruthy()
    })

    expect(screen.getByText('2')).toBeTruthy()

    const resyncTotal = COUNTS.nullCount + COUNTS.emptyCount + 2
    expect(screen.getByText(`Resynchroniser (${resyncTotal})`)).toBeTruthy()

    const resyncBtn = screen.getByRole('button', { name: `Resynchroniser (${resyncTotal})` })
    expect(resyncBtn).not.toHaveProperty('disabled', true)

    const integrityBtn = screen.getByRole('button', { name: "Vérifier l'intégrité" })
    expect(integrityBtn).not.toHaveProperty('disabled', true)
  })

  it("répare (resync + fix counters) et appelle les fonctions supabase avec les bons paramètres, refetchStats est déclenché", async () => {
    invokeResultsQueue.push(
      { data: { fixed: 3, failed: 1 }, error: null },
      { data: { summary: { threads_fixed: 4, threads_deleted: 2 } }, error: null },
    )

    renderWithQueryClient(<EmailMaintenanceActions />)

    const resyncTotal = COUNTS.nullCount + COUNTS.emptyCount + 2
    await screen.findByText(`Resynchroniser (${resyncTotal})`)

    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: `Resynchroniser (${resyncTotal})` })

    await act(async () => {
      await user.click(btn)
    })

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('resync-empty-emails', { body: { testMode: false } })
    })
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fix-thread-counters')
    })

    expect(toast.success).toHaveBeenCalledWith('Resynchronisation terminée: 3 email(s) réparé(s), 1 échec(s)')
    expect(toast.info).toHaveBeenCalledWith('Correction des compteurs en cours...')
    expect(toast.success).toHaveBeenCalledWith('Intégrité vérifiée: 4 corrigé(s), 2 supprimé(s)')
    expect(refetchStats).toHaveBeenCalledTimes(1)
  })

  it("gère l'erreur lors de la vérification d'intégrité (toast.error + debug.error) et ne refetch pas", async () => {
    refetchStats.mockClear()
    debugError.mockClear()
    toast.error.mockClear()
    toast.success.mockClear()
    toast.info.mockClear()
    mockInvoke.mockClear()

    invokeResultsQueue.push({ data: null, error: { message: 'x' } })

    renderWithQueryClient(<EmailMaintenanceActions />)
    await screen.findByText('Vérifier l\'intégrité')

    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: "Vérifier l'intégrité" })

    await act(async () => {
      await user.click(btn)
    })

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fix-thread-counters')
    })

    expect(toast.error).toHaveBeenCalledWith("Erreur lors de la vérification d'intégrité")
    expect(debugError).toHaveBeenCalled()
    expect(refetchStats).not.toHaveBeenCalled()
  })
})