import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Building2, Calendar, User, Archive, FileText } from "lucide-react"
import { TaskEditDialog as TaskForm } from '@/components/tasks/TaskEditDialog'
import { TacheDocuments } from '@/components/tasks/TacheDocuments'
import { TaskQuickActions } from "./TaskQuickActions"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { formatDateFr, isOverdue, getDaysUntilDue } from "@/lib/projetsUtils"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  tache: any
  onStatusChange: (id: string, status: string) => void
  etablissementColor: string
  onArchive?: (id: string) => void
  isSelected?: boolean
  onSelectionChange?: (id: string, selected: boolean) => void
  compact?: boolean
}

const STATUS_INDICATOR: Record<string, string> = {
  'A faire': 'bg-muted-foreground/60',
  'En cours': 'bg-primary',
  'Bloqué': 'bg-destructive',
  'Terminé': 'bg-success',
}

const PRIORITY_INDICATOR: Record<string, { dot: string; label: string }> = {
  high: { dot: 'bg-destructive', label: 'Haute' },
  medium: { dot: 'bg-warning', label: 'Moyenne' },
  low: { dot: 'bg-success/70', label: 'Basse' },
}

export function TaskCard({ 
  tache, 
  onStatusChange, 
  etablissementColor, 
  onArchive,
  isSelected = false,
  onSelectionChange,
  compact = false
}: TaskCardProps) {
  const [showDocuments, setShowDocuments] = useState(false)
  const navigate = useNavigate()
  
  const overdue = isOverdue(tache.echeance, tache.statut)
  const daysUntil = getDaysUntilDue(tache.echeance)
  const statusDot = STATUS_INDICATOR[tache.statut] || 'bg-muted-foreground'
  const priority = PRIORITY_INDICATOR[tache.priorite]

  const handleCardClick = () => {
    if (tache.etablissement_id) {
      navigate(`/etablissements/${tache.etablissement_id}`)
    }
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (!tache.etablissement_id) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  const navAriaLabel = tache.etablissement_id
    ? `Ouvrir la fiche de ${tache.etablissements?.nom || 'l\'établissement'} associée à la tâche ${tache.titre}`
    : undefined

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(tache.id, checked)
  }

  // ─── Mode compact : ligne unique ───
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent transition-all group",
          "hover:bg-accent/50 hover:border-border",
          tache.etablissement_id && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected && 'bg-primary/5 border-primary/20',
          overdue && 'bg-destructive/5'
        )}
        onClick={handleCardClick}
        role={tache.etablissement_id ? "button" : undefined}
        tabIndex={tache.etablissement_id ? 0 : undefined}
        aria-label={navAriaLabel}
        onKeyDown={handleCardKeyDown}
      >
        {onSelectionChange && (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={isSelected} onCheckedChange={handleCheckboxChange} className="shrink-0" />
          </div>
        )}
        
        {/* Status dot */}
        <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot)} />
        
        {/* Priority dot */}
        {priority && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priority.dot)} />}
        
        <span className="font-medium text-sm truncate flex-1 min-w-0">{tache.titre}</span>
        
        <span className="text-[11px] text-muted-foreground truncate max-w-[120px] hidden sm:block" style={{ color: etablissementColor }}>
          {tache.etablissements?.nom}
        </span>
        
        {tache.echeance && (
          <span className={cn("text-[11px] shrink-0 hidden md:block", overdue ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
            {formatDateFr(tache.echeance)}
          </span>
        )}
        
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Select value={tache.statut} onValueChange={(value) => onStatusChange(tache.id, value)}>
            <SelectTrigger className="w-[90px] h-6 text-[11px] border-0 bg-transparent hover:bg-muted px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A faire">À faire</SelectItem>
              <SelectItem value="En cours">En cours</SelectItem>
              <SelectItem value="Bloqué">Bloqué</SelectItem>
              <SelectItem value="Terminé">Terminé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  // ─── Mode standard : card épurée ───
  return (
    <div
      className={cn(
        "group relative rounded-xl border transition-all",
        "hover:shadow-md hover:border-border",
        tache.etablissement_id && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && 'ring-2 ring-primary/30 bg-primary/[0.02]',
        overdue && !isSelected && 'border-destructive/30 bg-destructive/[0.02]'
      )}
      onClick={handleCardClick}
      role={tache.etablissement_id ? "button" : undefined}
      tabIndex={tache.etablissement_id ? 0 : undefined}
      aria-label={navAriaLabel}
      onKeyDown={handleCardKeyDown}
    >
      {/* Indicateur statut latéral */}
      <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-full", statusDot)} />

      <div className="pl-5 pr-4 py-3 space-y-2">
        {/* ─ Row 1: Checkbox + Titre + Priority + Actions ─ */}
        <div className="flex items-start gap-2.5">
          {onSelectionChange && (
            <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
              <Checkbox checked={isSelected} onCheckedChange={handleCheckboxChange} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h4 className="font-semibold text-[13px] leading-snug flex-1 min-w-0 line-clamp-2">
                {tache.titre}
              </h4>

              {/* Priority badge */}
              {priority && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", priority.dot)} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Priorité {priority.label.toLowerCase()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>

        {/* ─ Row 2: Metadata inline ─ */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px]">
          {/* Établissement */}
          <span 
            className="inline-flex items-center gap-1 font-medium"
            style={{ color: etablissementColor }}
          >
            <Building2 className="w-3 h-3" />
            <span className="truncate max-w-[180px]">{tache.etablissements?.nom || '—'}</span>
          </span>

          {/* Catégorie */}
          {tache.categories_taches && (
            <Badge 
              variant="outline" 
              className="h-[18px] px-1.5 text-[10px] font-medium border-0"
              style={{ 
                backgroundColor: (tache.categories_taches.couleur || '#888') + '18',
                color: tache.categories_taches.couleur || 'inherit'
              }}
            >
              {tache.categories_taches.nom}
            </Badge>
          )}

          {/* Phase */}
          {tache.etablissements?.phase && (
            <Badge variant="outline" className="h-[18px] px-1.5 text-[10px] font-normal text-muted-foreground">
              {tache.etablissements.phase}
            </Badge>
          )}

          {/* Séparateur visuel */}
          <span className="text-border hidden sm:block">·</span>

          {/* Échéance */}
          {tache.echeance && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "inline-flex items-center gap-1",
                    overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                  )}>
                    <Calendar className="w-3 h-3" />
                    {formatDateFr(tache.echeance)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {daysUntil !== null && (
                    daysUntil < 0 
                      ? `En retard de ${Math.abs(daysUntil)} jour(s)`
                      : daysUntil === 0 
                        ? "Échéance aujourd'hui"
                        : `Dans ${daysUntil} jour(s)`
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Responsable */}
          {tache.responsable_profile && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <User className="w-3 h-3" />
              {tache.responsable_profile.prenom} {tache.responsable_profile.nom}
            </span>
          )}
        </div>

        {/* ─ Row 3: Description (1 line max) ─ */}
        {tache.description && (
          <p className="text-[12px] text-muted-foreground/80 line-clamp-1 leading-relaxed">
            {tache.description}
          </p>
        )}

        {/* ─ Row 4: Actions (always visible, compact) ─ */}
        <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
          <Select value={tache.statut} onValueChange={(value) => onStatusChange(tache.id, value)}>
            <SelectTrigger className={cn(
              "h-7 text-[11px] font-medium border-0 rounded-md px-2 w-auto min-w-[90px]",
              tache.statut === 'A faire' && 'bg-muted text-muted-foreground',
              tache.statut === 'En cours' && 'bg-primary/10 text-primary',
              tache.statut === 'Bloqué' && 'bg-destructive/10 text-destructive',
              tache.statut === 'Terminé' && 'bg-success/10 text-success',
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A faire">À faire</SelectItem>
              <SelectItem value="En cours">En cours</SelectItem>
              <SelectItem value="Bloqué">Bloqué</SelectItem>
              <SelectItem value="Terminé">Terminé</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setShowDocuments(!showDocuments)} aria-label="Document">
            <FileText className="w-3.5 h-3.5" />
          </Button>

          <TaskForm mode="edit" tache={tache} />

          <TaskQuickActions task={tache} />

          {onArchive && !tache.archive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onArchive(tache.id)} aria-label="Archiver">
              <Archive className="w-3.5 h-3.5" />
            </Button>
          )}

          {tache.archive && (
            <Badge variant="outline" className="h-5 text-[10px] bg-muted ml-auto">
              <Archive className="w-3 h-3 mr-0.5" /> Archivé
            </Badge>
          )}
        </div>

        {/* Documents panel */}
        {showDocuments && (
          <div className="pt-2 border-t border-border/50 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <TacheDocuments tacheId={tache.id} tacheTitre={tache.titre} />
          </div>
        )}
      </div>
    </div>
  )
}
