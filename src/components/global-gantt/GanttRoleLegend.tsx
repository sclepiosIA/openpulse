import { memo } from 'react'
import { getActiveRoles } from '@/lib/roleColors'

export const GanttRoleLegend = memo(function GanttRoleLegend() {
  const roles = getActiveRoles()
  
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs px-4 py-2 bg-muted/30 rounded-lg border">
      <span className="text-muted-foreground font-medium">Légende des rôles :</span>
      {roles.map(role => (
        <div key={role.key} className="flex items-center gap-1.5">
          <div 
            className="w-3 h-3 rounded-full ring-1 ring-black/10" 
            style={{ backgroundColor: role.hex }} 
          />
          <span className="text-foreground/80">{role.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-muted-foreground/30 ring-1 ring-black/10" />
        <span className="text-foreground/80">Non assigné</span>
      </div>
    </div>
  )
})
