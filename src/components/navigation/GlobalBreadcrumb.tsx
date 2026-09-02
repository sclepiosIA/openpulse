import { useNavigationHistory } from '@/hooks/shared/useNavigationHistory'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  BreadcrumbEllipsis,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Home, ChevronLeft, Mail, Layers, FolderOpen, ChevronRight } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const MAX_VISIBLE_ITEMS = 5

export function GlobalBreadcrumb() {
  const { history, goTo, goBack, canGoBack } = useNavigationHistory()

  // Fonction pour obtenir l'icône selon le type d'entrée
  const getEntryIcon = (entry: any) => {
    if (entry.entryType === 'tab') return <Layers className="h-3 w-3 text-primary/60" />
    if (entry.entryType === 'subsection') return <FolderOpen className="h-3 w-3 text-primary/60" />
    if (entry.isVirtual) return <Mail className="h-3 w-3 text-primary/60" />
    return null
  }

  // Ne rien afficher si historique vide ou une seule page
  if (history.length <= 1) {
    return null
  }

  // Limiter les éléments visibles pour éviter l'encombrement
  const shouldCollapse = history.length > MAX_VISIBLE_ITEMS
  const visibleHistory = shouldCollapse
    ? [history[0], ...history.slice(-(MAX_VISIBLE_ITEMS - 1))]
    : history

  const collapsedItems = shouldCollapse
    ? history.slice(1, history.length - (MAX_VISIBLE_ITEMS - 1))
    : []

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* Bouton Retour (visible uniquement sur mobile) */}
      {canGoBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="lg:hidden flex-shrink-0 h-8 w-8 p-0 bg-card/50 backdrop-blur-sm border border-primary/10 hover:bg-card/70"
          aria-label="Retour à la page précédente"
        >
          <ChevronLeft className="h-4 w-4 text-primary" />
        </Button>
      )}

      {/* Fil d'Ariane complet (masqué sur mobile si plus d'une page) */}
      <Breadcrumb className="hidden sm:block flex-1 min-w-0">
        <BreadcrumbList className="flex-wrap gap-1">
          {/* Bouton Home avec cercle glassmorphism */}
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => goTo(0)}
              className="cursor-pointer flex items-center gap-2 group hover:text-foreground transition-all"
              aria-label="Retour à l'accueil"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center group-hover:from-primary/25 group-hover:to-primary/10 transition-all shadow-sm">
                <Home className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="hidden md:inline text-primary font-medium text-sm">
                {history[0]?.label || 'Accueil'}
              </span>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {history.length > 1 && (
            <BreadcrumbSeparator className="text-primary/40">
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
          )}

          {/* Items collapsés dans un dropdown */}
          {shouldCollapse && collapsedItems.length > 0 && (
            <>
              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                    aria-label="Afficher l'historique complet"
                  >
                    <BreadcrumbEllipsis className="h-4 w-4 text-primary/60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="bg-card/95 backdrop-blur-md border-primary/10"
                  >
                    {collapsedItems.map((entry, collapseIndex) => (
                      <DropdownMenuItem
                        key={`collapsed-${entry.path}-${entry.timestamp}-${collapseIndex}`}
                        onClick={() => goTo(collapseIndex + 1)}
                        className="cursor-pointer hover:bg-primary/5"
                      >
                        {entry.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-primary/40">
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
            </>
          )}

          {/* Items visibles */}
          {visibleHistory.slice(1).map((entry, visibleIndex) => {
            const actualIndex = shouldCollapse
              ? history.length - (MAX_VISIBLE_ITEMS - 1) + visibleIndex
              : visibleIndex + 1
            const isLast = actualIndex === history.length - 1
            const icon = getEntryIcon(entry)

            return (
              <span
                key={`visible-${entry.path}-${entry.timestamp}-${visibleIndex}`}
                className="contents"
              >
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage
                      className={cn(
                        'font-semibold text-foreground max-w-[200px] truncate flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-primary/10 to-transparent',
                        entry.entryType === 'tab' && 'font-bold',
                        entry.entryType === 'subsection' && 'text-foreground/80'
                      )}
                    >
                      {icon}
                      <span className="truncate">{entry.label}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => goTo(actualIndex)}
                      className={cn(
                        'cursor-pointer hover:text-primary hover:bg-primary/5 px-2 py-1 rounded-md transition-all max-w-[150px] truncate flex items-center gap-1.5 text-muted-foreground',
                        entry.entryType === 'tab' && 'font-medium'
                      )}
                      aria-label={`Naviguer vers ${entry.label}`}
                    >
                      {icon}
                      <span className="truncate">{entry.label}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <BreadcrumbSeparator className="text-primary/40">
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                )}
              </span>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Version mobile avec dropdown pour historique complet */}
      <div className="sm:hidden flex items-center gap-2 flex-1 min-w-0">
        {history.length > 2 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 bg-card/50 backdrop-blur-sm border border-primary/10"
                aria-label="Historique de navigation"
              >
                <BreadcrumbEllipsis className="h-4 w-4 text-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[300px] overflow-y-auto bg-card/95 backdrop-blur-md border-primary/10"
            >
              {history.slice(0, -1).map((entry, mobileIndex) => (
                <DropdownMenuItem
                  key={`mobile-${entry.path}-${entry.timestamp}-${mobileIndex}`}
                  onClick={() => goTo(mobileIndex)}
                  className="cursor-pointer hover:bg-primary/5"
                >
                  <span className="flex items-center gap-2">
                    {getEntryIcon(entry)}
                    {entry.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="text-sm font-semibold text-foreground truncate block px-2 py-1 rounded-md bg-gradient-to-r from-primary/10 to-transparent">
          {history[history.length - 1]?.label}
        </span>
      </div>
    </div>
  )
}
