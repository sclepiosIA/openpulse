/**
 * Pulse Azure Collaboration Hub — Lot 1 : hook diagnostic backend Azure.
 *
 * Expose la config résolue (`VITE_PULSE_BACKEND`) et, si Azure est actif,
 * interroge `GET /healthz` de la Pulse API via react-query. En mode
 * `supabase` (défaut), aucune requête n'est émise (query disabled).
 */

import { useQuery } from '@tanstack/react-query'
import { getPulseAzureConfig, type PulseAzureConfig } from '@/lib/pulse/azureBackend'
import { getPulseAzureApiClient, type PulseAzureApiClient } from '@/lib/pulse/azureApiClient'
import type { AzurePulseHealth } from '@/types/pulse-azure'

export const pulseAzureKeys = {
  all: ['pulse-azure'] as const,
  health: () => [...pulseAzureKeys.all, 'health'] as const,
}

export interface PulseAzureStatus {
  config: PulseAzureConfig
  health: AzurePulseHealth | null
  isHealthLoading: boolean
  isHealthError: boolean
  healthError: unknown
  refetchHealth: () => void
}

export interface UsePulseAzureStatusOptions {
  /** Overrides pour les tests. */
  config?: PulseAzureConfig
  client?: PulseAzureApiClient
  /** Intervalle de refresh santé en ms (défaut : 60s). */
  refetchIntervalMs?: number
}

export function usePulseAzureStatus(options: UsePulseAzureStatusOptions = {}): PulseAzureStatus {
  const config = options.config ?? getPulseAzureConfig()
  const client = options.client ?? getPulseAzureApiClient()

  const azureReady = config.azureEnabled && Boolean(config.apiBaseUrl)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: pulseAzureKeys.health(),
    queryFn: () => client.health(),
    enabled: azureReady,
    staleTime: 30_000,
    refetchInterval: options.refetchIntervalMs ?? 60_000,
    retry: 1,
  })

  return {
    config,
    health: data ?? null,
    isHealthLoading: azureReady && isLoading,
    isHealthError: isError,
    healthError: error,
    refetchHealth: () => {
      void refetch()
    },
  }
}
