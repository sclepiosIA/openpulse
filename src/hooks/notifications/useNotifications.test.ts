import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useNotificationRules,
  useNotificationHistory,
  useCreateNotificationRule,
  useUpdateNotificationRule,
  useDeleteNotificationRule,
  useSendTestEmail,
} from './useNotifications'

const {
  RULES_ROWS,
  HISTORY_ROWS,
  CREATED_RULE,
  UPDATED_RULE,
  TEST_EMAIL_RESPONSE,
  AUTH_STATE,
  toastSpy,
  sanitizeSpy,
  mockFrom,
  mockInvoke,
  selectMock,
  orderMock,
  limitMock,
  insertMock,
  updateMock,
  deleteMock,
  eqMock,
  singleMock,
  maybeSingleMock,
  gteMock,
  lteMock,
  inMock,
  thenMock,
  catchMock,
} = vi.hoisted(() => {
  const RULES_ROWS = [
    {
      id: 'r1',
      name: 'Nouvelle commande',
      description: 'Alerte commande créée',
      event_type: 'order_created',
      conditions: { status: 'new' },
      recipients: ['ops@example.com'],
      email_template: 'template-order',
      is_active: true,
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-03T10:00:00Z',
      created_by: 'u1',
    },
    {
      id: 'r2',
      name: 'Commande annulée',
      description: null,
      event_type: 'order_cancelled',
      conditions: { reason: 'client' },
      recipients: ['support@example.com'],
      email_template: null,
      is_active: false,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T12:00:00Z',
      created_by: null,
    },
  ]

  const HISTORY_ROWS = [
    {
      id: 'h1',
      rule_id: 'r1',
      event_type: 'order_created',
      recipient_email: 'ops@example.com',
      subject: 'Nouvelle commande',
      content: 'Une commande a été créée',
      status: 'sent',
      error_message: null,
      sent_at: '2024-02-01T09:00:00Z',
      metadata: { orderId: 'o1' },
      notifications_rules: { name: 'Nouvelle commande' },
    },
    {
      id: 'h2',
      rule_id: null,
      event_type: 'manual_test',
      recipient_email: 'qa@example.com',
      subject: 'Test',
      content: 'Email de test',
      status: 'failed',
      error_message: 'smtp down',
      sent_at: '2024-01-31T09:00:00Z',
      metadata: { test: true },
      notifications_rules: { name: 'Test manuel' },
    },
  ]

  const CREATED_RULE = {
    id: 'r3',
    name: 'Paiement reçu',
    description: 'Alerte paiement',
    event_type: 'payment_received',
    conditions: { paid: true },
    recipients: ['billing@example.com'],
    email_template: 'template-payment',
    is_active: true,
    created_at: '2024-03-01T10:00:00Z',
    updated_at: '2024-03-01T10:00:00Z',
    created_by: 'u1',
  }

  const UPDATED_RULE = {
    ...RULES_ROWS[0],
    name: 'Nouvelle commande VIP',
    is_active: false,
  }

  const TEST_EMAIL_RESPONSE = { message: 'Email de test envoyé' }
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const toastSpy = vi.fn()
  const sanitizeSpy = vi.fn((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const value = error as { message?: unknown }
      return String(value.message)
    }
    return 'Erreur inconnue'
  })

  const selectMock = vi.fn()
  const orderMock = vi.fn()
  const limitMock = vi.fn()
  const insertMock = vi.fn()
  const updateMock = vi.fn()
  const deleteMock = vi.fn()
  const eqMock = vi.fn()
  const singleMock = vi.fn()
  const maybeSingleMock = vi.fn()
  const gteMock = vi.fn()
  const lteMock = vi.fn()
  const inMock = vi.fn()
  const thenMock = vi.fn()
  const catchMock = vi.fn()
  const mockFrom = vi.fn()
  const mockInvoke = vi.fn()

  return {
    RULES_ROWS,
    HISTORY_ROWS,
    CREATED_RULE,
    UPDATED_RULE,
    TEST_EMAIL_RESPONSE,
    AUTH_STATE,
    toastSpy,
    sanitizeSpy,
    mockFrom,
    mockInvoke,
    selectMock,
    orderMock,
    limitMock,
    insertMock,
    updateMock,
    deleteMock,
    eqMock,
    singleMock,
    maybeSingleMock,
    gteMock,
    lteMock,
    inMock,
    thenMock,
    catchMock,
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSpy,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: selectMock,
    eq: eqMock,
    gte: gteMock,
    lte: lteMock,
    in: inMock,
    order: orderMock,
    limit: limitMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
    then: thenMock,
    catch: catchMock,
  }

  selectMock.mockImplementation(() => builder)
  eqMock.mockImplementation(() => builder)
  gteMock.mockImplementation(() => builder)
  lteMock.mockImplementation(() => builder)
  inMock.mockImplementation(() => builder)
  orderMock.mockImplementation(() => builder)
  limitMock.mockImplementation(() => Promise.resolve({ data: null, error: null }))
  insertMock.mockImplementation(() => builder)
  updateMock.mockImplementation(() => builder)
  deleteMock.mockImplementation(() => builder)
  singleMock.mockImplementation(() => Promise.resolve({ data: null, error: null }))
  maybeSingleMock.mockImplementation(() => Promise.resolve({ data: null, error: null }))
  thenMock.mockImplementation((onFulfilled?: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  )
  catchMock.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)
  )

  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
    },
  }
})

