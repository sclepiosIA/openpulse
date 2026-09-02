import { cn } from '@/lib/utils'
import type { JalonStatut } from '@/types/csm'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  done: { label: 'Fait', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  planned: { label: 'Planifié', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  planning: { label: 'En cours de planification', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  pending: { label: 'En attente', className: 'bg-gray-100 text-muted-foreground border-gray-200' },
  skipped: { label: 'Non réalisé', className: 'bg-rose-50 text-rose-600 border-rose-200' },
  '': { label: '-', className: 'bg-transparent text-muted-foreground' },
}

interface StatusBadgeProps {
  status: JalonStatut
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['']
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
      config.className,
      className
    )}>
      {config.label}
    </span>
  )
}
