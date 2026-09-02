import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  DOCS,
  AUTH,
  PROFILES,
  UPLOAD_MUT,
  DELETE_MUT,
  mockUseTachesDocuments,
  mockGetDocumentUrl,
  mockToast,
  mockFrom,
} = vi.hoisted(() => {
  const DOCS = [
    {
      id: 'doc1',
      nom_fichier: 'rapport.pdf',
      chemin_fichier: 'taches/t1/rapport.pdf',
      type_mime: 'application/pdf',
      taille_fichier: 2048,
      created_at: '2024-01-15T10:00:00Z',
      document_type: 'Rapport',
      version_number: 2,
      is_latest_version: true,
      auto_detected: false,
      source_type: 'upload',
      detection_confidence: null,
    },
  ]
  const AUTH = { user: { id: 'u1', email: 't@t.co' }, session: { user: { id: 'u1' } }, isLoading: false }
  const PROFILES = [{ id: 'p1', user_id: 'u1', prenom: 'Test', nom: 'User' }]
  const UPLOAD_MUT = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
  const DELETE_MUT = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
  return {
    DOCS,
    AUTH,
    PROFILES,
    UPLOAD_MUT,
    DELETE_MUT,
    mockUseTachesDocuments: vi.fn(),
    mockGetDocumentUrl: vi.fn().mockResolvedValue('https://example.local/doc'),
    mockToast: vi.fn(),
    mockFrom: vi.fn(),
  }
})

vi.mock('@/hooks/tasks/useTachesDocuments', () => ({
  useTachesDocuments: mockUseTachesDocuments,
  useUploadTacheDocument: () => UPLOAD_MUT,
  useDeleteTacheDocument: () => DELETE_MUT,
  getDocumentUrl: mockGetDocumentUrl,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: PROFILES, isLoading: false }),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: vi.fn(() => 'erreur'),
}))

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('lucide-react', () => ({
  Upload: () => null,
  FileText: () => null,
  Download: () => null,
  Trash2: () => null,
  Eye: () => null,
  Image: () => null,
  File: () => null,
  Sparkles: () => null,
  Mail: () => null,
}))

vi.mock('@/components/ui/card', async () => {
  const ReactMod = await import('react')
  const make = (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      ReactMod.createElement('div', { 'data-testid': testId }, children)
  return {
    Card: make('card'),
    CardContent: make('card-content'),
    CardHeader: make('card-header'),
    CardTitle: make('card-title'),
  }
})

vi.mock('@/components/ui/button', async () => {
  const ReactMod = await import('react')
  return {
    Button: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
      ReactMod.createElement('button', { onClick: props.onClick as (() => void) | undefined, disabled: props.disabled as boolean | undefined }, children),
  }
})

vi.mock('@/components/ui/badge', async () => {
  const ReactMod = await import('react')
  return {
    Badge: ({ children }: { children?: React.ReactNode }) =>
      ReactMod.createElement('span', { 'data-testid': 'badge' }, children),
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const ReactMod = await import('react')
  const make = ({ children }: { children?: React.ReactNode }) =>
    ReactMod.createElement('div', null, children)
  return {
    Dialog: make,
    DialogContent: () => null,
    DialogHeader: make,
    DialogTitle: make,
    DialogTrigger: make,
  }
})

vi.mock('@/components/ui/input', async () => {
  const ReactMod = await import('react')
  const Input = ReactMod.forwardRef<HTMLInputElement, Record<string, unknown>>((props, ref) =>
    ReactMod.createElement('input', { type: props.type as string | undefined, onChange: props.onChange as (() => void) | undefined, ref, 'data-testid': 'file-input' }),
  )
  Input.displayName = 'Input'
  return { Input }
})

import { TacheDocuments } from './TacheDocuments'

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('TacheDocuments', () => {
  beforeEach(() => {
    mockUseTachesDocuments.mockReset()
    mockToast.mockClear()
    UPLOAD_MUT.mutateAsync.mockClear()
    DELETE_MUT.mutateAsync.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('affiche un message de chargement quand les documents sont en cours de chargement', () => {
    mockUseTachesDocuments.mockReturnValue({ data: undefined, isLoading: true })

    renderWithProviders(
      <TacheDocuments tacheId="t1" tacheTitre="Ma tâche" etablissementId="e1" />,
    )

    expect(screen.getByText('Chargement des documents...')).toBeTruthy()
    expect(screen.queryByTestId('card')).toBeNull()
  })

  it('affiche le titre et la liste des documents groupés par type en cas de succès', () => {
    mockUseTachesDocuments.mockReturnValue({ data: DOCS, isLoading: false })

    renderWithProviders(
      <TacheDocuments tacheId="t1" tacheTitre="Ma tâche" etablissementId="e1" />,
    )

    expect(mockUseTachesDocuments).toHaveBeenCalledWith('t1')
    expect(screen.getByText(/Documents - Ma tâche/)).toBeTruthy()
    expect(screen.getByText('rapport.pdf')).toBeTruthy()
    expect(screen.getByText('Rapport')).toBeTruthy()
    expect(screen.getByText(/1 document/)).toBeTruthy()
    expect(screen.getByText(/2\.0 KB/)).toBeTruthy()
    expect(screen.getByText('v2')).toBeTruthy()
    expect(screen.getByText('Dernière')).toBeTruthy()
  })

  it("affiche l'état vide quand il n'y a aucun document", () => {
    mockUseTachesDocuments.mockReturnValue({ data: [], isLoading: false })

    renderWithProviders(
      <TacheDocuments tacheId="t1" tacheTitre="Ma tâche" />,
    )

    expect(screen.getByText('Aucun document pour cette tâche')).toBeTruthy()
    expect(screen.getByText('Uploadez des fichiers pour commencer')).toBeTruthy()
    expect(screen.queryByText('rapport.pdf')).toBeNull()
  })
})