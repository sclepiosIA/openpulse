// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TutorielLayout } from './TutorielLayout'

const { AUTH_STATE, navigateMock, toastSuccess, toastError, sidebarMock, searchMock, mockFrom } =
  vi.hoisted(() => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn(),
      catch: vi.fn(),
    }

    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.gte.mockReturnValue(builder)
    builder.lte.mockReturnValue(builder)
    builder.in.mockReturnValue(builder)
    builder.order.mockReturnValue(builder)
    builder.limit.mockReturnValue(builder)
    builder.insert.mockReturnValue(builder)
    builder.update.mockReturnValue(builder)
    builder.delete.mockReturnValue(builder)
    builder.upsert.mockReturnValue(builder)
    builder.single.mockResolvedValue({ data: null, error: null })
    builder.maybeSingle.mockResolvedValue({ data: null, error: null })
    builder.then.mockImplementation(
      (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled)
    )
    builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected)
    )

    return {
      AUTH_STATE: {
        user: { id: 'u1', email: 't@t.co' },
        session: { user: { id: 'u1' } },
        isLoading: false,
      },
      navigateMock: vi.fn(),
      toastSuccess: vi.fn(),
      toastError: vi.fn(),
      sidebarMock: vi.fn(),
      searchMock: vi.fn(),
      mockFrom: vi.fn(() => builder),
    }
  })

vi.mock('./TutorielSidebar', () => ({
  TutorielSidebar: (props: { currentModuleId?: string; currentSectionId?: string }) => {
    sidebarMock(props)
    return (
      <div data-testid="tutoriel-sidebar">
        <span data-testid="sidebar-module">{props.currentModuleId ?? 'none'}</span>
        <span data-testid="sidebar-section">{props.currentSectionId ?? 'none'}</span>
      </div>
    )
  },
}))

vi.mock('./TutorielSearch', () => ({
  TutorielSearch: () => {
    searchMock()
    return <div data-testid="tutoriel-search">search</div>
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: AUTH_STATE.session }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: AUTH_STATE.user }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
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

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

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

describe('TutorielLayout', () => {
  // Le sommaire n'est plus une colonne permanente : la page vit deja dans la
  // coque de l'application, qui affiche sa propre barre laterale. Deux menus
  // cote a cote rognaient la lecture. Il s'ouvre desormais en panneau — donc
  // ces epreuves verifient qu'il reste ATTEIGNABLE, et qu'il recoit toujours
  // les memes proprietes.
  const ouvrirLeSommaire = () => fireEvent.click(screen.getByRole('button', { name: /sommaire/i }))

  it('rend le contenu enfant et un acces au sommaire, sans second menu lateral', () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <TutorielLayout currentModuleId="module-1" currentSectionId="section-2">
          <div data-testid="page-content">Contenu tutoriel</div>
        </TutorielLayout>
      </Wrapper>
    )

    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass('flex-1')
    expect(main).toHaveClass('overflow-y-auto')
    expect(screen.getByTestId('page-content')).toHaveTextContent('Contenu tutoriel')

    // Ce qui a motive le changement : plus aucune colonne laterale propre au
    // tutoriel, a cote de celle de l'application.
    expect(document.querySelector('aside')).toBeNull()

    // Tant qu'il n'est pas ouvert, le sommaire n'occupe pas la page.
    expect(screen.queryByTestId('tutoriel-search')).toBeNull()
    expect(screen.queryByTestId('tutoriel-sidebar')).toBeNull()

    ouvrirLeSommaire()

    expect(screen.getByTestId('tutoriel-search')).toHaveTextContent('search')
    expect(screen.getByTestId('tutoriel-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-module')).toHaveTextContent('module-1')
    expect(screen.getByTestId('sidebar-section')).toHaveTextContent('section-2')

    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(sidebarMock).toHaveBeenCalledWith({
      currentModuleId: 'module-1',
      currentSectionId: 'section-2',
    })
  })

  it('transmet undefined a la sidebar quand les identifiants courants sont absents', () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <TutorielLayout>
          <div>Sans ids</div>
        </TutorielLayout>
      </Wrapper>
    )

    ouvrirLeSommaire()

    expect(screen.getByTestId('sidebar-module')).toHaveTextContent('none')
    expect(screen.getByTestId('sidebar-section')).toHaveTextContent('none')
    expect(sidebarMock).toHaveBeenLastCalledWith({
      currentModuleId: undefined,
      currentSectionId: undefined,
    })
  })

  it('donne au panneau un titre et une recherche, en tete de sommaire', () => {
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <TutorielLayout>
          <div>Page</div>
        </TutorielLayout>
      </Wrapper>
    )

    ouvrirLeSommaire()

    const panneau = screen.getByRole('dialog')
    expect(within(panneau).getByText('Sommaire du tutoriel')).toBeInTheDocument()

    // La recherche precede la liste des modules : on cherche avant de parcourir.
    const search = within(panneau).getByTestId('tutoriel-search')
    const sidebar = within(panneau).getByTestId('tutoriel-sidebar')
    expect(search.compareDocumentPosition(sidebar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
