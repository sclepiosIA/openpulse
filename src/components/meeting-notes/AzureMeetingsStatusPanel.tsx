/**
 * Panneau de statut du socle Meetings Azure (lot 1 du plan
 * Gestion Visio/Transcription Azure).
 *
 * Rendu conditionnel strict : renvoie `null` quand les deux backends sont
 * `supabase` (défaut) — aucun impact visuel ni réseau sur /meeting-notes
 * tant que les flags VITE_VISIO_BACKEND / VITE_TRANSCRIPTION_BACKEND ne
 * sont pas activés.
 */

import { Cloud, CloudOff, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAzureMeetingsStatus } from '@/hooks/meeting/useAzureMeetingsStatus'
import type { MeetingsBackend } from '@/config/meetingsBackend'

const BACKEND_LABELS: Record<MeetingsBackend, string> = {
  supabase: 'Supabase',
  azure: 'Azure',
  hybrid: 'Hybride',
}

function backendBadgeVariant(backend: MeetingsBackend): 'secondary' | 'default' | 'outline' {
  if (backend === 'azure') return 'default'
  if (backend === 'hybrid') return 'outline'
  return 'secondary'
}

function healthLabel(status?: 'ok' | 'degraded' | 'down'): { label: string; className: string } {
  switch (status) {
    case 'ok':
      return {
        label: 'API Azure opérationnelle',
        className: 'text-emerald-600 dark:text-emerald-400',
      }
    case 'degraded':
      return { label: 'API Azure dégradée', className: 'text-amber-600 dark:text-amber-400' }
    case 'down':
      return { label: 'API Azure injoignable', className: 'text-destructive' }
    default:
      return { label: 'Statut API Azure inconnu', className: 'text-muted-foreground' }
  }
}

export function AzureMeetingsStatusPanel() {
  const status = useAzureMeetingsStatus()

  // Mode 100 % Supabase : panneau invisible, comportement historique intact.
  if (!status.azureEnabled) return null

  const health = healthLabel(status.health?.status)

  return (
    <Card data-testid="azure-meetings-status-panel" className="mb-4">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            {status.apiConfigured ? (
              <Cloud className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <CloudOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="font-medium">Socle Meetings Azure</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Visio</span>
            <Badge variant={backendBadgeVariant(status.visioBackend)}>
              {BACKEND_LABELS[status.visioBackend]}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Transcription</span>
            <Badge variant={backendBadgeVariant(status.transcriptionBackend)}>
              {BACKEND_LABELS[status.transcriptionBackend]}
            </Badge>
          </div>

          {status.apiConfigured ? (
            <div className="flex items-center gap-2">
              {status.isChecking && (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span className={health.className}>{health.label}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              API Meetings non configurée (VITE_MEETINGS_API_BASE_URL)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
