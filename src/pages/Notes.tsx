import { useState, lazy, Suspense, useMemo, useEffect } from 'react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { Palette, Loader2, User, Users, Building2, Presentation, PanelLeft } from 'lucide-react'
import { TEAM_LABELS, TEAM_KEYS, type TeamKey } from '@/hooks/whiteboards/useSimpleWhiteboards'
import {
  useWhiteboardList,
  type BoardScope,
  type BoardSummary,
} from '@/hooks/whiteboards/useWhiteboardList'
import { WhiteboardBoardList } from '@/components/whiteboard/WhiteboardBoardList'
import { useAuth } from '@/hooks/shared/useAuth'
import { useUserRole } from '@/hooks/shared/useUserRole'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { cn } from '@/lib/utils'
import { MARQUE } from '@/config/branding'

const WhiteboardCanvas = lazy(() =>
  import('@/components/whiteboard/WhiteboardCanvas').then((m) => ({ default: m.WhiteboardCanvas }))
)
const PresentationStudio = lazy(() =>
  import('@/components/whiteboard/PresentationStudio').then((m) => ({
    default: m.PresentationStudio,
  }))
)

type Scope = 'mine' | 'team' | 'company' | 'presentations'

const TABS: { key: Scope; label: string; icon: typeof User }[] = [
  { key: 'mine', label: 'Mes tableaux', icon: User },
  { key: 'team', label: 'Tableaux équipe', icon: Users },
  { key: 'company', label: `Tableaux ${MARQUE.nomCourt}`, icon: Building2 },
  { key: 'presentations', label: 'Présentations', icon: Presentation },
]

const SCOPE_MAP: Record<Exclude<Scope, 'presentations'>, BoardScope> = {
  mine: 'personal',
  team: 'team',
  company: 'company',
}

export default function Notes() {
  const { user } = useAuth()
  const { role, isAdmin } = useUserRole()
  const isMobile = useIsMobile()
  const [scope, setScope] = useState<Scope>('mine')
  const [listOpen, setListOpen] = useState(false)
  /** Tableau actif mémorisé par périmètre pour ne pas perdre le contexte en changeant d'onglet. */
  const [activeIds, setActiveIds] = useState<Record<string, string>>({})

  const defaultTeam = useMemo<TeamKey | null>(
    () =>
      role && (TEAM_KEYS as readonly string[]).includes(role)
        ? (role as TeamKey)
        : isAdmin
          ? 'direction'
          : null,
    [role, isAdmin]
  )
  const [team, setTeam] = useState<TeamKey | null>(null)
  const activeTeam = team ?? defaultTeam

  const boardScope = scope === 'presentations' ? null : SCOPE_MAP[scope]
  const listKey = `${scope}:${scope === 'team' ? (activeTeam ?? '') : ''}`

  const { data: boards = [], isLoading } = useWhiteboardList(
    (boardScope ?? 'personal') as BoardScope,
    scope === 'team' ? activeTeam : null,
    false
  )
  const enabled = scope !== 'presentations' && (scope !== 'team' || !!activeTeam)

  // Sélection par défaut : premier tableau (épinglé puis plus récent) du périmètre.
  useEffect(() => {
    if (!enabled || boards.length === 0) return
    setActiveIds((prev) => {
      const currentId = prev[listKey]
      if (currentId && boards.some((b) => b.id === currentId)) return prev
      return { ...prev, [listKey]: boards[0].id }
    })
  }, [boards, enabled, listKey])

  const current: BoardSummary | undefined =
    boards.find((b) => b.id === activeIds[listKey]) ?? boards[0]
  const readOnly = scope === 'mine' ? (current ? current.owner_id !== user?.id : false) : false

  const handleSelect = (board: BoardSummary) => {
    setActiveIds((prev) => ({ ...prev, [listKey]: board.id }))
    setListOpen(false)
  }

  const boardListPanel =
    enabled && boardScope ? (
      <WhiteboardBoardList
        scope={boardScope}
        team={scope === 'team' ? activeTeam : null}
        activeId={current?.id ?? null}
        onSelect={handleSelect}
        canManage={!readOnly}
      />
    ) : null

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {scope !== 'presentations' && isMobile && (
        <Sheet open={listOpen} onOpenChange={setListOpen}>
          <SheetTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 min-h-8 gap-1 border border-white/20 bg-white/10 text-xs text-white backdrop-blur"
            >
              <PanelLeft className="h-3.5 w-3.5" />
              Tableaux
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
            <SheetHeader className="border-b p-3">
              <SheetTitle className="text-base">Tableaux</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100%-3.5rem)]">{boardListPanel}</div>
          </SheetContent>
        </Sheet>
      )}
      {scope === 'team' && isAdmin && (
        <Select value={activeTeam ?? ''} onValueChange={(v) => setTeam(v as TeamKey)}>
          <SelectTrigger className="h-8 w-[150px] border-white/20 bg-white/10 text-xs text-white backdrop-blur">
            <SelectValue placeholder="Équipe" />
          </SelectTrigger>
          <SelectContent>
            {TEAM_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {TEAM_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setScope(key)}
            className={cn(
              'flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              scope === key ? 'bg-white text-primary shadow-sm' : 'text-white/80 hover:text-white'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const spinner = (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <ImmersivePageHeader
        title="Tableau blanc"
        subtitle="Tableaux illimités, historique, bibliothèque de blocs, commentaires et présentations"
        icon={Palette}
        variant="compact"
        actions={headerActions}
      />
      <main className="relative flex min-h-0 min-w-0 flex-1 bg-muted/20">
        {scope !== 'presentations' && !isMobile && (
          <aside className="hidden w-64 shrink-0 border-r bg-background/60 lg:block">
            {boardListPanel}
          </aside>
        )}
        <div className="relative min-h-0 min-w-0 flex-1">
          <Suspense fallback={spinner}>
            {scope === 'presentations' ? (
              <PresentationStudio team={activeTeam} />
            ) : scope === 'team' && !activeTeam ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Aucune équipe rattachée à votre compte : contactez un administrateur pour accéder à
                un tableau d'équipe.
              </div>
            ) : isLoading || !current ? (
              spinner
            ) : (
              <WhiteboardCanvas
                key={current.id}
                whiteboard={current}
                readOnly={readOnly}
                collaborative={scope !== 'mine'}
                scope={boardScope ?? 'personal'}
                team={scope === 'team' ? activeTeam : null}
              />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
