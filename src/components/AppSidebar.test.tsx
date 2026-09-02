import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppSidebar } from './AppSidebar'

const {
  AUTH_STATE,
  PROFILE_STATE,
  PERMISSIONS_LOADING,
  PERMISSIONS_READY,
  BADGES,
  NAVIGATION_SECTIONS,
  EXTERNAL_LINKS,
  EXTERNAL_LINK_GROUPS,
  BACKEND_LINK_GROUPS,
  INTERNAL_IFRAME_LINKS,
  TEAM_CONFIG,
  mockPrefetch,
  mockSignOut,
  mockToggleSidebar,
} = vi.hoisted(() => {
  const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="home-icon" {...props} />
  )
  const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="settings-icon" {...props} />
  )
  const IframeIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="iframe-icon" {...props} />
  )
  const ExternalIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="external-icon" {...props} />
  )

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    PROFILE_STATE: {
      data: { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.local' },
      isLoading: false,
      isError: false,
      error: null,
    },
    PERMISSIONS_LOADING: {
      isLoading: true,
      team: 'ops',
      isAdmin: false,
      role: 'member',
    },
    PERMISSIONS_READY: {
      isLoading: false,
      team: 'ops',
      isAdmin: false,
      role: 'member',
    },
    BADGES: {
      pulse: 3,
      emails: 0,
      todos: 12,
      calendar: 1,
    },
    NAVIGATION_SECTIONS: [
      {
        section: 'Principal',
        items: [
          {
            path: '/dashboard',
            label: 'Dashboard',
            icon: HomeIcon,
            badgeKey: 'pulseUnread',
            exactMatch: true,
          },
          { path: '/settings', label: 'Paramètres', icon: SettingsIcon, exactMatch: true },
        ],
      },
      {
        section: 'Pilotage',
        items: [{ path: '/rapports', label: 'Rapports', icon: SettingsIcon, exactMatch: true }],
      },
    ],
    EXTERNAL_LINKS: [
      {
        url: 'https://docs.local',
        label: 'Documentation',
        icon: ExternalIcon,
        section: 'Principal',
      },
      {
        url: 'https://resources.local',
        label: 'Ressource',
        icon: ExternalIcon,
        section: 'Ressources',
      },
    ],
    EXTERNAL_LINK_GROUPS: [
      {
        label: 'Partenaires',
        icon: ExternalIcon,
        links: [
          {
            url: 'https://partenaire.example.test',
            label: 'Portail partenaire',
            icon: ExternalIcon,
          },
        ],
      },
    ],
    BACKEND_LINK_GROUPS: [],
    INTERNAL_IFRAME_LINKS: [
      { key: 'crm', label: 'CRM', icon: IframeIcon, section: 'Principal' },
      { key: 'wiki', label: 'Wiki', icon: IframeIcon, section: 'Ressources' },
    ],
    TEAM_CONFIG: {
      ops: { label: 'Opérations' },
    },
    mockPrefetch: vi.fn(),
    mockSignOut: vi.fn(),
    mockToggleSidebar: vi.fn(),
  }
})

let permissionsState = PERMISSIONS_READY
let profileState = PROFILE_STATE
let sidebarState: 'expanded' | 'collapsed' = 'expanded'

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/hooks/ui/useNavigationPrefetch', () => ({
  useNavigationPrefetch: () => mockPrefetch,
}))

vi.mock('@/components/jarvis/JarvisLogoTrigger', () => ({
  JarvisLogoTrigger: ({ collapsed }: { collapsed: boolean }) => (
    <div data-testid="jarvis-logo">{collapsed ? 'collapsed' : 'expanded'}</div>
  ),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    ...AUTH_STATE,
    signOut: mockSignOut,
  }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => profileState,
}))

vi.mock('@/components/auth/SecurityStatusIndicator', () => ({
  SecurityStatusIndicator: () => <span data-testid="security-indicator">secure</span>,
}))

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => permissionsState,
}))

