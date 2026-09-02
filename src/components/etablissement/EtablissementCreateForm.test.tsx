import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const {
  mockMutateAsyncSuccess,
  mockMutateAsyncError,
  mockUseCreateEtablissement,
  mockUseProfilesWithRoles,
  mockInsert,
  mockInvalidateQueries,
  mockDebugError,
  mockEtablissementForm,
  defaultProfilesData,
  createdEtablissement,
  initialDomainValue,
  cleanedDataWithoutOptional,
} = vi.hoisted(() => {
  const mockMutateAsyncSuccess = vi.fn()
  const mockMutateAsyncError = vi.fn()
  const mockUseCreateEtablissement = vi.fn()
  const mockUseProfilesWithRoles = vi.fn()
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockInvalidateQueries = vi.fn()
  const mockDebugError = vi.fn()

  const defaultProfilesData = [
    { id: 'p1', email: 'user1@example.com', role: 'admin' },
    { id: 'p2', email: 'user2@example.com', role: 'user' },
  ]

  const createdEtablissement = {
    id: 'etab-1',
    nom: 'Clinique Demo',
  }

  const initialDomainValue = 'Example.COM'

  const cleanedDataWithoutOptional = {
    nom: 'Clinique Demo',
    type: 'CH',
    ville: 'Paris',
    region: 'IDF',
    date_prise_contact: '2024-01-01',
    statut: 'Prospect',
    modules_proposes: [],
  }

  const mockEtablissementForm = vi.fn((props) => {
    return (
      <form
        onSubmit={props.form.handleSubmit(() => props.onSubmit(cleanedDataWithoutOptional))}
        data-testid="etablissement-form"
      >
        <button type="submit">submit-inner</button>
        <button type="button" onClick={props.onCancel}>
          cancel-inner
        </button>
        <span data-testid="submit-label">{props.submitLabel}</span>
        <span data-testid="is-loading">{props.isLoading ? 'loading' : 'idle'}</span>
        <span data-testid="profiles-count">
          {Array.isArray(props.allProfiles) ? props.allProfiles.length : 0}
        </span>
      </form>
    )
  })

  return {
    mockMutateAsyncSuccess,
    mockMutateAsyncError,
    mockUseCreateEtablissement,
    mockUseProfilesWithRoles,
    mockInsert,
    mockInvalidateQueries,
    mockDebugError,
    mockEtablissementForm,
    defaultProfilesData,
    createdEtablissement,
    initialDomainValue,
    cleanedDataWithoutOptional,
  }
})

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    insert: (...args: unknown[]) => {
      mockInsert(...args)
      return Promise.resolve({ data: null, error: null })
    },
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }
  return {
    supabase: {
      from: () => builder,
    },
  }
})

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useCreateEtablissement: () => mockUseCreateEtablissement(),
}))

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useProfilesWithRoles: () => mockUseProfilesWithRoles(),
}))

vi.mock('@/components/etablissement/EtablissementForm', () => ({
  EtablissementForm: (props: unknown) => mockEtablissementForm(props),
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: (...args: unknown[]) => mockDebugError(...args),
  },
}))

