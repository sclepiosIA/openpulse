import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useNavigationPrefetch } from '@/hooks/ui/useNavigationPrefetch'
import { NavLink, useLocation } from 'react-router-dom'
import { ExternalLink, ChevronRight, ChevronDown, PanelLeftOpen, LogOut } from 'lucide-react'
import { JarvisLogoTrigger } from '@/components/jarvis/JarvisLogoTrigger'
import { useAuth } from '@/components/AuthProvider'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { SecurityStatusIndicator } from '@/components/auth/SecurityStatusIndicator'
import { useRolePermissions } from '@/hooks/auth/useRolePermissions'
import { useNavigationBadges } from '@/hooks/ui/useNavigationBadges'
import {
  navigationSections,
  externalLinkGroups,
  backendLinkGroups,
  filterNavigationByPermissions,
  filterExternalLinksByTeam,
  filterExternalLinkGroupsByTeam,
  filterBackendLinkGroupsByTeam,
  filterInternalIframeLinksByTeam,
  teamConfig,
  getIframeLinksBySection,
  getExternalLinksBySection,
  getExternalLinksWithConfig,
  getInternalIframeLinksWithConfig,
} from '@/config/navigationConfig'
import type { InternalToolRuntimeConfig } from '@/config/internalTools'
import { useAppConfig } from '@/hooks/shared/useAppConfig'
import { useApplicationsExternes } from '@/hooks/shared/useApplicationsExternes'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { FavoritesSidebarSection } from '@/components/sidebar/FavoritesSidebarSection'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SidebarMenuSkeleton, SidebarMenuSkeletonCollapsed } from '@/components/ui/sidebar-skeleton'

const APP_ACCENT_CLASS: Record<string, string> = {
  '/emails': 'text-[var(--h-mail)]',
  '/pulse': 'text-[var(--h-pulse)]',
  '/calendrier': 'text-[var(--h-calendrier)]',
  '/todos': 'text-[var(--h-taches)]',
}

function getAppAccentClass(path: string, active: boolean): string {
  return APP_ACCENT_CLASS[path] ?? (active ? 'text-[var(--h-openpulse)]' : '')
}

