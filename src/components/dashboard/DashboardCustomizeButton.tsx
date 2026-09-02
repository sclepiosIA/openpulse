import React from 'react'
import { Button } from '@/components/ui/button'
import { Settings2, Save, X, RotateCcw, Loader2, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface DashboardCustomizeActions {
  startEdit: () => void
  cancelEdit: () => void
  saveLayout: () => void
  resetToDefault: () => void
  openWidgetSelector: () => void
  applyTemplate: (templateId: string) => void
}

interface DashboardCustomizeButtonProps {
  isEditMode: boolean
  isSaving: boolean
  actions: DashboardCustomizeActions
  templates?: { id: string; name: string; description: string }[]
  variant?: 'default' | 'ghost-white'
}

export function DashboardCustomizeButton({
  isEditMode,
  isSaving,
  actions,
  templates = [],
  variant = 'default',
}: DashboardCustomizeButtonProps) {
  const isGhostWhite = variant === 'ghost-white'

  if (isEditMode) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={actions.cancelEdit}
          className={cn(
            'h-8 px-2',
            isGhostWhite && 'text-white/80 hover:text-white hover:bg-card/20'
          )}
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Annuler</span>
        </Button>
        <Button
          size="sm"
          onClick={actions.saveLayout}
          disabled={isSaving}
          className={cn(
            'h-8 px-2',
            isGhostWhite && 'bg-card/20 hover:bg-card/30 text-white border-white/20'
          )}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline ml-1">Enregistrer</span>
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isGhostWhite ? 'ghost' : 'outline'}
          size="sm"
          className={cn(
            'h-8 px-2',
            isGhostWhite && 'text-white/80 hover:text-white hover:bg-card/20 border-white/20'
          )}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Personnaliser</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={actions.startEdit}>
          <Settings2 className="h-4 w-4 mr-2" />
          Modifier la disposition
        </DropdownMenuItem>
        <DropdownMenuItem onClick={actions.openWidgetSelector}>
          <Settings2 className="h-4 w-4 mr-2" />
          Choisir les widgets
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {templates.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Templates</div>
            {templates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => actions.applyTemplate(template.id)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={actions.resetToDefault} className="text-destructive">
          <RotateCcw className="h-4 w-4 mr-2" />
          Réinitialiser par défaut
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