vi.mock('@/lib/utils/objectHelpers', () => ({
  removeUndefinedFields: (obj: unknown) => obj,
}))

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => (values: unknown) => ({ values, errors: {} }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('EtablissementCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le dialogue avec wording établissement et état de chargement', async () => {
    mockUseProfilesWithRoles.mockReturnValue({ data: defaultProfilesData, isLoading: false })
    mockUseCreateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsyncSuccess,
      isPending: true,
    })

    const { EtablissementCreateForm } = await import('./EtablissementCreateForm')

    render(
      <Wrapper>
        <EtablissementCreateForm open={true} onOpenChange={vi.fn()} />
      </Wrapper>
    )

    expect(screen.getByText('Créer un nouvel établissement')).toBeInTheDocument()
    expect(
      screen.getByText('Ajoutez un nouvel établissement à votre portefeuille')
    ).toBeInTheDocument()
    expect(screen.getByTestId('submit-label').textContent).toBe("Créer l'établissement")
    expect(screen.getByTestId('is-loading').textContent).toBe('loading')
    expect(screen.getByTestId('profiles-count').textContent).toBe(
      String(defaultProfilesData.length)
    )
  })

  it('affiche le wording prospect quand context=prospect', async () => {
    mockUseProfilesWithRoles.mockReturnValue({ data: defaultProfilesData, isLoading: false })
    mockUseCreateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsyncSuccess,
      isPending: false,
    })

    const { EtablissementCreateForm } = await import('./EtablissementCreateForm')

    render(
      <Wrapper>
        <EtablissementCreateForm open={true} onOpenChange={vi.fn()} context="prospect" />
      </Wrapper>
    )

    expect(screen.getByText('Créer un nouveau prospect')).toBeInTheDocument()
    expect(
      screen.getByText('Ajoutez un nouveau prospect à votre pipeline commercial')
    ).toBeInTheDocument()
    expect(screen.getByTestId('submit-label').textContent).toBe('Créer le prospect')
  })

  it('soumet les données nettoyées, crée le mapping de domaine et invalide les caches', async () => {
    mockUseProfilesWithRoles.mockReturnValue({ data: defaultProfilesData, isLoading: false })
    mockMutateAsyncSuccess.mockResolvedValue(createdEtablissement)
    mockUseCreateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsyncSuccess,
      isPending: false,
    })
    const onOpenChange = vi.fn()

    const { EtablissementCreateForm } = await import('./EtablissementCreateForm')

    render(
      <Wrapper>
        <EtablissementCreateForm
          open={true}
          onOpenChange={onOpenChange}
          initialDomain={initialDomainValue}
        />
      </Wrapper>
    )

    await act(async () => {
      fireEvent.submit(screen.getByTestId('etablissement-form'))
    })

    expect(mockMutateAsyncSuccess).toHaveBeenCalledTimes(1)
    const submittedArg = mockMutateAsyncSuccess.mock.calls[0][0]
    expect(submittedArg.nom).toBe(cleanedDataWithoutOptional.nom)
    expect(submittedArg.type).toBe(cleanedDataWithoutOptional.type)
    expect(submittedArg.statut).toBe('Prospect')
    expect(submittedArg.modules_proposes).toEqual([])

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.etablissement_id).toBe(createdEtablissement.id)
    expect(insertArg.domain).toBe(initialDomainValue.toLowerCase().trim())
    expect(insertArg.niveau_mapping).toBe('etablissement')
    expect(insertArg.confidence_level).toBe('high')
    expect(insertArg.verified).toBe(true)
    expect(insertArg.is_excluded).toBe(false)

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['unclassified-domains'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-domain-mappings'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['email-threads'] })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ne crée pas le mapping si aucun domaine initial, mais ferme et reset sans erreur', async () => {
    mockUseProfilesWithRoles.mockReturnValue({ data: defaultProfilesData, isLoading: false })
    mockMutateAsyncSuccess.mockResolvedValue(createdEtablissement)
    mockUseCreateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsyncSuccess,
      isPending: false,
    })
    const onOpenChange = vi.fn()

    const { EtablissementCreateForm } = await import('./EtablissementCreateForm')

    render(
      <Wrapper>
        <EtablissementCreateForm open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    )

    await act(async () => {
      fireEvent.submit(screen.getByTestId('etablissement-form'))
    })

    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('gère les erreurs de création et loggue via debug.error', async () => {
    const error = new Error('create-failed')
    mockUseProfilesWithRoles.mockReturnValue({ data: defaultProfilesData, isLoading: false })
    mockMutateAsyncError.mockRejectedValue(error)
    mockUseCreateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsyncError,
      isPending: false,
    })
    const onOpenChange = vi.fn()

    const { EtablissementCreateForm } = await import('./EtablissementCreateForm')

    render(
      <Wrapper>
        <EtablissementCreateForm
          open={true}
          onOpenChange={onOpenChange}
          initialDomain={initialDomainValue}
        />
      </Wrapper>
    )

    await act(async () => {
      fireEvent.submit(screen.getByTestId('etablissement-form'))
    })

    expect(mockDebugError).toHaveBeenCalledTimes(1)
    expect(mockDebugError.mock.calls[0][0]).toBe('Error creating etablissement:')
    expect(mockDebugError.mock.calls[0][1]).toBe(error)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('annule correctement et ferme le dialogue sans appeler la mutation', async () => {
    mockUseProfilesWithRoles.mockReturnValue({ data: defaultProfilesData, isLoading: false })
    mockUseCreateEtablissement.mockReturnValue({
      mutateAsync: mockMutateAsyncSuccess,
      isPending: false,
    })
    const onOpenChange = vi.fn()

    const { EtablissementCreateForm } = await import('./EtablissementCreateForm')

    render(
      <Wrapper>
        <EtablissementCreateForm open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    )

    await act(async () => {
      fireEvent.click(screen.getByText('cancel-inner'))
    })

    expect(mockMutateAsyncSuccess).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})