vi.mock('@/hooks/ui/useNavigationBadges', () => ({
  useNavigationBadges: () => BADGES,
}))

vi.mock('@/config/navigationConfig', () => ({
  navigationSections: NAVIGATION_SECTIONS,
  externalLinks: EXTERNAL_LINKS,
  getExternalLinksWithConfig: () => EXTERNAL_LINKS,
  externalLinkGroups: EXTERNAL_LINK_GROUPS,
  backendLinkGroups: BACKEND_LINK_GROUPS,
  internalIframeLinks: INTERNAL_IFRAME_LINKS,
  getInternalIframeLinksWithConfig: () => INTERNAL_IFRAME_LINKS,
  teamConfig: TEAM_CONFIG,
  filterNavigationByPermissions: (sections: typeof NAVIGATION_SECTIONS) => sections,
  filterExternalLinksByTeam: (links: typeof EXTERNAL_LINKS) => links,
  filterExternalLinkGroupsByTeam: (groups: typeof EXTERNAL_LINK_GROUPS) => groups,
  filterBackendLinkGroupsByTeam: (groups: typeof BACKEND_LINK_GROUPS) => groups,
  filterInternalIframeLinksByTeam: (links: typeof INTERNAL_IFRAME_LINKS) => links,
  getIframeLinksBySection: (links: typeof INTERNAL_IFRAME_LINKS, sectionName: string) =>
    links.filter((link) => link.section === sectionName),
  getExternalLinksBySection: (links: typeof EXTERNAL_LINKS, sectionName: string) =>
    links.filter((link) => link.section === sectionName),
}))

vi.mock('lucide-react', () => ({
  ExternalLink: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="external-link-icon" {...props} />
  ),
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="chevron-right" {...props} />
  ),
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="chevron-down" {...props} />
  ),
  PanelLeftOpen: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="panel-left-open" {...props} />
  ),
  LogOut: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="logout-icon" {...props} />,
}))

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar" {...props}>
      {children}
    </div>
  ),
  SidebarContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar-content" {...props}>
      {children}
    </div>
  ),
  SidebarGroup: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar-group" {...props}>
      {children}
    </div>
  ),
  SidebarGroupContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar-group-content" {...props}>
      {children}
    </div>
  ),
  SidebarGroupLabel: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar-group-label" {...props}>
      {children}
    </div>
  ),
  SidebarMenu: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul data-testid="sidebar-menu" {...props}>
      {children}
    </ul>
  ),
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarMenuItem: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li data-testid="sidebar-menu-item" {...props}>
      {children}
    </li>
  ),
  SidebarHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar-header" {...props}>
      {children}
    </div>
  ),
  SidebarFooter: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sidebar-footer" {...props}>
      {children}
    </div>
  ),
  SidebarTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button data-testid="sidebar-trigger" {...props}>
      {children}
    </button>
  ),
  useSidebar: () => ({
    state: sidebarState,
    toggleSidebar: mockToggleSidebar,
  }),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  AvatarFallback: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
  AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt="" {...props} />,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/sidebar-skeleton', () => ({
  SidebarMenuSkeleton: () => <div data-testid="sidebar-skeleton">loading</div>,
  SidebarMenuSkeletonCollapsed: () => <div data-testid="sidebar-skeleton-collapsed">loading</div>,
}))

