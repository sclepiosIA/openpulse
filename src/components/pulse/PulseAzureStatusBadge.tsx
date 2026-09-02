/**
 * Pulse Azure Collaboration Hub — Lot 1 : badge de statut backend Azure.
 *
 * Affiché dans le header de /pulse. Contrat de non-régression :
 * - mode `supabase` (défaut, flag absent) → rend `null`, zéro impact UI ;
 * - mode `azure`/`hybrid` → petit badge diagnostic (mode + santé API)
 *   avec tooltip détaillant la config résolue.
 */

import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  usePulseAzureStatus,
  type UsePulseAzureStatusOptions,
} from '@/hooks/pulse/usePulseAzureStatus'

export interface PulseAzureStatusBadgeProps {
  /** Overrides pour tests/storybook. */
  statusOptions?: UsePulseAzureStatusOptions
  className?: string
}

export function PulseAzureStatusBadge({ statusOptions, className }: PulseAzureStatusBadgeProps) {
  const { config, health, isHealthLoading, isHealthError } = usePulseAzureStatus(statusOptions)

  // Mode supabase pur : composant invisible, /pulse inchangé.
  if (!config.azureEnabled) return null

  const apiConfigured = Boolean(config.apiBaseUrl)
  const healthy = health?.status === 'ok'
  const degraded = health?.status === 'degraded'

  let label: string
  let dotClass: string
  if (!apiConfigured) {
    label = 'API non configurée'
    dotClass = 'bg-amber-400'
  } else if (isHealthLoading) {
    label = 'Vérification…'
    dotClass = 'bg-slate-300'
  } else if (isHealthError || health?.status === 'down') {
    label = 'API injoignable'
    dotClass = 'bg-red-500'
  } else if (degraded) {
    label = 'API dégradée'
    dotClass = 'bg-amber-400'
  } else if (healthy) {
    label = 'API opérationnelle'
    dotClass = 'bg-emerald-400'
  } else {
    label = 'Statut inconnu'
    dotClass = 'bg-slate-300'
  }

  const Icon = !apiConfigured || isHealthError ? CloudOff : Cloud

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-testid="pulse-azure-status-badge"
            className={cn(
              'hidden sm:flex items-center gap-1.5 h-8 px-2 rounded-lg',
              'bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 text-[10px] font-medium',
              className
            )}
            aria-label={`Backend Pulse : ${config.mode} — ${label}`}
          >
            {isHealthLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Icon className="h-3 w-3" aria-hidden />
            )}
            <span className="uppercase tracking-wide">{config.mode}</span>
            <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <div className="space-y-1">
            <p className="font-semibold">Pulse — backend {config.mode}</p>
            <p>{label}</p>
            <p className="text-muted-foreground break-all">
              API : {config.apiBaseUrl ?? 'non configurée'}
            </p>
            <p className="text-muted-foreground break-all">
              WS : {config.wsUrl ?? 'non configuré'}
            </p>
            {config.fallbackApplied && (
              <p className="text-amber-500">
                Flag VITE_PULSE_BACKEND invalide ({config.rawMode}) — repli supabase.
              </p>
            )}
            {config.mode === 'hybrid' && (
              <p className="text-muted-foreground">
                Conversations/messages : Supabase · IA/recherche/notifs : Azure.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
