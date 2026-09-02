import React from 'react'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

// HOISTED MOCK DATA AND HELPERS (stable references)
const hoisted = vi.hoisted(() => {
  const DOCUMENTS = [
    {
      id: 'doc-1',
      document_type: 'cv',
      nom_fichier: 'cv-file.pdf',
      chemin_fichier: '/files/cv-file.pdf',
      document_label: null,
    },
    {
      id: 'doc-2',
      document_type: 'autre',
      nom_fichier: 'attestation.pdf',
      chemin_fichier: '/files/attestation.pdf',
      document_label: 'Attestation de formation',
    },
  ]

  let mode: 'success' | 'loading' | 'error' = 'success'

  const mockUploadMutateAsync = vi.fn().mockResolvedValue({ ok: true })
  const mockDeleteMutateAsync = vi.fn().mockResolvedValue({ ok: true })
  const mockDownloadFn = vi.fn()

  function useRHOnboardingDocuments(_profileId: string) {
    if (mode === 'loading') return { data: undefined, isLoading: true, isError: false, error: null }
    if (mode === 'error') return { data: null, isLoading: false, isError: true, error: { message: 'erreur docs' } }
    return { data: DOCUMENTS.slice(), isLoading: false, isError: false, error: null }
  }

  function useUploadRHOnboardingDocument() {
    return { mutateAsync: mockUploadMutateAsync }
  }

  function useDeleteRHOnboardingDocument() {
    return { mutateAsync: mockDeleteMutateAsync }
  }

  function downloadRHOnboardingDocument(chemin: string, nom: string) {
    mockDownloadFn(chemin, nom)
  }

  function setMode(m: 'success' | 'loading' | 'error') {
    mode = m
  }

  return {
    DOCUMENTS,
    mockUploadMutateAsync,
    mockDeleteMutateAsync,
    mockDownloadFn,
    useRHOnboardingDocuments,
    useUploadRHOnboardingDocument,
    useDeleteRHOnboardingDocument,
    downloadRHOnboardingDocument,
    setMode,
  }
})

// Mock the HR hooks module
vi.mock('@/hooks/hr/useRHOnboardingDocuments', () => {
  return {
    useRHOnboardingDocuments: (profileId: string) => hoisted.useRHOnboardingDocuments(profileId),
    useUploadRHOnboardingDocument: () => hoisted.useUploadRHOnboardingDocument(),
    useDeleteRHOnboardingDocument: () => hoisted.useDeleteRHOnboardingDocument(),
    downloadRHOnboardingDocument: (chemin: string, nom: string) =>
      hoisted.downloadRHOnboardingDocument(chemin, nom),
  }
})

// Mock UI components used by the component under test
vi.mock('@/components/ui/card', () => {
  return {
    Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
    CardContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="card-content">{children}</div>
    ),
    CardHeader: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="card-header">{children}</div>
    ),
    CardTitle: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="card-title">{children}</div>
    ),
  }
})

vi.mock('@/components/ui/checkbox', () => {
  return {
    Checkbox: ({ id, checked, onCheckedChange }: any) => {
      return (
        <input
          data-testid={`checkbox-${id}`}
          id={id}
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
      )
    },
  }
})

vi.mock('@/components/ui/input', () => {
  return {
    Input: ({ id, value, onChange, placeholder, className }: any) => (
      <input
        id={id}
        value={value ?? ''}
        placeholder={placeholder}
        className={className}
        onChange={onChange}
        data-testid={`input-${id}`}
      />
    ),
  }
})

vi.mock('@/components/ui/label', () => {
  return {
    Label: ({ htmlFor, children, className }: any) => (
      <label htmlFor={htmlFor} className={className}>
        {children}
      </label>
    ),
  }
})

vi.mock('@/components/ui/button', () => {
  return {
    Button: ({ children, onClick, disabled, size, variant, className }: any) => (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-variant={variant}
        data-size={size}
        className={className}
      >
        {children}
      </button>
    ),
  }
})

vi.mock('@/components/ui/textarea', () => {
  return {
    Textarea: ({ id, value, onChange, placeholder, rows }: any) => (
      <textarea
        id={id}
        value={value ?? ''}
        placeholder={placeholder}
        rows={rows}
        onChange={onChange}
        data-testid={`textarea-${id}`}
      />
    ),
  }
})

// Mock icons to simple spans
vi.mock('lucide-react', () => {
  return {
    FileText: () => <span>icon-file</span>,
    Calendar: () => <span>icon-calendar</span>,
    Upload: () => <span>icon-upload</span>,
    Download: () => <span>icon-download</span>,
    Trash2: () => <span>icon-trash</span>,
    Plus: () => <span>icon-plus</span>,
    X: () => <span>icon-x</span>,
  }
})

// Mock sonner toast
const hoistedToast = vi.hoisted(() => {
  const error = vi.fn()
  const success = vi.fn()
  return { toast: { error, success }, error, success }
})
vi.mock('sonner', () => ({ toast: hoistedToast.toast }))

// Mock supabase client per rules (builder chain, thenable)
vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: function () {
      return this
    },
    eq: function () {
      return this
    },
    gte: function () {
      return this
    },
    lte: function () {
      return this
    },
    order: function () {
      return this
    },
    in: function () {
      return this
    },
    limit: function () {
      return this
    },
    insert: function () {
      return this
    },
    update: function () {
      return this
    },
    delete: function () {
      return this
    },
    single: function () {
      return Promise.resolve({ data: null, error: null })
    },
    maybeSingle: function () {
      return Promise.resolve({ data: null, error: null })
    },
    then: function (onFulfilled: any) {
      return Promise.resolve({ data: null, error: null }).then(onFulfilled)
    },
    catch: function (cb: any) {
      return Promise.resolve({ data: null, error: null }).catch(cb)
    },
  }
  const mockFrom = vi.fn(() => builder)
  return { supabase: { from: mockFrom } }
})

