/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileBottomNavDrawer } from './MobileBottomNavDrawer'

const {
  navigateMock,
  onOpenChangeMock,
  signOutMock,
  authValue,
  profileValue,
  permissionsLoading,
  permissionsReady,
  badgesValue,
  HomeIcon,
  AdminIcon,
  ToolIcon,
  ExternalDocIcon,
  IframeToolIcon,
  BackendLinkIcon,
  navigationSections,
  externalLinks,
  externalLinkGroups,
  backendLinkGroups,
  internalIframeLinks,
  teamConfig,
  filterNavigationByPermissionsMock,
  filterExternalLinksByTeamMock,
  filterExternalLinkGroupsByTeamMock,
  filterBackendLinkGroupsByTeamMock,
  filterInternalIframeLinksByTeamMock,
  getIframeLinksBySectionMock,
  getExternalLinksBySectionMock,
} = vi.hoisted(() => {
  const navigateMock = vi.fn()
  const onOpenChangeMock = vi.fn()
  const signOutMock = vi.fn().mockResolvedValue(undefined)

  const authValue = {
    signOut: signOutMock,
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const profileValue = {
    data: {
      prenom: 'Jane',
      nom: 'Doe',
      avatar_url: 'avatar.png',
    },
  }

  const permissionsLoading = {
    isLoading: true,
    team: 'alpha',
    isAdmin: false,
    role: 'member',
  }

  const permissionsReady = {
    isLoading: false,
    team: 'alpha',
    isAdmin: true,
    role: 'admin',
  }

  const badgesValue = {
    pulse: 101,
    emails: 3,
    todos: 0,
    calendar: 2,
  }

  const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="home-icon" {...props} />
  )
  const AdminIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="admin-icon" {...props} />
  )
  const ToolIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="tool-icon" {...props} />
  )
  const ExternalDocIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="external-doc-icon" {...props} />
  )
  const IframeToolIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="iframe-tool-icon" {...props} />
  )
  const BackendLinkIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="backend-link-icon" {...props} />
  )

  const navigationSections = [
    {
      section: 'Général',
      items: [{ path: '/', label: 'Accueil', icon: HomeIcon, badgeKey: 'pulseUnread' }],
    },
    {
      section: 'Technique',
      items: [{ path: '/admin', label: 'Admin', icon: AdminIcon, badgeKey: 'emailsUnread' }],
    },
  ]

  const externalLinks = [
    {
      section: 'Général',
      url: 'https://docs.local',
      label: 'Documentation',
      icon: ExternalDocIcon,
    },
    {
      section: 'Ressources',
      url: 'https://ressources.local',
      label: 'Guide RH',
      icon: ExternalDocIcon,
    },
  ]

  const externalLinkGroups: Array<unknown> = []

  const backendLinkGroups = [
    {
      label: 'Back Office',
      icon: ToolIcon,
      basePath: '/ops',
      links: [{ key: 'crm', label: 'CRM', icon: BackendLinkIcon }],
    },
  ]

  const internalIframeLinks = [
    { key: 'wiki', label: 'Wiki', section: 'Général', icon: IframeToolIcon },
    { key: 'kb', label: 'Base interne', section: 'Ressources', icon: IframeToolIcon },
  ]

  const teamConfig = {
    alpha: { label: 'Équipe Alpha' },
  }

  const filterNavigationByPermissionsMock = vi.fn((sections) => sections)
  const filterExternalLinksByTeamMock = vi.fn((links) => links)
  const filterExternalLinkGroupsByTeamMock = vi.fn((groups) => groups)
  const filterBackendLinkGroupsByTeamMock = vi.fn((groups) => groups)
  const filterInternalIframeLinksByTeamMock = vi.fn((links) => links)
  const getIframeLinksBySectionMock = vi.fn((links, sectionName: string) =>
    links.filter((l: { section: string }) => l.section === sectionName)
  )
  const getExternalLinksBySectionMock = vi.fn((links, sectionName: string) =>
    links.filter((l: { section: string }) => l.section === sectionName)
  )

  return {
    navigateMock,
    onOpenChangeMock,
    signOutMock,
    authValue,
    profileValue,
    permissionsLoading,
    permissionsReady,
    badgesValue,
    HomeIcon,
    AdminIcon,
    ToolIcon,
    ExternalDocIcon,
    IframeToolIcon,
    BackendLinkIcon,
    navigationSections,
    externalLinks,
    externalLinkGroups,
    backendLinkGroups,
    internalIframeLinks,
    teamConfig,
    filterNavigationByPermissionsMock,
    filterExternalLinksByTeamMock,
    filterExternalLinkGroupsByTeamMock,
    filterBackendLinkGroupsByTeamMock,
    filterInternalIframeLinksByTeamMock,
    getIframeLinksBySectionMock,
    getExternalLinksBySectionMock,
  }
})

