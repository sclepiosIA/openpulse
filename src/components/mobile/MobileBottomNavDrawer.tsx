import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/components/AuthProvider'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useRolePermissions } from '@/hooks/auth/useRolePermissions'
import { useNavigationBadges } from '@/hooks/ui/useNavigationBadges'
import {
  navigationSections as configNavigationSections,
  externalLinkGroups,
  backendLinkGroups,
  filterNavigationByPermissions,
  filterExternalLinksByTeam,
  filterExternalLinkGroupsByTeam,
  filterBackendLinkGroupsByTeam,
  filterInternalIframeLinksByTeam,
  getIframeLinksBySection,
  getExternalLinksBySection,
  getExternalLinksWithConfig,
  getInternalIframeLinksWithConfig,
  teamConfig,
} from '@/config/navigationConfig'
import type { InternalToolRuntimeConfig } from '@/config/internalTools'
import { useAppConfig } from '@/hooks/shared/useAppConfig'
import { useApplicationsExternes } from '@/hooks/shared/useApplicationsExternes'

import { ExternalLink, ChevronRight, ChevronDown, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
// Cadre carre de 40 px : symbole, pas lettrage horizontal (cf.
// JarvisLogoTrigger, meme defaut d'origine).
import symboleMarque from '@/assets/marque/symbole.svg'

interface MobileBottomNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileBottomNavDrawer({ open, onOpenChange }: MobileBottomNavDrawerProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const { data: currentProfile } = useCurrentProfile()
  const permissions = useRolePermissions()
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const badges = useNavigationBadges()

  // Configuration du thème d'équipe
  const currentTeamConfig = permissions.team ? teamConfig[permissions.team] : null

  // Helper pour résoudre les badges par clé
  const getBadgeForKey = (badgeKey?: string): number | undefined => {
    if (!badgeKey) return undefined
    const badgeMap: Record<string, number> = {
      pulseUnread: badges.pulse,
      emailsUnread: badges.emails,
      todosCount: badges.todos,
      calendarEvents: badges.calendar,
    }
    const count = badgeMap[badgeKey]
    return count > 0 ? count : undefined
  }

  // IMPORTANT: Ne pas filtrer pendant le chargement des permissions
  const navigationSections = permissions.isLoading
    ? configNavigationSections
    : filterNavigationByPermissions(configNavigationSections, permissions)
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

  // Liens pour la section Ressources
  const resourcesIframeLinks = filteredIframeLinks.filter((l) => l.section === 'Ressources')
  const resourcesExternalLinks = filteredExternalLinks.filter((l) => l.section === 'Ressources')
  const hasResourcesSection = resourcesIframeLinks.length > 0 || resourcesExternalLinks.length > 0

  // Helper pour récupérer les liens d'une section
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

  const handleNavigate = (path: string) => {
    navigate(path)
    onOpenChange(false)
  }

  const handleSignOut = async () => {
    onOpenChange(false)
    await signOut()
  }

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard'
    }
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const getUserInitials = () => {
    if (currentProfile?.prenom && currentProfile?.nom) {
      return `${currentProfile.prenom[0]}${currentProfile.nom[0]}`.toUpperCase()
    }
    return 'U'
  }

  const fullName = currentProfile ? `${currentProfile.prenom} ${currentProfile.nom}` : 'Utilisateur'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[85%] max-w-[320px] flex-col border-r bg-background p-0"
      >
        <SheetHeader className="border-b p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-card">
              <img
                loading="lazy"
                decoding="async"
                src={symboleMarque}
                alt="OpenPulse"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <SheetTitle className="text-lg font-bold text-foreground">OpenPulse</SheetTitle>
              {currentTeamConfig && (
                <Badge
                  variant="secondary"
                  className="text-xs mt-1 px-2 py-0.5 bg-primary/10 text-primary/80 border-0 font-medium w-fit"
                >
                  {currentTeamConfig.label}
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Navigation scrollable */}
        <ScrollArea className="flex-1">
          <div className="py-2">
            {navigationSections.map((section) => {
              const sectionIframeLinks = getSectionIframeLinks(section.section)
              const sectionExternalLinks = getSectionExternalLinks(section.section)

              return (
                <div key={section.section} className="mb-1">
                  <div className="px-4 py-2 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary/60">
                      {section.section}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="space-y-0.5 px-2">
                    {/* Items de navigation classiques */}
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.path)
                      const dynamicBadge = getBadgeForKey(item.badgeKey)

                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNavigate(item.path)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'min-h-11 w-full flex items-center gap-3 py-2.5 px-4 rounded-none transition-all duration-200 border-l-4',
                            active
                              ? 'bg-primary/10 text-primary border-primary font-medium'
                              : 'hover:bg-primary/5 border-transparent hover:border-primary/30'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-5 w-5 flex-shrink-0',
                              active ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                          <span
                            className={cn(
                              'flex-1 text-left text-sm',
                              active ? 'font-medium' : 'font-normal'
                            )}
                          >
                            {item.label}
                          </span>
                          {dynamicBadge && dynamicBadge > 0 && (
                            <Badge
                              variant="destructive"
                              className="h-5 min-w-[20px] px-1.5 text-xs"
                            >
                              {dynamicBadge > 99 ? '99+' : dynamicBadge}
                            </Badge>
                          )}
                          {active && <ChevronRight className="h-4 w-4 text-primary" />}
                        </button>
                      )
                    })}

                    {/* Liens iframe intégrés à la section */}
                    {sectionIframeLinks.map((link) => {
                      const Icon = link.icon
                      const linkPath = `/backend?tool=${link.key}`
                      const active =
                        location.pathname === '/backend' &&
                        new URLSearchParams(location.search).get('tool') === link.key

                      return (
                        <button
                          key={link.key}
                          onClick={() => handleNavigate(linkPath)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'min-h-11 w-full flex items-center gap-3 py-2.5 px-4 rounded-none transition-all duration-200 border-l-4',
                            active
                              ? 'bg-primary/10 text-primary border-primary font-medium'
                              : 'hover:bg-primary/5 border-transparent hover:border-primary/30'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-5 w-5 flex-shrink-0',
                              active ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                          <span
                            className={cn(
                              'flex-1 text-left text-sm',
                              active ? 'font-medium' : 'font-normal'
                            )}
                          >
                            {link.label}
                          </span>
                          {active && <ChevronRight className="h-4 w-4 text-primary" />}
                        </button>
                      )
                    })}

                    {/* Liens externes intégrés à la section */}
                    {sectionExternalLinks.map((link) => {
                      const Icon = link.icon
                      return (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-11 w-full flex items-center gap-3 py-2.5 px-4 rounded-none transition-all duration-200 hover:bg-primary/5 border-l-4 border-transparent hover:border-primary/30"
                          onClick={() => onOpenChange(false)}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm">{link.label}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      )
                    })}

                    {/* Backend group dans la section Technique */}
                    {section.section === 'Technique' &&
                      filteredBackendGroups.map((group) => (
                        <Collapsible
                          key={group.label}
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
                            <button className="min-h-11 w-full flex items-center gap-3 py-2.5 px-4 rounded-none transition-all duration-200 hover:bg-primary/5 border-l-4 border-transparent hover:border-primary/30">
                              <group.icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                              <span className="flex-1 text-left text-sm">{group.label}</span>
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 transition-transform text-muted-foreground',
                                  openGroups.includes(group.label) && 'rotate-180'
                                )}
                              />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-6 border-l border-primary/20 pl-2 space-y-0.5">
                              {group.links.map((link) => {
                                const linkPath = `${group.basePath}?backend=${link.key}`
                                const active =
                                  location.pathname === group.basePath &&
                                  new URLSearchParams(location.search).get('backend') === link.key
                                return (
                                  <button
                                    key={link.key}
                                    onClick={() => handleNavigate(linkPath)}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                      'min-h-11 w-full flex items-center gap-2 py-2 px-3 text-sm rounded-md transition-colors',
                                      active
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'hover:bg-primary/5'
                                    )}
                                  >
                                    <link.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <span className="flex-1 truncate text-left">{link.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                  </div>
                </div>
              )
            })}

            {/* Section Ressources */}
            {hasResourcesSection && (
              <div className="mb-1">
                <div className="px-4 py-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary/60">
                    Ressources
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-0.5 px-2">
                  {resourcesIframeLinks.map((link) => {
                    const Icon = link.icon
                    const linkPath = `/backend?tool=${link.key}`
                    const active =
                      location.pathname === '/backend' &&
                      new URLSearchParams(location.search).get('tool') === link.key

                    return (
                      <button
                        key={link.key}
                        onClick={() => handleNavigate(linkPath)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'min-h-11 w-full flex items-center gap-3 py-2.5 px-4 rounded-none transition-all duration-200 border-l-4',
                          active
                            ? 'bg-primary/10 text-primary border-primary font-medium'
                            : 'hover:bg-primary/5 border-transparent hover:border-primary/30'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 flex-shrink-0',
                            active ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                        <span
                          className={cn(
                            'flex-1 text-left text-sm',
                            active ? 'font-medium' : 'font-normal'
                          )}
                        >
                          {link.label}
                        </span>
                        {active && <ChevronRight className="h-4 w-4 text-primary" />}
                      </button>
                    )
                  })}

                  {resourcesExternalLinks.map((link) => {
                    const Icon = link.icon
                    return (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-11 w-full flex items-center gap-3 py-2.5 px-4 rounded-none transition-all duration-200 hover:bg-primary/5 border-l-4 border-transparent hover:border-primary/30"
                        onClick={() => onOpenChange(false)}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left text-sm">{link.label}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Groupes de liens externes avec sous-menu */}
            {filteredExternalGroups.length > 0 && (
              <div className="mt-2 pt-2">
                <div className="px-4 py-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary/60">
                    Outils externes
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-0.5 px-2">
                  {filteredExternalGroups.map((group) => (
                    <Collapsible
                      key={group.label}
                      open={openGroups.includes(group.label)}
                      onOpenChange={(isOpen) => {
                        setOpenGroups((prev) =>
                          isOpen ? [...prev, group.label] : prev.filter((g) => g !== group.label)
                        )
                      }}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="min-h-11 w-full flex items-center gap-3 py-2.5 px-4 rounded-none transition-all duration-200 hover:bg-primary/5 border-l-4 border-transparent hover:border-primary/30">
                          <group.icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                          <span className="flex-1 text-left text-sm">{group.label}</span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 transition-transform text-muted-foreground',
                              openGroups.includes(group.label) && 'rotate-180'
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 border-l border-primary/20 pl-2 space-y-0.5">
                          {group.links.map((link) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-h-11 items-center gap-2 py-2 px-3 text-sm hover:bg-primary/5 rounded-md transition-colors"
                              onClick={() => onOpenChange(false)}
                            >
                              <link.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate">{link.label}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t bg-background p-4 pb-safe">
          {/* Profil utilisateur */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <Avatar className="h-11 w-11 flex-shrink-0 border-2 border-primary/30">
                <AvatarImage src={currentProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{fullName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentProfile?.email || ''}
              </p>
            </div>
          </div>

          {/* Bouton déconnexion avec style premium */}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 w-full gap-2 hover:bg-destructive/10 hover:text-destructive border border-destructive/20 transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
