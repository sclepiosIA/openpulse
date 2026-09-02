import { Loader2, Sparkles, PanelLeft } from 'lucide-react'
import { useContext } from 'react'
import { cn } from '@/lib/utils'
import { PresenceAvatars, type PresenceUser } from './PresenceAvatars'
import { SidebarContext } from '@/components/ui/sidebar'

function SafeSidebarToggle() {
  const sidebar = useContext(SidebarContext)
  if (!sidebar) {
    return null
  }

  const { toggleSidebar, state } = sidebar
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title={state === 'collapsed' ? 'Déployer le menu' : 'Réduire le menu'}
      aria-label="Basculer le menu latéral"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  )
}

/**
 * Header réutilisable pour les trois éditeurs (texte, tableur, présentation).
 * Marque OpenPulse + indicateur de sauvegarde + présence + slot d'actions.
 */
export function EditorHeader({
  documentName,
  kind,
  isSaving,
  lastSaved,
  presence,
  isCollabConnected,
  children,
}: {
  documentName: string
  kind: 'Document' | 'Tableur' | 'Présentation'
  isSaving?: boolean
  lastSaved?: Date | null
  presence?: PresenceUser[]
  isCollabConnected?: boolean
  children?: React.ReactNode
}) {
  const hasPresence = !!presence && presence.length > 0
  return (
    <div className="editor-header flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <SafeSidebarToggle />
        <div
          className="editor-brand-badge flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0"
          aria-label="OpenPulse"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="tracking-wide">OpenPulse</span>
        </div>
        <div className="min-w-0 flex flex-col leading-tight">
          <h2 className="text-sm font-semibold truncate text-foreground">{documentName}</h2>
          <span className="text-[11px] text-muted-foreground truncate">
            {kind} · édition intelligente
            {hasPresence ? ` · ${(presence?.length ?? 0) + 1} en ligne` : ''}
          </span>
        </div>
        <SaveIndicator isSaving={!!isSaving} lastSaved={lastSaved ?? null} />
        {hasPresence && (
          <PresenceAvatars
            users={presence!}
            isConnected={isCollabConnected !== false}
            className="ml-1"
          />
        )}
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

export function SaveIndicator({
  isSaving,
  lastSaved,
  className,
}: {
  isSaving: boolean
  lastSaved: Date | null
  className?: string
}) {
  if (isSaving) {
    return (
      <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <span className="editor-status-dot editor-status-dot--saving" />
        <Loader2 className="h-3 w-3 animate-spin" />
        Enregistrement…
      </span>
    )
  }
  if (lastSaved) {
    return (
      <span className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <span className="editor-status-dot" />
        Enregistré à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }
  return null
}

/** Bouton IA branded (gradient OpenPulse). */
export function EditorAIButton({
  onClick,
  children,
  title,
  className,
}: {
  onClick: () => void
  children: React.ReactNode
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'editor-ai-btn inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold',
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

/** Bouton "Fermer" cohérent. */
export function EditorCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
    >
      Fermer
    </button>
  )
}