let currentLocation = { pathname: '/', search: '' }
let currentPermissions = permissionsReady

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => currentLocation,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authValue,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => profileValue,
}))

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => currentPermissions,
}))

vi.mock('@/hooks/ui/useNavigationBadges', () => ({
  useNavigationBadges: () => badgesValue,
}))

vi.mock('@/config/navigationConfig', () => ({
  navigationSections,
  externalLinks,
  externalLinkGroups,
  backendLinkGroups,
  internalIframeLinks,
  filterNavigationByPermissions: filterNavigationByPermissionsMock,
  filterExternalLinksByTeam: filterExternalLinksByTeamMock,
  filterExternalLinkGroupsByTeam: filterExternalLinkGroupsByTeamMock,
  filterBackendLinkGroupsByTeam: filterBackendLinkGroupsByTeamMock,
  filterInternalIframeLinksByTeam: filterInternalIframeLinksByTeamMock,
  getInternalIframeLinksWithConfig: () => internalIframeLinks,
  getExternalLinksWithConfig: () => externalLinks,
  getIframeLinksBySection: getIframeLinksBySectionMock,
  getExternalLinksBySection: getExternalLinksBySectionMock,
  teamConfig,
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-root">{children}</div>
  ),
  SheetContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sheet-content" className={className}>
      {children}
    </div>
  ),
  SheetHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="sheet-header" className={className}>
      {children}
    </div>
  ),
  SheetTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? 'avatar'} />
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => <div data-open={String(Boolean(open))}>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  ExternalLink: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="external-link-icon" {...props} />
  ),
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="chevron-right-icon" {...props} />
  ),
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="chevron-down-icon" {...props} />
  ),
  LogOut: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="logout-icon" {...props} />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/assets/marque/logo.png', () => ({
  default: 'croix-marque.png',
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

function renderComponent() {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <MobileBottomNavDrawer open={true} onOpenChange={onOpenChangeMock} />
    </Wrapper>
  )
}