function renderSidebar(initialEntries: string[] = ['/dashboard']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppSidebar />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AppSidebar', () => {
  beforeEach(() => {
    permissionsState = PERMISSIONS_READY
    profileState = PROFILE_STATE
    sidebarState = 'expanded'
    mockPrefetch.mockClear()
    mockSignOut.mockClear()
    mockToggleSidebar.mockClear()
  })

  it('affiche les skeletons pendant le chargement des permissions', () => {
    permissionsState = PERMISSIONS_LOADING

    renderSidebar()

    expect(screen.getAllByTestId('sidebar-skeleton')).toHaveLength(8)
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Paramètres')).not.toBeInTheDocument()
  })

  it('affiche les données métier filtrées et les badges dynamiques en succès', () => {
    renderSidebar(['/dashboard'])

    expect(screen.getByText('OpenPulse')).toBeInTheDocument()
    expect(screen.getByText('Opérations')).toBeInTheDocument()

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    expect(dashboardLink).toHaveAttribute('aria-current', 'page')

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Paramètres')).toBeInTheDocument()
    expect(screen.getByTestId('security-indicator')).toBeInTheDocument()

    const crmLink = screen.getByRole('link', { name: /crm/i })
    expect(crmLink).toHaveAttribute('href', '/backend?tool=crm')

    const docsLink = screen.getByRole('link', { name: /documentation/i })
    expect(docsLink).toHaveAttribute('href', 'https://docs.local')
    expect(docsLink).toHaveAttribute('target', '_blank')

    fireEvent.mouseEnter(dashboardLink)
    expect(mockPrefetch).toHaveBeenCalledWith('/dashboard')
  })

  it("garde les groupes d'outils externes dans des éléments de liste directs", () => {
    renderSidebar()

    const externalSection = screen
      .getByText('Outils externes')
      .closest('[data-testid="sidebar-group"]')
    const externalMenu = externalSection?.querySelector('[data-testid="sidebar-menu"]')

    expect(screen.getByRole('link', { name: 'Portail partenaire' })).toBeInTheDocument()
    expect(externalMenu).not.toBeNull()
    expect(Array.from(externalMenu?.children ?? []).map((child) => child.tagName)).toEqual(['LI'])
  })

  it('rend toutes les sections dans une seule colonne, sans rail', () => {
    // POURQUOI CETTE EPREUVE
    // La barre montrait un rail d'icones de section, et ne listait les pages que
    // d'UNE section a la fois. Il fallait deviner qu'un clic sur une icone changeait
    // la liste. Toutes les sections sont desormais rendues ensemble, et on navigue
    // par des liens, comme dans Gestion.
    renderSidebar(['/dashboard'])

    expect(screen.queryByTestId('navigation-rail')).not.toBeInTheDocument()
    expect(screen.queryByTestId('contextual-navigation')).not.toBeInTheDocument()

    expect(screen.getByText('Principal')).toBeInTheDocument()
    expect(screen.getByText('Pilotage')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /rapports/i })).toBeInTheDocument()

    expect(screen.queryAllByRole('button', { name: /^Afficher la section/ })).toHaveLength(0)
  })

  it('reste utilisable en replie : les liens de toutes les sections sont rendus', () => {
    sidebarState = 'collapsed'

    const { container } = renderSidebar(['/dashboard'])

    // Replie, l'intitule est masque : on verifie donc les CIBLES, pas les libelles.
    // Ce qui compte est qu'aucune section ne disparaisse — c'etait le defaut du rail.
    const cibles = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    expect(cibles).toContain('/dashboard')
    expect(cibles).toContain('/rapports')
  })

  it('garde des cibles de navigation principales d’au moins 44 px', () => {
    renderSidebar(['/dashboard'])

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: /paramètres/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: /crm/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: /documentation/i })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Déconnexion' })).toHaveClass('min-h-11')
  })

  it('n’active pas une route qui partage seulement le préfixe d’un item', () => {
    renderSidebar(['/settings-legacy'])

    expect(screen.getByRole('link', { name: /paramètres/i })).not.toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it("affiche le bouton d'expansion et déclenche toggle en mode collapsed", () => {
    sidebarState = 'collapsed'

    renderSidebar()

    const button = screen.getByRole('button', { name: 'Agrandir le menu' })
    fireEvent.click(button)

    expect(mockToggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('gère le fallback utilisateur quand le profil est indisponible', () => {
    profileState = {
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    }

    renderSidebar()

    expect(screen.getByText('Paramètres')).toBeInTheDocument()
    expect(screen.getByText('Opérations')).toBeInTheDocument()
    expect(screen.getByText('OpenPulse')).toBeInTheDocument()
  })
})
