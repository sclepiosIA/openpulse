// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react'
import { BulkUploadBulletinsDialog } from './BulkUploadBulletinsDialog'

const {
  AUTH_STATE,
  PROFILES_MAP,
  PARSED_DATA,
  toastSuccess,
  toastError,
  toastWarning,
  sanitizeSupabaseErrorMock,
  sanitizeFileNameMock,
  findProfileByNameMock,
  invokeMock,
  uploadMock,
  removeMock,
  mockFrom,
  selectMock,
  insertMock,
  eqMock,
  singleMock,
  maybeSingleMock,
  orderMock,
  limitMock,
  updateMock,
  deleteMock,
  inMock,
  gteMock,
  lteMock,
  debugLogMock,
  debugErrorMock,
  resultRowSpy,
  storageFromMock,
  progressValues,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const PROFILES_MAP = new Map([
    ['profile-1', { id: 'profile-1', prenom: 'Jean', nom: 'Dupont' }],
    ['profile-2', { id: 'profile-2', prenom: 'Marie', nom: 'Martin' }],
  ])

  const PARSED_DATA = {
    employe: { nom: 'Dupont', prenom: 'Jean', numero_securite_sociale: '123' },
    confidence: 92,
    mois: '2024-05',
    salaire_brut: 3200,
    salaire_net: 2500,
    salaire_net_a_payer: 2450,
    cotisations_salariales: 700,
    cotisations_patronales: 900,
    primes: 100,
    heures_supplementaires: 10,
  }

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const toastWarning = vi.fn()
  const sanitizeSupabaseErrorMock = vi.fn((error: unknown) =>
    error instanceof Error ? error.message : 'Erreur inconnue'
  )
  const sanitizeFileNameMock = vi.fn((name: string) => name.replace(/\s+/g, '_'))
  const findProfileByNameMock = vi.fn()
  const invokeMock = vi.fn()
  const uploadMock = vi.fn()
  const removeMock = vi.fn()
  const storageFromMock = vi.fn()

  const selectMock = vi.fn()
  const insertMock = vi.fn()
  const eqMock = vi.fn()
  const singleMock = vi.fn()
  const maybeSingleMock = vi.fn()
  const orderMock = vi.fn()
  const limitMock = vi.fn()
  const updateMock = vi.fn()
  const deleteMock = vi.fn()
  const inMock = vi.fn()
  const gteMock = vi.fn()
  const lteMock = vi.fn()

  const debugLogMock = vi.fn()
  const debugErrorMock = vi.fn()
  const resultRowSpy = vi.fn()
  const progressValues: number[] = []

  const builder = {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    eq: eqMock,
    gte: gteMock,
    lte: lteMock,
    in: inMock,
    order: orderMock,
    limit: limitMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
    then: undefined as unknown,
    catch: undefined as unknown,
  }

  selectMock.mockImplementation(() => builder)
  insertMock.mockImplementation(() => builder)
  updateMock.mockImplementation(() => builder)
  deleteMock.mockImplementation(() => builder)
  eqMock.mockImplementation(() => builder)
  gteMock.mockImplementation(() => builder)
  lteMock.mockImplementation(() => builder)
  inMock.mockImplementation(() => builder)
  orderMock.mockImplementation(() => builder)
  limitMock.mockImplementation(() => builder)
  singleMock.mockResolvedValue({ data: { id: 'doc-1' }, error: null })
  maybeSingleMock.mockResolvedValue({ data: null, error: null })

  builder.then = (onFulfilled?: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  builder.catch = (onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)

  const mockFrom = vi.fn(() => builder)

  storageFromMock.mockReturnValue({
    upload: uploadMock,
    remove: removeMock,
  })

  return {
    AUTH_STATE,
    PROFILES_MAP,
    PARSED_DATA,
    toastSuccess,
    toastError,
    toastWarning,
    sanitizeSupabaseErrorMock,
    sanitizeFileNameMock,
    findProfileByNameMock,
    invokeMock,
    uploadMock,
    removeMock,
    mockFrom,
    selectMock,
    insertMock,
    eqMock,
    singleMock,
    maybeSingleMock,
    orderMock,
    limitMock,
    updateMock,
    deleteMock,
    inMock,
    gteMock,
    lteMock,
    debugLogMock,
    debugErrorMock,
    resultRowSpy,
    storageFromMock,
    progressValues,
  }
})

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    ...props
  }: {
    children: React.ReactNode
    asChild?: boolean
    onClick?: React.MouseEventHandler<HTMLElement>
    disabled?: boolean
    size?: string
    variant?: string
  }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, props)
    }
    return <button {...props}>{children}</button>
  },
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => {
    progressValues.push(value ?? 0)
    return <div data-testid="progress">{value ?? 0}</div>
  },
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  Upload: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="upload-icon" {...props} />,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: storageFromMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}))

vi.mock('@/hooks/profile/useProfilesMap', () => ({
  useProfilesMap: () => ({ map: PROFILES_MAP }),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLogMock,
    error: debugErrorMock,
  },
}))

vi.mock('./bulkUploadBulletinsHelpers', () => ({
  sanitizeFileName: sanitizeFileNameMock,
  normalizeMonthToDate: vi.fn((value: string) => value),
  findProfileByName: findProfileByNameMock,
}))