function createWrapper(client: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, props.children)
  }
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const builder = {
      select: selectMock,
      eq: eqMock,
      gte: gteMock,
      lte: lteMock,
      in: inMock,
      order: orderMock,
      limit: limitMock,
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
      then: thenMock,
      catch: catchMock,
    }

    mockFrom.mockImplementation(() => builder)

    selectMock.mockImplementation(() => builder)
    orderMock.mockImplementation(() => builder)
    limitMock.mockResolvedValue({ data: null, error: null })
    insertMock.mockImplementation(() => builder)
    updateMock.mockImplementation(() => builder)
    deleteMock.mockImplementation(() => builder)
    eqMock.mockImplementation(() => builder)
    gteMock.mockImplementation(() => builder)
    lteMock.mockImplementation(() => builder)
    inMock.mockImplementation(() => builder)
    singleMock.mockResolvedValue({ data: null, error: null })
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    thenMock.mockImplementation((onFulfilled?: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled)
    )
    catchMock.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected)
    )

    mockInvoke.mockResolvedValue({ data: TEST_EMAIL_RESPONSE, error: null })
    sanitizeSpy.mockImplementation((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        const value = error as { message?: unknown }
        return String(value.message)
      }
      return 'Erreur inconnue'
    })
  })

  it('useNotificationRules charge puis retourne les règles avec la requête attendue', async () => {
    limitMock.mockResolvedValueOnce({ data: RULES_ROWS, error: null })

    const client = createClient()
    const { result } = renderHook(() => useNotificationRules(), {
      wrapper: createWrapper(client),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('notifications_rules')
    expect(selectMock).toHaveBeenCalledWith(
      'id, name, description, event_type, conditions, recipients, email_template, is_active, created_at, updated_at, created_by'
    )
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limitMock).toHaveBeenCalledWith(100)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].name).toBe('Nouvelle commande')
    expect(result.current.data?.[0].recipients).toEqual(['ops@example.com'])
    expect(result.current.data?.[1].event_type).toBe('order_cancelled')
    expect(result.current.data?.[1].is_active).toBe(false)
  })

  it('useNotificationRules passe en erreur si supabase retourne une erreur', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'rules failed' } })

    const client = createClient()
    const { result } = renderHook(() => useNotificationRules(), {
      wrapper: createWrapper(client),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ message: 'rules failed' })
  })

  it('useNotificationHistory charge puis retourne l’historique enrichi', async () => {
    limitMock.mockResolvedValueOnce({ data: HISTORY_ROWS, error: null })

    const client = createClient()
    const { result } = renderHook(() => useNotificationHistory(), {
      wrapper: createWrapper(client),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('notifications_history')
    expect(selectMock).toHaveBeenCalledWith('\n          *,\n          notifications_rules (name)\n        ')
    expect(orderMock).toHaveBeenCalledWith('sent_at', { ascending: false })
    expect(limitMock).toHaveBeenCalledWith(100)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].status).toBe('sent')
    expect(result.current.data?.[0].notifications_rules?.name).toBe('Nouvelle commande')
    expect(result.current.data?.[1].recipient_email).toBe('qa@example.com')
    expect(result.current.data?.[1].error_message).toBe('smtp down')
  })

  it('useNotificationHistory passe en erreur si supabase retourne une erreur', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'history failed' } })

    const client = createClient()
    const { result } = renderHook(() => useNotificationHistory(), {
      wrapper: createWrapper(client),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ message: 'history failed' })
  })

  it('useCreateNotificationRule crée une règle, invalide le cache et affiche un toast de succès', async () => {
    singleMock.mockResolvedValueOnce({ data: CREATED_RULE, error: null })

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const payload = {
      name: 'Paiement reçu',
      description: 'Alerte paiement',
      event_type: 'payment_received',
      conditions: { paid: true },
      recipients: ['billing@example.com'],
      email_template: 'template-payment',
      is_active: true,
    }

    const { result } = renderHook(() => useCreateNotificationRule(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('notifications_rules')
    expect(insertMock).toHaveBeenCalledWith([payload])
    expect(selectMock).toHaveBeenCalledWith()
    expect(singleMock).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notification-rules'] })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Règle de notification créée avec succès',
    })
  })

  it('useCreateNotificationRule gère l’erreur avec sanitizeSupabaseError et toast destructive', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: 'create failed' } })
    sanitizeSpy.mockReturnValueOnce('create failed')

    const client = createClient()
    const { result } = renderHook(() => useCreateNotificationRule(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          name: 'Paiement reçu',
          description: null,
          event_type: 'payment_received',
          conditions: { paid: true },
          recipients: ['billing@example.com'],
          email_template: null,
          is_active: true,
        })
      ).rejects.toMatchObject({ message: 'create failed' })
    })

    expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'create failed' })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'create failed',
      variant: 'destructive',
    })
  })

  it('useUpdateNotificationRule met à jour une règle avec le bon id et affiche un toast de succès', async () => {
    singleMock.mockResolvedValueOnce({ data: UPDATED_RULE, error: null })

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const payload = {
      id: 'r1',
      name: 'Nouvelle commande VIP',
      is_active: false,
    }

    const { result } = renderHook(() => useUpdateNotificationRule(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('notifications_rules')
    expect(updateMock).toHaveBeenCalledWith({ name: 'Nouvelle commande VIP', is_active: false })
    expect(eqMock).toHaveBeenCalledWith('id', 'r1')
    expect(selectMock).toHaveBeenCalledWith()
    expect(singleMock).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notification-rules'] })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Règle de notification mise à jour avec succès',
    })
  })

  it('useUpdateNotificationRule gère l’erreur avec toast destructive', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } })
    sanitizeSpy.mockReturnValueOnce('update failed')

    const client = createClient()
    const { result } = renderHook(() => useUpdateNotificationRule(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'r1',
          name: 'Broken update',
        })
      ).rejects.toMatchObject({ message: 'update failed' })
    })

    expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'update failed' })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'update failed',
      variant: 'destructive',
    })
  })

  it('useDeleteNotificationRule supprime une règle, invalide le cache et affiche un toast de succès', async () => {
    eqMock.mockResolvedValueOnce({ error: null })

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteNotificationRule(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync('r2')
    })

    expect(mockFrom).toHaveBeenCalledWith('notifications_rules')
    expect(deleteMock).toHaveBeenCalledWith()
    expect(eqMock).toHaveBeenCalledWith('id', 'r2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notification-rules'] })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Règle de notification supprimée avec succès',
    })
  })

  it('useDeleteNotificationRule gère l’erreur avec toast destructive', async () => {
    eqMock.mockResolvedValueOnce({ error: { message: 'delete failed' } })
    sanitizeSpy.mockReturnValueOnce('delete failed')

    const client = createClient()
    const { result } = renderHook(() => useDeleteNotificationRule(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(result.current.mutateAsync('r2')).rejects.toMatchObject({ message: 'delete failed' })
    })

    expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'delete failed' })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'delete failed',
      variant: 'destructive',
    })
  })

  it('useSendTestEmail invoque la function supabase avec le bon body et affiche le message de succès renvoyé', async () => {
    mockInvoke.mockResolvedValueOnce({ data: TEST_EMAIL_RESPONSE, error: null })

    const client = createClient()
    const { result } = renderHook(() => useSendTestEmail(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        recipient: 'qa@example.com',
        subject: 'Sujet test',
        content: 'Contenu test',
      })
    })

    expect(mockInvoke).toHaveBeenCalledWith('send-test-email', {
      body: {
        recipient: 'qa@example.com',
        subject: 'Sujet test',
        content: 'Contenu test',
      },
    })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Email de test envoyé',
    })
  })

  it('useSendTestEmail utilise un message par défaut si la réponse ne contient pas de message', async () => {
    mockInvoke.mockResolvedValueOnce({ data: {}, error: null })

    const client = createClient()
    const { result } = renderHook(() => useSendTestEmail(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({
        recipient: 'qa@example.com',
      })
    })

    expect(mockInvoke).toHaveBeenCalledWith('send-test-email', {
      body: {
        recipient: 'qa@example.com',
        subject: undefined,
        content: undefined,
      },
    })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Email de test envoyé avec succès',
    })
  })

  it('useSendTestEmail gère l’erreur avec sanitizeSupabaseError et toast destructive', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'invoke failed' } })
    sanitizeSpy.mockReturnValueOnce('invoke failed')

    const client = createClient()
    const { result } = renderHook(() => useSendTestEmail(), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          recipient: 'qa@example.com',
        })
      ).rejects.toMatchObject({ message: 'invoke failed' })
    })

    expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'invoke failed' })
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'invoke failed',
      variant: 'destructive',
    })
  })
})