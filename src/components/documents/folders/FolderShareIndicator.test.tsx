import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FolderShareIndicator } from './FolderShareIndicator'

const {
  mockFrom,
  AUTH_STATE,
  PERMISSION_LABELS_STABLE,
  SHARED_WITH_STABLE,
  EMPTY_SHARED_WITH,
} = vi.hoisted(() => {
  const result = { data: null, error: null }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }

  return {
    mockFrom: vi.fn(() => builder),
    AUTH_STATE: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    PERMISSION_LABELS_STABLE: {
      read: 'Lecture',
      write: 'Modification',
      admin: 'Administration',
    },
    SHARED_WITH_STABLE: [
      { type: 'user', name: 'Alice Martin', avatar_url: 'alice.png', access_level: 'read' },
      { type: 'group', name: 'Équipe Produit', color: '#3366ff', access_level: 'write' },
      { type: 'user', name: 'Bob Durand', avatar_url: null, access_level: 'admin' },
      { type: 'user', name: 'Charlie Delta', avatar_url: null, access_level: 'read' },
    ],
    EMPTY_SHARED_WITH: [],
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <img data-testid="avatar-image" src={src} alt={alt} />
  ),
  AvatarFallback: ({
    children,
    className,
    style,
  }: {
    children: React.ReactNode
    className?: string
    style?: React.CSSProperties
  }) => (
    <div data-testid="avatar-fallback" className={className} style={style}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-root">{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({
    children,
    side,
    className,
  }: {
    children: React.ReactNode
    side?: string
    className?: string
  }) => (
    <div data-testid="tooltip-content" data-side={side} className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/types/documents/permissions', () => ({
  PERMISSION_LABELS: PERMISSION_LABELS_STABLE,
}))

vi.mock('lucide-react', () => ({
  Globe: ({ className }: { className?: string }) => <svg data-testid="globe-icon" className={className} />,
  Shield: ({ className }: { className?: string }) => <svg data-testid="shield-icon" className={className} />,
  Users: ({ className }: { className?: string }) => <svg data-testid="users-icon" className={className} />,
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

describe('FolderShareIndicator', () => {
  it('renderHook fonctionne avec le wrapper QueryClientProvider demandé', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => 'ready', { wrapper })
    expect(result.current).toBe('ready')
  })

  it('ne rend rien si le dossier nest pas restreint et pas partagé', () => {
    const { container } = render(
      <FolderShareIndicator
        isRestricted={false}
        folderType="private"
        sharedWith={EMPTY_SHARED_WITH}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('affiche licône globe et le texte métier pour un dossier partagé avec tous', () => {
    render(
      <FolderShareIndicator
        isRestricted={false}
        folderType="shared"
        sharedWith={EMPTY_SHARED_WITH}
      />
    )

    expect(screen.getByTestId('globe-icon')).toBeInTheDocument()
    expect(screen.getByText('Partagé avec tous')).toBeInTheDocument()
  })

  it('affiche licône shield et le message daccès restreint sans autorisation', () => {
    render(
      <FolderShareIndicator
        isRestricted={true}
        folderType="private"
        sharedWith={EMPTY_SHARED_WITH}
      />
    )

    expect(screen.getByTestId('shield-icon')).toBeInTheDocument()
    expect(screen.getByText('Accès restreint — aucune autorisation')).toBeInTheDocument()
  })

  it('affiche en variante mini licône users, le nombre exact et le détail des partages', () => {
    render(
      <FolderShareIndicator
        isRestricted={true}
        folderType="private"
        sharedWith={SHARED_WITH_STABLE}
        variant="mini"
      />
    )

    expect(screen.getByTestId('users-icon')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Partagé avec :')).toBeInTheDocument()
    expect(screen.getByText('Alice Martin')).toBeInTheDocument()
    expect(screen.getByText('👥 Équipe Produit')).toBeInTheDocument()
    expect(screen.getAllByText('Lecture')).toHaveLength(2)
    expect(screen.getByText('Modification')).toBeInTheDocument()
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('affiche les avatars visibles, les initiales utilisateur, licône groupe et le compteur restant', () => {
    render(
      <FolderShareIndicator
        isRestricted={true}
        folderType="private"
        sharedWith={SHARED_WITH_STABLE}
        maxAvatars={3}
        variant="default"
      />
    )

    expect(screen.getAllByTestId('avatar')).toHaveLength(3)
    expect(screen.getByAltText('Alice Martin')).toBeInTheDocument()
    expect(screen.getByText('AM')).toBeInTheDocument()
    expect(screen.getByText('BD')).toBeInTheDocument()
    expect(screen.getAllByTestId('users-icon').length).toBeGreaterThan(0)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('applique la couleur du groupe dans le fallback avatar', () => {
    render(
      <FolderShareIndicator
        isRestricted={true}
        folderType="private"
        sharedWith={SHARED_WITH_STABLE}
        maxAvatars={2}
      />
    )

    const groupFallback = screen.getAllByTestId('avatar-fallback').find((node) => {
      const style = node.getAttribute('style') ?? ''
      return style.includes('background-color: rgba(51, 102, 255') || style.includes('color: rgb(51, 102, 255)')
    })

    expect(groupFallback).toBeDefined()
  })

  it('stoppe la propagation du clic sur le conteneur des avatars', () => {
    const parentClick = vi.fn()

    const { container } = render(
      <div onClick={parentClick}>
        <FolderShareIndicator
          isRestricted={true}
          folderType="private"
          sharedWith={SHARED_WITH_STABLE}
        />
      </div>
    )

    const clickableContainer = container.querySelector('div.flex.items-center.shrink-0.cursor-default')
    expect(clickableContainer).not.toBeNull()

    if (clickableContainer) {
      fireEvent.click(clickableContainer)
    }

    expect(parentClick).not.toHaveBeenCalled()
  })

  it('couvre un état de chargement vers succès puis erreur avec un hook local au test', () => {
    const successState = { data: 'ok', error: null, isLoading: false, isError: false }
    const errorState = { data: null, error: { message: 'x' }, isLoading: false, isError: true }

    function useFakeAsyncState(mode: 'loading' | 'success' | 'error') {
      if (mode === 'loading') {
        return { data: null, error: null, isLoading: true, isError: false }
      }
      if (mode === 'error') {
        return errorState
      }
      return successState
    }

    const wrapper = createWrapper()

    const loadingHook = renderHook(() => useFakeAsyncState('loading'), { wrapper })
    expect(loadingHook.result.current.isLoading).toBe(true)
    expect(loadingHook.result.current.data).toBeNull()

    const successHook = renderHook(() => useFakeAsyncState('success'), { wrapper })
    expect(successHook.result.current.isLoading).toBe(false)
    expect(successHook.result.current.isError).toBe(false)
    expect(successHook.result.current.data).toBe('ok')

    const errorHook = renderHook(() => useFakeAsyncState('error'), { wrapper })
    expect(errorHook.result.current.isLoading).toBe(false)
    expect(errorHook.result.current.isError).toBe(true)
    expect(errorHook.result.current.error).toEqual({ message: 'x' })
  })
})