export function AppSidebar() {
  const { signOut, user } = useAuth()
  const { data: currentProfile, isLoading: isProfileLoading } = useCurrentProfile()
  const location = useLocation()
  const currentPath = location.pathname
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = () => state !== 'expanded'
  const permissions = useRolePermissions()
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const prefetch = useNavigationPrefetch()

  // IMPORTANT: Pendant le chargement des permissions, ne rien afficher
  // pour éviter le flash de la liste complète des modules non autorisés.
  const filteredSections = permissions.isLoading
    ? []
    : filterNavigationByPermissions(navigationSections, permissions)
  const { data: toolUrls } =
    useAppConfig<Record<string, InternalToolRuntimeConfig | undefined>>('tool_urls')
  const { data: qontoConfig } = useAppConfig<{ url?: string }>('qonto_config')
  const internalToolRuntimeContext = {
    embedRuntimeEnabled: import.meta.env.VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED === 'true',
    parentOrigin: typeof window === 'undefined' ? '' : window.location.origin,
  }
  const resolvedInternalIframeLinks = getInternalIframeLinksWithConfig(
    toolUrls,
    internalToolRuntimeContext
  )
  const { applications: applicationsDeclarees } = useApplicationsExternes()
  const resolvedExternalLinks = getExternalLinksWithConfig(
    qontoConfig?.url,
    toolUrls,
    internalToolRuntimeContext,
    applicationsDeclarees
  )
  const filteredExternalLinks = permissions.isLoading
    ? []
    : filterExternalLinksByTeam(
        resolvedExternalLinks,
        permissions.team,
        permissions.isAdmin,
        permissions.role
      )

  const filteredExternalGroups = permissions.isLoading
    ? []
    : filterExternalLinkGroupsByTeam(
        externalLinkGroups,
        permissions.team,
        permissions.isAdmin,
        permissions.role
      )
  const filteredBackendGroups = permissions.isLoading
    ? []
    : filterBackendLinkGroupsByTeam(
        backendLinkGroups,
        permissions.team,
        permissions.isAdmin,
        permissions.role
      )
  const filteredIframeLinks = permissions.isLoading
    ? []
    : filterInternalIframeLinksByTeam(
        resolvedInternalIframeLinks,
        permissions.team,
        permissions.isAdmin,
        permissions.role
      )

  // Badges dynamiques centralisés
  const badges = useNavigationBadges()

  // Résolution des badges dynamiques
  const getDynamicBadge = (badgeKey?: string, staticBadge?: number): number | undefined => {
    if (!badgeKey) return staticBadge

    const badgeMap: Record<string, number> = {
      pulseUnread: badges.pulse,
      emailsUnread: badges.emails,
      todosCount: badges.todos,
      calendarEvents: badges.calendar,
      supportTickets: badges.support,
      missedCalls: badges.calls,
      pendingBookings: badges.bookings,
      rdOpenTasks: badges.rd,
    }

    const count = badgeMap[badgeKey]
    return count > 0 ? count : undefined
  }

  // Configuration du thème d'équipe
  const currentTeamConfig = permissions.team ? teamConfig[permissions.team] : null

  const isActive = (path: string, exactMatch?: boolean) => {
    if (exactMatch) {
      return currentPath === path
    }
    return currentPath === path || (path !== '/' && currentPath.startsWith(`${path}/`))
  }

  const getUserInitials = () => {
    if (currentProfile) {
      return `${currentProfile.prenom?.[0] || ''}${currentProfile.nom?.[0] || ''}`.toUpperCase()
    }
    return 'U'
  }

  const getFullName = () => {
    if (currentProfile) {
      return (
        `${currentProfile.prenom || ''} ${currentProfile.nom || ''}`.trim() ||
        currentProfile.email ||
        user?.email ||
        'Chargement…'
      )
    }
    if (isProfileLoading) return 'Chargement…'
    return user?.email?.split('@')[0] || 'Utilisateur'
  }

  // Récupérer les liens iframe et externes pour une section donnée
  const getSectionIframeLinks = (sectionName: string) =>
    getIframeLinksBySection(
      resolvedInternalIframeLinks,
      sectionName,
      permissions.team,
      permissions.isAdmin
    )

  const getSectionExternalLinks = (sectionName: string) =>
    getExternalLinksBySection(
      resolvedExternalLinks,
      sectionName,
      permissions.team,
      permissions.isAdmin
    )

  // Liens sans section (affichés dans Ressources)
  const resourcesIframeLinks = filteredIframeLinks.filter((l) => l.section === 'Ressources')
  const resourcesExternalLinks = filteredExternalLinks.filter((l) => l.section === 'Ressources')
  const hasResourcesSection = resourcesIframeLinks.length > 0 || resourcesExternalLinks.length > 0

  return (
    <Sidebar className="z-30 border-r border-sidebar-border bg-sidebar" collapsible="icon">
      {/* Header - fond transparent pour laisser le dégradé parent visible */}
      <SidebarHeader className={cn('bg-transparent border-0', isCollapsed() && 'p-0')}>
        <div
          className={`flex items-center ${isCollapsed() ? 'flex-col items-center justify-center gap-1.5 py-2' : 'gap-3 p-5 pb-6'}`}
        >
          {/* Logo OpenPulse, avec le declencheur Jarvis */}
          <JarvisLogoTrigger collapsed={isCollapsed()} />
          {state === 'expanded' ? (
            <>
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-foreground">OpenPulse</span>
                {currentTeamConfig && (
                  <Badge
                    variant="secondary"
                    className={`text-xs mt-1 px-2 py-0.5 bg-primary/10 text-primary/80 border-0 font-medium`}
                  >
                    {currentTeamConfig.label}
                  </Badge>
                )}
              </div>
              <SidebarTrigger className="ml-auto hidden md:flex hover:bg-primary/10 transition-colors rounded-lg" />
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-primary/10 transition-colors rounded-lg"
              onClick={toggleSidebar}
              aria-label="Agrandir le menu"
              title="Agrandir le menu"
            >
              <PanelLeftOpen className="h-3 w-3" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      {/* Contenu - fond transparent pour laisser le dégradé parent visible */}
      <SidebarContent className="py-2 bg-transparent">
        <ScrollArea className="flex-1 [&_[data-radix-scroll-area-scrollbar]]:w-1.5 [&_[data-radix-scroll-area-scrollbar]]:opacity-40 [&:hover_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-scrollbar]]:transition-opacity [&_[data-radix-scroll-area-thumb]]:bg-primary/30 [&_[data-radix-scroll-area-thumb]]:rounded-full">
          {permissions.isLoading && (
            <div className="px-2 py-2 space-y-1">
              {Array.from({ length: 8 }).map((_, i) =>
                state === 'expanded' ? (
                  <SidebarMenuSkeleton key={`app-sidebar-skeleton-${i}`} />
                ) : (
                  <SidebarMenuSkeletonCollapsed key={`app-sidebar-skeleton-collapsed-${i}`} />
                )
              )}
            </div>
          )}
          <FavoritesSidebarSection />
          {filteredSections.map((section) => {
            // Récupérer les liens supplémentaires pour cette section
            const sectionIframeLinks = getSectionIframeLinks(section.section)
            const sectionExternalLinks = getSectionExternalLinks(section.section)

            return (
              <SidebarGroup key={section.section} className="py-2">
                {state === 'expanded' && (
                  <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-primary/60 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span>{section.section}</span>
                    <div className="h-px flex-1 bg-border" />
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {/* Items de navigation classiques */}
                    {section.items.map((item) => {
                      const active = isActive(item.path, item.exactMatch)
                      const badgeCount = getDynamicBadge(item.badgeKey, item.badge)
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            asChild
                            tooltip={isCollapsed() ? item.label : undefined}
                          >
                            <NavLink
                              to={item.path}
                              onMouseEnter={() => prefetch(item.path)}
                              className={`
                                flex min-h-11 items-center gap-3 py-2.5 transition-all duration-200
                                ${isCollapsed() ? 'justify-center px-2' : 'px-4'}
                                ${
                                  active
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-primary font-medium'
                                    : 'hover:bg-primary/5 border-l-4 border-transparent hover:border-primary/30'
                                }
                              `}
                              aria-current={active ? 'page' : undefined}
                            >
                              <div className="relative">
                                <item.icon
                                  className={`h-[22px] w-[22px] flex-shrink-0 ${getAppAccentClass(item.path, active)}`}
                                />
                                {isCollapsed() && badgeCount && badgeCount > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground">
                                    {badgeCount > 9 ? '9+' : badgeCount}
                                  </span>
                                )}
                              </div>
                              {state === 'expanded' && (
                                <>
                                  <span className="flex-1 truncate">{item.label}</span>
                                  {item.rightLogo && (
                                    <img
                                      src={item.rightLogo}
                                      alt=""
                                      className="h-4 w-auto object-contain ml-1 opacity-90 dark:opacity-100"
                                    />
                                  )}
                                  {badgeCount && badgeCount > 0 && (
                                    <Badge className="h-5 min-w-[20px] border-0 bg-accent px-1.5 text-xs text-accent-foreground shadow-none">
                                      {badgeCount > 99 ? '99+' : badgeCount}
                                    </Badge>
                                  )}
                                  {active && <ChevronRight className="h-4 w-4 text-primary" />}
                                  {item.label === 'Paramètres' && <SecurityStatusIndicator />}
                                </>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}

                    {/* Liens iframe intégrés à la section */}
                    {sectionIframeLinks.map((link) => {
                      const linkPath = `/backend?tool=${link.key}`
                      const active =
                        currentPath === '/backend' &&
                        new URLSearchParams(location.search).get('tool') === link.key
                      return (
                        <SidebarMenuItem key={link.key}>
                          <SidebarMenuButton
                            asChild
                            tooltip={isCollapsed() ? link.label : undefined}
                          >
                            <NavLink
                              to={linkPath}
                              aria-current={active ? 'page' : undefined}
                              className={`
                                flex min-h-11 items-center gap-3 py-2.5 transition-all duration-200
                                ${isCollapsed() ? 'justify-center px-2' : 'px-4'}
                                ${
                                  active
                                    ? 'bg-primary/10 text-primary border-l-4 border-primary font-medium'
                                    : 'hover:bg-accent border-l-4 border-transparent'
                                }
                              `}
                            >
                              <link.icon className="h-[22px] w-[22px] flex-shrink-0" />
                              {state === 'expanded' && (
                                <>
                                  <span className="flex-1 truncate">{link.label}</span>
                                  {active && <ChevronRight className="h-4 w-4 text-primary" />}
                                </>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}

                    {/* Liens externes intégrés à la section */}
                    {sectionExternalLinks.map((link) => (
                      <SidebarMenuItem key={link.url}>
                        <SidebarMenuButton asChild tooltip={isCollapsed() ? link.label : undefined}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                              flex min-h-11 items-center gap-3 py-2.5 transition-all duration-200
                              hover:bg-accent border-l-4 border-transparent
                              ${isCollapsed() ? 'justify-center px-2' : 'px-4'}
                            `}
                          >
                            <link.icon className="h-[22px] w-[22px] flex-shrink-0" />
                            {state === 'expanded' && (
                              <>
                                <span className="flex-1 truncate">{link.label}</span>
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                              </>
                            )}
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}

                    {/* Backend group dans la section Technique */}
                    {section.section === 'Technique' &&
                      filteredBackendGroups.map((group) => (
                        // a11y : `SidebarMenu` rend un <ul>, `SidebarMenuItem` un <li>.
                        // Le <li> doit donc être enfant DIRECT du <ul>, et le
                        // Collapsible (qui rend un <div>) vivre à l'intérieur du <li>.
                        // L'imbrication inverse violait deux règles axe sur toutes les
                        // pages authentifiées : `list` (<ul> contenant un <div>) et
                        // `listitem` (<li> hors <ul>).
                        <SidebarMenuItem key={group.label}>
                          <Collapsible
                            open={openGroups.includes(group.label)}
                            onOpenChange={(isOpen) => {
                              setOpenGroups((prev) =>
                                isOpen
                                  ? [...prev, group.label]
                                  : prev.filter((g) => g !== group.label)
                              )
                            }}
                          >
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                className={`
                                w-full min-h-11 flex items-center gap-3 py-2.5 transition-all duration-200
                                hover:bg-accent border-l-4 border-transparent cursor-pointer
                                ${isCollapsed() ? 'justify-center px-2' : 'px-4'}
                              `}
                                tooltip={isCollapsed() ? group.label : undefined}
                              >
                                <group.icon className="h-5 w-5 flex-shrink-0" />
                                {state === 'expanded' && (
                                  <>
                                    <span className="flex-1 truncate">{group.label}</span>
                                    <ChevronDown
                                      className={`h-4 w-4 transition-transform ${openGroups.includes(group.label) ? 'rotate-180' : ''}`}
                                    />
                                  </>
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>

                            {state === 'expanded' && (
                              <CollapsibleContent>
                                <div className="ml-6 border-l border-border pl-2 space-y-0.5">
                                  {group.links.map((link) => {
                                    const linkPath = `${group.basePath}?backend=${link.key}`
                                    const active =
                                      currentPath === group.basePath &&
                                      new URLSearchParams(location.search).get('backend') ===
                                        link.key
                                    return (
                                      <NavLink
                                        key={link.key}
                                        to={linkPath}
                                        aria-current={active ? 'page' : undefined}
                                        className={`flex min-h-11 items-center gap-2 py-2 px-3 text-sm rounded-md transition-colors ${
                                          active
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'hover:bg-accent'
                                        }`}
                                      >
                                        <link.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                        <span className="flex-1 truncate">{link.label}</span>
                                      </NavLink>
                                    )
                                  })}
                                </div>
                              </CollapsibleContent>
                            )}
                          </Collapsible>
                        </SidebarMenuItem>
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          })}

          {/* Section Ressources pour les liens non catégorisés */}
          {hasResourcesSection && (
            <SidebarGroup className="py-2">
              {state === 'expanded' && (
                <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-primary/60 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span>Ressources</span>
                  <div className="h-px flex-1 bg-border" />
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Liens iframe Ressources */}
                  {resourcesIframeLinks.map((link) => {
                    const linkPath = `/backend?tool=${link.key}`
                    const active =
                      currentPath === '/backend' &&
                      new URLSearchParams(location.search).get('tool') === link.key
                    return (
                      <SidebarMenuItem key={link.key}>
                        <SidebarMenuButton asChild tooltip={isCollapsed() ? link.label : undefined}>
                          <NavLink
                            to={linkPath}
                            aria-current={active ? 'page' : undefined}
                            className={`
                              flex min-h-11 items-center gap-3 py-2.5 transition-all duration-200
                              ${isCollapsed() ? 'justify-center px-2' : 'px-4'}
                              ${
                                active
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-primary font-medium'
                                  : 'hover:bg-primary/5 border-l-4 border-transparent hover:border-primary/30'
                              }
                            `}
                          >
                            <link.icon className="h-5 w-5 flex-shrink-0" />
                            {state === 'expanded' && (
                              <>
                                <span className="flex-1 truncate">{link.label}</span>
                                {active && <ChevronRight className="h-4 w-4 text-primary" />}
                              </>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}

                  {/* Liens externes Ressources */}
                  {resourcesExternalLinks.map((link) => (
                    <SidebarMenuItem key={link.url}>
                      <SidebarMenuButton asChild tooltip={isCollapsed() ? link.label : undefined}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`
                            flex min-h-11 items-center gap-3 py-2.5 transition-all duration-200
                            hover:bg-accent border-l-4 border-transparent
                            ${isCollapsed() ? 'justify-center px-2' : 'px-4'}
                          `}
                        >
                          <link.icon className="h-5 w-5 flex-shrink-0" />
                          {state === 'expanded' && (
                            <>
                              <span className="flex-1 truncate">{link.label}</span>
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </>
                          )}
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Groupes de liens externes avec sous-menu (si présents) */}
          {filteredExternalGroups.length > 0 && (
            <SidebarGroup className="py-2">
              {state === 'expanded' && (
                <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Outils externes
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredExternalGroups.map((group) => (
                    <SidebarMenuItem key={group.label}>
                      <Collapsible
                        open={openGroups.includes(group.label)}
                        onOpenChange={(isOpen) => {
                          setOpenGroups((prev) =>
                            isOpen ? [...prev, group.label] : prev.filter((g) => g !== group.label)
                          )
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={`
                              w-full min-h-11 flex items-center gap-3 py-2.5 transition-all duration-200
                              hover:bg-accent border-l-4 border-transparent cursor-pointer
                              ${isCollapsed() ? 'justify-center px-2' : 'px-4'}
                            `}
                            tooltip={isCollapsed() ? group.label : undefined}
                          >
                            <group.icon className="h-5 w-5 flex-shrink-0" />
                            {state === 'expanded' && (
                              <>
                                <span className="flex-1 truncate">{group.label}</span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${openGroups.includes(group.label) ? 'rotate-180' : ''}`}
                                />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        {state === 'expanded' && (
                          <CollapsibleContent>
                            <div className="ml-6 border-l border-border pl-2 space-y-0.5">
                              {group.links.map((link) => (
                                <a
                                  key={link.url}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex min-h-11 items-center gap-2 py-2 px-3 text-sm hover:bg-accent rounded-md transition-colors"
                                >
                                  <link.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <span className="flex-1 truncate">{link.label}</span>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </a>
                              ))}
                            </div>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </ScrollArea>
      </SidebarContent>

      {/* Footer avec profil - Style Premium avec glow et online indicator */}
      <SidebarFooter className="relative bg-transparent">
        <div className="h-px bg-border" />

        <div className={`relative ${isCollapsed() ? 'p-2' : 'p-4'}`}>
          {/* Avatar et infos avec online indicator */}
          <div className={`flex items-center ${isCollapsed() ? 'justify-center' : 'gap-3 mb-3'}`}>
            <div className="relative">
              <Avatar className="relative h-11 w-11 flex-shrink-0 border-2 border-primary/30">
                <AvatarImage
                  src={currentProfile?.avatar_url || undefined}
                  alt={getFullName()}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator with pulse */}
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              </span>
            </div>
            {state === 'expanded' && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{getFullName()}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentProfile?.email || user?.email || ''}
                </p>
              </div>
            )}
          </div>

          {/* Actions côte à côte */}
          {state === 'expanded' && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 flex-1 gap-2 hover:bg-destructive/10 hover:text-destructive border border-destructive/20 transition-colors"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </Button>
            </div>
          )}

          {/* Mode collapsed: boutons séparés */}
          {isCollapsed() && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={signOut}
                aria-label="Déconnexion"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