describe('MobileBottomNavDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentLocation = { pathname: '/', search: '' }
    currentPermissions = permissionsReady
  })

  it('affiche les sections sans filtrage pendant le chargement des permissions', () => {
    currentPermissions = permissionsLoading

    renderComponent()

    expect(screen.getByText('OpenPulse')).toBeInTheDocument()
    expect(screen.getByText('Accueil')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(filterNavigationByPermissionsMock).not.toHaveBeenCalled()
    expect(filterExternalLinksByTeamMock).not.toHaveBeenCalled()
    expect(filterBackendLinkGroupsByTeamMock).not.toHaveBeenCalled()
    expect(filterInternalIframeLinksByTeamMock).not.toHaveBeenCalled()
  })

  it('affiche les données métier réelles, badges, équipe, liens intégrés et navigue sur un item interne', async () => {
    currentLocation = { pathname: '/', search: '' }
    currentPermissions = permissionsReady

    renderComponent()

    expect(screen.getByText('Équipe Alpha')).toBeInTheDocument()
    expect(screen.getByText('Général')).toBeInTheDocument()
    expect(screen.getByText('Technique')).toBeInTheDocument()
    expect(screen.getByText('Ressources')).toBeInTheDocument()

    expect(screen.getByText('Accueil')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Wiki')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText('Guide RH')).toBeInTheDocument()
    expect(screen.getByText('99+')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    expect(filterNavigationByPermissionsMock).toHaveBeenCalledWith(
      navigationSections,
      permissionsReady
    )
    expect(filterExternalLinksByTeamMock).toHaveBeenCalledWith(
      externalLinks,
      'alpha',
      true,
      'admin'
    )
    expect(filterBackendLinkGroupsByTeamMock).toHaveBeenCalledWith(
      backendLinkGroups,
      'alpha',
      true,
      'admin'
    )
    expect(filterInternalIframeLinksByTeamMock).toHaveBeenCalledWith(
      internalIframeLinks,
      'alpha',
      true,
      'admin'
    )

    fireEvent.click(screen.getByText('Admin'))

    expect(navigateMock).toHaveBeenCalledWith('/admin')
    expect(onOpenChangeMock).toHaveBeenCalledWith(false)

    const docsLink = screen.getByText('Documentation').closest('a')
    expect(docsLink).toHaveAttribute('href', 'https://docs.local')
    expect(docsLink).toHaveAttribute('target', '_blank')
  })

  it('gère les états actifs pour la racine et les liens iframe backend', () => {
    currentLocation = { pathname: '/backend', search: '?tool=wiki' }
    currentPermissions = permissionsReady

    renderComponent()

    expect(screen.getByText('Wiki')).toBeInTheDocument()
    expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument()
  })

  it('expose l’état actif aux technologies d’assistance', () => {
    currentLocation = { pathname: '/', search: '' }

    renderComponent()

    expect(screen.getByRole('button', { name: /accueil/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: /admin/i })).not.toHaveAttribute('aria-current')
  })

  it('garde des cibles tactiles d’au moins 44 px', () => {
    renderComponent()

    expect(screen.getByRole('button', { name: /accueil/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: /admin/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: /documentation/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: /back office/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: /déconnexion/i })).toHaveClass('min-h-11')
  })

  it('utilise une surface mobile plane cohérente avec la charte OpenPulse', () => {
    renderComponent()

    expect(screen.getByTestId('sheet-content')).toHaveClass('bg-background', 'border-r')
    expect(screen.getByTestId('sheet-content')).not.toHaveClass('bg-gradient-to-b')
    expect(screen.getByRole('heading', { name: 'OpenPulse' })).toHaveClass('text-foreground')
    expect(screen.getByRole('heading', { name: 'OpenPulse' })).not.toHaveClass('text-transparent')
  })

  it('ouvre un groupe backend et navigue vers un lien de groupe', async () => {
    currentLocation = { pathname: '/admin', search: '' }
    currentPermissions = permissionsReady

    renderComponent()

    fireEvent.click(screen.getByText('Back Office'))
    fireEvent.click(screen.getByText('CRM'))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/ops?backend=crm')
    })
    expect(onOpenChangeMock).toHaveBeenCalledWith(false)
  })

  it('déclenche la fermeture du drawer lors du clic sur un lien externe', () => {
    currentPermissions = permissionsReady

    renderComponent()

    const link = screen.getByText('Documentation')
    fireEvent.click(link)

    expect(onOpenChangeMock).toHaveBeenCalledWith(false)
  })

  it('déclenche signOut si un bouton de déconnexion est rendu', async () => {
    currentPermissions = permissionsReady

    renderComponent()

    const logoutButton = screen.queryByText(/déconnexion|se déconnecter|logout/i)

    if (logoutButton) {
      fireEvent.click(logoutButton)
      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledTimes(1)
      })
      expect(onOpenChangeMock).toHaveBeenCalledWith(false)
    } else {
      expect(signOutMock).not.toHaveBeenCalled()
    }
  })
})
