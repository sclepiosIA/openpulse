import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ActionItem {
  /** Label for the action */
  label: string
  /** Icon component */
  icon?: LucideIcon
  /** Click handler */
  onClick: () => void
  /** Disable the action */
  disabled?: boolean
  /** Add separator after this item */
  separatorAfter?: boolean
  /** Destructive action styling */
  destructive?: boolean
  /** Hide this action conditionally */
  hidden?: boolean
}

interface ActionsDropdownProps {
  /** Array of action items */
  actions: ActionItem[]
  /** Trigger button variant */
  variant?: "ghost" | "outline" | "default"
  /** Trigger button size */
  size?: "sm" | "icon" | "default"
  /** Custom trigger button (overrides default) */
  trigger?: ReactNode
  /** Alignment of dropdown */
  align?: "start" | "center" | "end"
  /** Additional className for trigger */
  className?: string
  /** Dropdown menu width */
  menuWidth?: string
}

export function ActionsDropdown({
  actions,
  variant = "ghost",
  size = "sm",
  trigger,
  align = "end",
  className,
  menuWidth = "w-48"
}: ActionsDropdownProps) {
  const visibleActions = actions.filter(action => !action.hidden)

  if (visibleActions.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button variant={variant} size={size} aria-label="Plus d'options" title="Plus d'options" className={cn("h-7 px-2", className)}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={menuWidth}>
        {visibleActions.map((action, index) => (
          <div key={action.label || `action-${index}`}>
            <DropdownMenuItem
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(action.destructive && "text-destructive focus:text-destructive")}
            >
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </DropdownMenuItem>
            {action.separatorAfter && index < visibleActions.length - 1 && (
              <DropdownMenuSeparator />
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Preset configurations for common use cases
export const createExportActions = (
  onCsv?: () => void,
  onExcel?: () => void,
  onPdf?: () => void
): ActionItem[] => {
  const actions: ActionItem[] = []
  
  if (onCsv) {
    actions.push({
      label: "Exporter CSV",
      onClick: onCsv
    })
  }
  if (onExcel) {
    actions.push({
      label: "Exporter Excel",
      onClick: onExcel
    })
  }
  if (onPdf) {
    actions.push({
      label: "Exporter PDF",
      onClick: onPdf,
      separatorAfter: true
    })
  }
  
  return actions
}