vi.mock('./BulkUploadBulletinsResultRow', () => ({
  BulkUploadBulletinsResultRow: (props: {
    result: { fileName: string; status: string; error?: string }
  }) => {
    resultRowSpy(props)
    return (
      <div data-testid="result-row">
        <span>{props.result.fileName}</span>
        <span>{props.result.status}</span>
        {props.result.error ? <span>{props.result.error}</span> : null}
      </div>
    )
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
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

function setup() {
  return render(<BulkUploadBulletinsDialog open={true} onOpenChange={vi.fn()} />, {
    wrapper: createWrapper(),
  })
}

function getFileInput() {
  const input = document.getElementById('bulk-file-input')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('file input not found')
  }
  return input
}

function getStartButton() {
  return screen.getByRole('button', { name: /lancer le traitement/i })
}

describe('BulkUploadBulletinsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressValues.length = 0

    uploadMock.mockResolvedValue({ error: null })
    removeMock.mockResolvedValue({ error: null })
    invokeMock.mockResolvedValue({
      data: { data: PARSED_DATA },
      error: null,
    })
    findProfileByNameMock.mockResolvedValue({ profileId: 'profile-1', matchType: 'exact' })
    singleMock.mockResolvedValue({ data: { id: 'doc-1' }, error: null })
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
  })

  it('rend le composant dans le wrapper QueryClientProvider et prépare uniquement les PDF sélectionnés', async () => {
    const { result } = renderHook(() => ({ ok: true }), { wrapper: createWrapper() })
    expect(result.current.ok).toBe(true)

    setup()

    expect(screen.getByText('Upload multiple de bulletins de salaire')).toBeInTheDocument()
    expect(screen.getByText(/Sélectionnez vos bulletins de salaire/i)).toBeInTheDocument()

    const input = getFileInput()
    const pdf1 = new File(['a'], 'bulletin mai.pdf', { type: 'application/pdf' })
    const pdf2 = new File(['b'], 'bulletin juin.pdf', { type: 'application/pdf' })
    const txt = new File(['c'], 'notes.txt', { type: 'text/plain' })

    await act(async () => {
      fireEvent.change(input, { target: { files: [pdf1, pdf2, txt] } })
    })

    expect(toastWarning).toHaveBeenCalledWith(
      '1 fichier(s) ignoré(s) - Seuls les PDF sont acceptés'
    )
    expect(toastSuccess).toHaveBeenCalledWith('2 fichier(s) PDF prêt(s) à être traité(s)')
    expect(screen.getAllByText('pending')).toHaveLength(2)
    expect(screen.getByText('bulletin mai.pdf')).toBeInTheDocument()
    expect(screen.getByText('bulletin juin.pdf')).toBeInTheDocument()
  })

  it('traite un bulletin avec succès en créant upload temporaire, document puis salaire', async () => {
    const onCompleted = vi.fn()

    render(
      <BulkUploadBulletinsDialog open={true} onOpenChange={vi.fn()} onCompleted={onCompleted} />,
      { wrapper: createWrapper() }
    )

    const input = getFileInput()
    const pdf = new File(['pdf-content'], 'bulletin mai 2024.pdf', { type: 'application/pdf' })

    await act(async () => {
      fireEvent.change(input, { target: { files: [pdf] } })
    })

    await act(async () => {
      fireEvent.click(getStartButton())
    })

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('parse-bulletin-temp', {
        body: { storage_path: expect.stringContaining('temp/') },
      })
    })

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(2)
    })

    expect(sanitizeFileNameMock).toHaveBeenCalledWith('bulletin mai 2024.pdf')
    expect(findProfileByNameMock).toHaveBeenCalledWith('Dupont', 'Jean', '123')
    expect(storageFromMock).toHaveBeenCalledWith('rh-documents')
    expect(removeMock).toHaveBeenCalledWith([expect.stringContaining('temp/')])
    expect(mockFrom).toHaveBeenCalledWith('rh_documents_employes')
    expect(mockFrom).toHaveBeenCalledWith('rh_salaires_mensuels')

    const insertCalls = insertMock.mock.calls.map((call) => call[0])
    expect(
      insertCalls.some(
        (payload) =>
          typeof payload === 'object' &&
          payload !== null &&
          'type_document' in payload &&
          payload.type_document === 'bulletin_salaire' &&
          payload.profile_id === 'profile-1' &&
          payload.titre === 'Bulletin 2024-05' &&
          typeof payload.storage_path === 'string' &&
          payload.storage_path.includes('profile-1/')
      )
    ).toBe(true)

    expect(
      insertCalls.some(
        (payload) =>
          typeof payload === 'object' &&
          payload !== null &&
          'source_type' in payload &&
          payload.source_type === 'auto_bulletin' &&
          payload.profile_id === 'profile-1' &&
          payload.mois === '2024-05-01' &&
          payload.salaire_brut === 3200 &&
          payload.salaire_net === 2500 &&
          payload.net_paye === 2450 &&
          payload.source_document_id === 'doc-1'
      )
    ).toBe(true)

    await waitFor(() => {
      expect(screen.getByText('success')).toBeInTheDocument()
    })

    expect(progressValues.some((value) => value === 100)).toBe(true)
    expect(toastSuccess).toHaveBeenCalledWith('1 fichier(s) PDF prêt(s) à être traité(s)')
    expect(onCompleted).not.toHaveBeenCalled()
  })

  it('met le résultat en erreur quand l’analyse supabase échoue', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'x' },
    })

    setup()

    const input = getFileInput()
    const pdf = new File(['pdf-content'], 'erreur.pdf', { type: 'application/pdf' })

    await act(async () => {
      fireEvent.change(input, { target: { files: [pdf] } })
    })

    await act(async () => {
      fireEvent.click(getStartButton())
    })

    await waitFor(() => {
      expect(debugErrorMock).toHaveBeenCalled()
    })

    expect(screen.getByText('erreur.pdf')).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
    expect(screen.getByText('Analyse échouée: x')).toBeInTheDocument()
    expect(invokeMock).toHaveBeenCalledWith('parse-bulletin-temp', {
      body: { storage_path: expect.stringContaining('temp/') },
    })
  })
})