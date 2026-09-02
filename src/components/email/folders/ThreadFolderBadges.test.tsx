import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { ThreadFolderBadges } from './ThreadFolderBadges'

const {
  THREAD_FOLDER_IDS,
  EMAIL_FOLDERS,
  SUCCESS_THREAD_RESULT,
  LOADING_THREAD_RESULT,
  ERROR_THREAD_RESULT,
  UNKNOWN_THREAD_RESULT,
  EMPTY_THREAD_RESULT,
  EMAIL_FOLDERS_RESULT,
  EMPTY_FOLDER_COLORS,
  EMPTY_FOLDER_ICONS,
  mockUseThreadFolders,
  mockUseFolderThreads,
  mockUseThreadFolderMutations,
  mockUseEmailFolders,
  mockGetFolderColorClass,
  mockGetFolderIconComponent,
} = vi.hoisted(() => {
  const threadFolderIds = ['folder-work', 'folder-personal', 'folder-travel']
  const emptyThreadFolderIds: string[] = []
  const unknownThreadFolderIds = ['folder-missing']

  const folders = [
    {
      id: 'folder-work',
      name: 'Work',
      color: 'blue',
      icon: 'briefcase',
    },
    {
      id: 'folder-personal',
      name: 'Personal',
      color: 'green',
      icon: 'user',
    },
    {
      id: 'folder-travel',
      name: 'Travel',
      color: 'orange',
      icon: 'plane',
    },
    {
      id: 'folder-archive',
      name: 'Archive',
      color: 'gray',
      icon: 'archive',
    },
  ]

  const successThreadResult = {
    data: threadFolderIds,
    isLoading: false,
    isError: false,
    error: null,
  }

  const loadingThreadResult = {
    data: emptyThreadFolderIds,
    isLoading: true,
    isError: false,
    error: null,
  }

  const errorThreadResult = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  }

  const unknownThreadResult = {
    data: unknownThreadFolderIds,
    isLoading: false,
    isError: false,
    error: null,
  }

  const emptyThreadResult = {
    data: emptyThreadFolderIds,
    isLoading: false,
    isError: false,
    error: null,
  }

  const emailFoldersResult = {
    folders,
    isLoading: false,
    isError: false,
    error: null,
  }

  function MockFolderIcon({ className }: { className?: string }) {
    return <svg data-testid="folder-icon" className={className} />
  }

  return {
    THREAD_FOLDER_IDS: threadFolderIds,
    EMAIL_FOLDERS: folders,
    SUCCESS_THREAD_RESULT: successThreadResult,
    LOADING_THREAD_RESULT: loadingThreadResult,
    ERROR_THREAD_RESULT: errorThreadResult,
    UNKNOWN_THREAD_RESULT: unknownThreadResult,
    EMPTY_THREAD_RESULT: emptyThreadResult,
    EMAIL_FOLDERS_RESULT: emailFoldersResult,
    EMPTY_FOLDER_COLORS: [],
    EMPTY_FOLDER_ICONS: [],
    mockUseThreadFolders: vi.fn(),
    mockUseFolderThreads: vi.fn(),
    mockUseThreadFolderMutations: vi.fn(),
    mockUseEmailFolders: vi.fn(),
    mockGetFolderColorClass: vi.fn((color: string) => `folder-color-${color}`),
    mockGetFolderIconComponent: vi.fn(() => MockFolderIcon),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
}))

vi.mock('./EmailFolderDialog', () => ({
  FOLDER_COLORS: EMPTY_FOLDER_COLORS,
  FOLDER_ICONS: EMPTY_FOLDER_ICONS,
  getFolderColorClass: mockGetFolderColorClass,
  getFolderIconComponent: mockGetFolderIconComponent,
  EmailFolderDialog: () => null,
}))

vi.mock('@/hooks/email/useThreadFolders', () => ({
  useThreadFolders: mockUseThreadFolders,
  useFolderThreads: mockUseFolderThreads,
  useThreadFolderMutations: mockUseThreadFolderMutations,
}))

vi.mock('@/hooks/email/useEmailFolders', () => ({
  useEmailFolders: mockUseEmailFolders,
}))

class TestErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    return undefined
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">component-error</div>
    }

    return this.props.children
  }
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ThreadFolderBadges', () => {
  beforeEach(() => {
    mockUseThreadFolders.mockReset()
    mockUseEmailFolders.mockReset()
    mockUseFolderThreads.mockReset()
    mockUseThreadFolderMutations.mockReset()
    mockGetFolderColorClass.mockClear()
    mockGetFolderIconComponent.mockClear()

    mockUseThreadFolders.mockReturnValue(SUCCESS_THREAD_RESULT)
    mockUseEmailFolders.mockReturnValue(EMAIL_FOLDERS_RESULT)
  })

  it('rend les dossiers liés au fil, applique les couleurs et affiche le compteur restant', () => {
    const { container } = renderWithProviders(
      <ThreadFolderBadges threadId="thread-1" className="extra-badges-class" />
    )

    const rootClassName = container.firstElementChild?.getAttribute('class') ?? ''

    expect(mockUseThreadFolders).toHaveBeenCalledWith('thread-1')
    expect(mockUseEmailFolders).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Work').textContent).toBe('Work')
    expect(screen.getByText('Personal').textContent).toBe('Personal')
    expect(screen.queryByText('Travel')).toBeNull()
    expect(screen.getByText('+1').textContent).toBe('+1')

    expect(screen.getByTitle('Work').getAttribute('class') ?? '').toContain('folder-color-blue')
    expect(screen.getByTitle('Personal').getAttribute('class') ?? '').toContain(
      'folder-color-green'
    )
    expect(rootClassName).toContain('inline-flex items-center gap-1')
    expect(rootClassName).toContain('extra-badges-class')

    expect(mockGetFolderIconComponent).toHaveBeenCalledWith('briefcase')
    expect(mockGetFolderIconComponent).toHaveBeenCalledWith('user')
    expect(screen.getAllByTestId('folder-icon')).toHaveLength(2)
    expect(THREAD_FOLDER_IDS).toHaveLength(3)
    expect(EMAIL_FOLDERS).toHaveLength(4)
  })

  it('respecte la prop max pour afficher davantage de badges sans compteur inutile', () => {
    renderWithProviders(<ThreadFolderBadges threadId="thread-2" max={3} />)

    expect(mockUseThreadFolders).toHaveBeenCalledWith('thread-2')
    expect(screen.getByText('Work').textContent).toBe('Work')
    expect(screen.getByText('Personal').textContent).toBe('Personal')
    expect(screen.getByText('Travel').textContent).toBe('Travel')
    expect(screen.queryByText('+1')).toBeNull()

    expect(mockGetFolderColorClass).toHaveBeenCalledWith('blue')
    expect(mockGetFolderColorClass).toHaveBeenCalledWith('green')
    expect(mockGetFolderColorClass).toHaveBeenCalledWith('orange')
    expect(screen.getAllByTestId('folder-icon')).toHaveLength(3)
  })

  it('ne rend rien pendant le chargement des dossiers du fil', () => {
    mockUseThreadFolders.mockReturnValue(LOADING_THREAD_RESULT)

    const { container } = renderWithProviders(<ThreadFolderBadges threadId="thread-loading" />)

    expect(mockUseThreadFolders).toHaveBeenCalledWith('thread-loading')
    expect(LOADING_THREAD_RESULT.isLoading).toBe(true)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Work')).toBeNull()
    expect(mockGetFolderIconComponent).not.toHaveBeenCalled()
  })

  it('couvre le retour erreur du hook avec data null et isError true', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockUseThreadFolders.mockReturnValue(ERROR_THREAD_RESULT)

    try {
      renderWithProviders(
        <TestErrorBoundary>
          <ThreadFolderBadges threadId="thread-error" />
        </TestErrorBoundary>
      )

      expect(mockUseThreadFolders).toHaveBeenCalledWith('thread-error')
      expect(ERROR_THREAD_RESULT.isError).toBe(true)
      expect(ERROR_THREAD_RESULT.error.message).toBe('x')
      expect(screen.getByTestId('error-boundary').textContent).toBe('component-error')
      expect(screen.queryByText('Work')).toBeNull()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('ne rend rien quand aucun dossier du fil ne correspond aux dossiers disponibles', () => {
    mockUseThreadFolders.mockReturnValue(UNKNOWN_THREAD_RESULT)

    const { container } = renderWithProviders(<ThreadFolderBadges threadId="thread-unknown" />)

    expect(mockUseThreadFolders).toHaveBeenCalledWith('thread-unknown')
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Work')).toBeNull()
    expect(mockGetFolderColorClass).not.toHaveBeenCalled()
    expect(mockGetFolderIconComponent).not.toHaveBeenCalled()
  })

  it('ne rend rien quand le fil ne possède aucun dossier', () => {
    mockUseThreadFolders.mockReturnValue(EMPTY_THREAD_RESULT)

    const { container } = renderWithProviders(<ThreadFolderBadges threadId="thread-empty" />)

    expect(mockUseThreadFolders).toHaveBeenCalledWith('thread-empty')
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Work')).toBeNull()
    expect(mockGetFolderColorClass).not.toHaveBeenCalled()
    expect(mockGetFolderIconComponent).not.toHaveBeenCalled()
  })
})
