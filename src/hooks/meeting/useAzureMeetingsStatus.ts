/**
 * Statut du socle Meetings Azure pour le panneau `/meeting-notes` (lot 1).
 *
 * Comportement par backend :
 * - `supabase` (défaut) : hook inerte (`enabled: false`), zéro appel réseau,
 *   panneau masqué — l'existant est strictement inchangé.
 * - `azure` / `hybrid` : sonde `/api/meetings/health` (si base URL définie)
 *   et expose backend + joignabilité pour affichage.
 */

import { useQuery } from '@tanstack/react-query'
import {
  canReachAzureMeetingsApi,
  getMeetingsApiBaseUrl,
  getTranscriptionBackend,
  getVisioBackend,
  isAzureMeetingsEnabled,
  type MeetingsBackend,
} from '@/config/meetingsBackend'
import { fetchAzureMeetingsHealth } from '@/services/meetings/azureMeetingsApi'
import type { AzureMeetingsHealth } from '@/types/meetingsAzure'

export interface AzureMeetingsStatus {
  /** Backend visio effectif (flag build-time). */
  visioBackend: MeetingsBackend
  /** Backend transcription effectif (flag build-time). */
  transcriptionBackend: MeetingsBackend
  /** Au moins un domaine en azure|hybrid. */
  azureEnabled: boolean
  /** Flag activé ET base URL configurée. */
  apiConfigured: boolean
  apiBaseUrl: string
  /** Résultat du health check (undefined tant que non sondé). */
  health?: AzureMeetingsHealth
  isChecking: boolean
}

export const AZURE_MEETINGS_STATUS_QUERY_KEY = ['azure-meetings-status'] as const

export function useAzureMeetingsStatus(): AzureMeetingsStatus {
  const azureEnabled = isAzureMeetingsEnabled()
  const apiConfigured = canReachAzureMeetingsApi()

  const { data: health, isFetching } = useQuery({
    queryKey: AZURE_MEETINGS_STATUS_QUERY_KEY,
    queryFn: fetchAzureMeetingsHealth,
    // Panneau informatif : pas de retry agressif ni de refetch au focus.
    enabled: apiConfigured,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return {
    visioBackend: getVisioBackend(),
    transcriptionBackend: getTranscriptionBackend(),
    azureEnabled,
    apiConfigured,
    apiBaseUrl: getMeetingsApiBaseUrl(),
    health,
    isChecking: isFetching,
  }
}