// Helper: QueryClient wrapper per rules
function createQueryWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

// Import the component under test after mocks
import { DossierRHChecklist } from './DossierRHChecklist'
import { useRHOnboardingDocuments as useRHOnboardingDocumentsHook } from '@/hooks/hr/useRHOnboardingDocuments'

describe('DossierRHChecklist', () => {
  const profileId = 'profile-1'

  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.setMode('success')
  })

  it('toggling a checkbox updates dossier and calls onUpdate with date set', async () => {
    const initialDossier = {
      cv: { status: false as boolean, date: null as string | null },
      contrat: { status: false as boolean, date: null as string | null },
      mutuelle: { status: false as boolean, date: null as string | null },
      charte: { status: false as boolean, date: null as string | null },
      solde_tout_compte: { status: false as boolean, date: null as string | null },
      autre: [] as Array<any>,
    }

    const onUpdate = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })}>
        <DossierRHChecklist dossier={initialDossier} onUpdate={onUpdate} profileId={profileId} />
      </QueryClientProvider>
    )

    const checkbox = screen.getByTestId('checkbox-cv') as HTMLInputElement
    expect(checkbox).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(checkbox)
    })

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const updated = onUpdate.mock.calls[0][0]
    expect(updated).toHaveProperty('cv')
    expect(updated.cv).toHaveProperty('status', true)
    const today = new Date().toISOString().split('T')[0]
    expect(updated.cv).toHaveProperty('date', today)
  })

  it('shows documents for a type and handles download and delete actions', async () => {
    const dossierWithCv = {
      cv: { status: true as boolean, date: new Date().toISOString().split('T')[0] },
      contrat: { status: false, date: null },
      mutuelle: { status: false, date: null },
      charte: { status: false, date: null },
      solde_tout_compte: { status: false, date: null },
      autre: [] as Array<any>,
    }

    const onUpdate = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })}>
        <DossierRHChecklist dossier={dossierWithCv} onUpdate={onUpdate} profileId={profileId} />
      </QueryClientProvider>
    )

    const fileSpan = await screen.findByText('cv-file.pdf')
    expect(fileSpan).toBeInTheDocument()

    const fileContainer = fileSpan.parentElement
    expect(fileContainer).toBeTruthy()
    const buttons = fileContainer!.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)

    await act(async () => {
      fireEvent.click(buttons[0])
    })
    expect(hoisted.mockDownloadFn).toHaveBeenCalledWith('/files/cv-file.pdf', 'cv-file.pdf')

    await act(async () => {
      fireEvent.click(buttons[1])
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(hoisted.mockDeleteMutateAsync).toHaveBeenCalledWith({
      id: 'doc-1',
      cheminFichier: '/files/cv-file.pdf',
      profileId,
    })

    confirmSpy.mockRestore()
  })

  it('adding "autre" document validates input and calls onUpdate; shows toast on empty label', async () => {
    const initialDossier = {
      cv: { status: false, date: null },
      contrat: { status: false, date: null },
      mutuelle: { status: false, date: null },
      charte: { status: false, date: null },
      solde_tout_compte: { status: false, date: null },
      autre: [] as Array<any>,
    }

    const onUpdate = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } })}>
        <DossierRHChecklist dossier={initialDossier} onUpdate={onUpdate} profileId={profileId} />
      </QueryClientProvider>
    )

    const sectionLabel = screen.getByText('Autres documents')
    expect(sectionLabel).toBeInTheDocument()
    const section = sectionLabel.parentElement!
    const addButton = within(section).getByRole('button', { name: /Ajouter/i })
    await act(async () => {
      fireEvent.click(addButton)
    })

    const addInForm = screen.getAllByRole('button', { name: /Ajouter/i })
    const labelInput = screen.getByTestId('input-autre-label') as HTMLInputElement
    const textarea = screen.getByTestId('textarea-autre-description') as HTMLTextAreaElement

    const formAddButton = addInForm.find((b) => b.closest('[data-testid="card"]') && b.textContent === 'Ajouter') || addInForm[0]
    await act(async () => {
      fireEvent.click(formAddButton)
    })

    expect(hoistedToast.toast.error).toHaveBeenCalledWith('Veuillez saisir un titre pour le document')

    await act(async () => {
      fireEvent.change(labelInput, { target: { value: 'Attestation de formation' } })
      fireEvent.change(textarea, { target: { value: 'Certificat délivré le 01/01/2020' } })
    })

    await act(async () => {
      fireEvent.click(formAddButton)
    })

    expect(onUpdate).toHaveBeenCalled()
    const updated = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    expect(Array.isArray(updated.autre)).toBe(true)
    expect(updated.autre.length).toBeGreaterThanOrEqual(1)
    expect(updated.autre[updated.autre.length - 1]).toMatchObject({
      label: 'Attestation de formation',
      description: 'Certificat délivré le 01/01/2020',
    })
  })

  it('renderHook usage: can observe loading and error states from useRHOnboardingDocuments', async () => {
    hoisted.setMode('loading')
    const wrapper = createQueryWrapper()
    const { result, rerender } = renderHook(() => useRHOnboardingDocumentsHook(profileId), {
      wrapper,
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()

    hoisted.setMode('error')
    await act(async () => {
      rerender()
    })
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: 'erreur docs' })

    hoisted.setMode('success')
    await act(async () => {
      rerender()
    })
    expect(result.current.isLoading).toBe(false)
    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data.length).toBeGreaterThan(0)
  })
})