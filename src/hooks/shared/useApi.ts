/**
 * Hooks pour le Module 10: API Publique & Marketplace
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useAuth } from '@/components/AuthProvider'
import type {
  ApiKey,
  ApiLog,
  Webhook,
  WebhookLog,
  OAuthApp,
  OAuthToken,
  MarketplaceConnector,
  ConnectorInstallation,
  ApiStats,
  ApiPermission,
  WebhookEvent,
  OAuthScope,
  ConnectorCategory,
} from '@/types/api'

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ===== API KEYS =====

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select(
          'id, nom, description, key_prefix, est_active, permissions, rate_limit_per_minute, rate_limit_per_day, expires_at, created_at, revoked_at, last_used_at, total_requests, created_by'
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ApiKey[]
    },
  })
}

export function useCreateApiKey() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (apiKey: {
      nom: string
      description?: string
      permissions: ApiPermission[]
      rate_limit_per_minute?: number
      rate_limit_per_day?: number
      expires_at?: string
    }) => {
      // Generate a random API key
      const keyValue = `sk_live_${crypto.randomUUID().replace(/-/g, '')}`
      const keyPrefix = keyValue.substring(0, 12)

      // SHA-256 hash (irreversible)
      const keyHash = await sha256Hex(keyValue)

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          nom: apiKey.nom,
          description: apiKey.description,
          permissions: apiKey.permissions as unknown as Json,
          rate_limit_per_minute: apiKey.rate_limit_per_minute,
          rate_limit_per_day: apiKey.rate_limit_per_day,
          expires_at: apiKey.expires_at,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          created_by: user?.id ?? '',
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error

      // Return the full key only once (won't be stored)
      return { ...data, full_key: keyValue }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast({ title: 'Clé API créée avec succès' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

export function useRevokeApiKey() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('api_keys')
        .update({
          est_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id,
        })
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast({ title: 'Clé API révoquée' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

// ===== API LOGS =====

export function useApiLogs(limit = 100) {
  return useQuery({
    queryKey: ['api-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_logs')
        .select(
          `
          *,
          api_key:api_keys(nom, key_prefix)
        `
        )
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as ApiLog[]
    },
  })
}

// ===== WEBHOOKS =====

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select(
          'id, nom, url, events, secret, est_actif, retry_count, timeout_seconds, headers, created_at, created_by'
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Webhook[]
    },
  })
}

export function useCreateWebhook() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (webhook: {
      nom: string
      url: string
      events: WebhookEvent[]
      retry_count?: number
      timeout_seconds?: number
      headers?: Record<string, string>
    }) => {
      // Generate webhook secret
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`

      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          nom: webhook.nom,
          url: webhook.url,
          events: webhook.events,
          retry_count: webhook.retry_count,
          timeout_seconds: webhook.timeout_seconds,
          headers: (webhook.headers ?? {}) as unknown as Json,
          secret,
          created_by: user?.id ?? '',
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return { ...data, secret }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast({ title: 'Webhook créé avec succès' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Webhook> & { id: string }) => {
      const { data, error } = await supabase
        .from('webhooks')
        .update(updates)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast({ title: 'Webhook mis à jour' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast({ title: 'Webhook supprimé' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

export function useWebhookLogs(webhookId: string) {
  return useQuery({
    queryKey: ['webhook-logs', webhookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select(
          'id, webhook_id, event_type, payload, response_status, response_body, error_message, duration_ms, created_at'
        )
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as WebhookLog[]
    },
    enabled: !!webhookId,
  })
}

// ===== OAUTH APPS =====

export function useOAuthApps() {
  return useQuery({
    queryKey: ['oauth-apps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oauth_apps')
        .select(
          'id, nom, description, client_id, redirect_uris, scopes, logo_url, website_url, privacy_policy_url, est_active, created_at, created_by'
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as OAuthApp[]
    },
  })
}

export function useCreateOAuthApp() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (app: {
      nom: string
      description?: string
      redirect_uris: string[]
      scopes: OAuthScope[]
      logo_url?: string
      website_url?: string
      privacy_policy_url?: string
    }) => {
      // Generate client credentials
      const clientId = `client_${crypto.randomUUID().replace(/-/g, '')}`
      const clientSecret = `secret_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
      const clientSecretHash = await sha256Hex(clientSecret)

      const { data, error } = await supabase
        .from('oauth_apps')
        .insert({
          nom: app.nom,
          description: app.description,
          redirect_uris: app.redirect_uris,
          scopes: app.scopes,
          logo_url: app.logo_url,
          website_url: app.website_url,
          privacy_policy_url: app.privacy_policy_url,
          client_id: clientId,
          client_secret_hash: clientSecretHash,
          created_by: user?.id ?? '',
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return { ...data, client_secret: clientSecret }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-apps'] })
      toast({ title: 'Application OAuth créée' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

// ===== USER OAUTH TOKENS =====

export function useMyOAuthTokens() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-oauth-tokens'],
    queryFn: async () => {
      if (!user) throw new Error('Non authentifié')

      const { data, error } = await supabase
        .from('oauth_tokens')
        .select(
          `
          *,
          oauth_app:oauth_apps(nom, logo_url)
        `
        )
        .eq('user_id', user.id)
        .is('revoked_at', null)

      if (error) throw error
      return data as OAuthToken[]
    },
  })
}

export function useRevokeOAuthToken() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('oauth_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-oauth-tokens'] })
      toast({ title: 'Accès révoqué' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

// ===== MARKETPLACE =====

export function useMarketplaceConnectors(category?: ConnectorCategory) {
  return useQuery({
    queryKey: ['marketplace-connectors', category],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_connectors')
        .select(
          'id, nom, slug, description, description_longue, categorie, logo_url, documentation_url, developer_name, developer_url, prix_mensuel, prix_type, est_actif, est_certifie, nombre_installations, note_moyenne, configuration_schema, created_at, updated_at'
        )
        .eq('est_actif', true)
        .order('nombre_installations', { ascending: false })

      if (category) {
        query = query.eq('categorie', category)
      }

      const { data, error } = await query
      if (error) throw error
      return data as MarketplaceConnector[]
    },
  })
}

export function useMyConnectorInstallations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-connector-installations'],
    queryFn: async () => {
      if (!user) throw new Error('Non authentifié')

      const { data, error } = await supabase
        .from('connector_installations')
        .select(
          `
          *,
          connector:marketplace_connectors(*)
        `
        )
        .eq('installed_by', user.id)

      if (error) throw error
      return data as ConnectorInstallation[]
    },
  })
}

export function useInstallConnector() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Type strict pour la configuration de connecteur
  interface ConnectorConfiguration {
    api_key?: string
    webhook_url?: string
    sync_interval?: number
    enabled_features?: string[]
    [key: string]: string | number | boolean | string[] | undefined
  }

  return useMutation({
    mutationFn: async ({
      connector_id,
      configuration,
    }: {
      connector_id: string
      configuration?: ConnectorConfiguration
    }) => {
      if (!user) throw new Error('Non authentifié')

      const { data, error } = await supabase
        .from('connector_installations')
        .insert({
          connector_id,
          installed_by: user.id,
          configuration: configuration || {},
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-connector-installations'] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-connectors'] })
      toast({ title: 'Connecteur installé' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

export function useUninstallConnector() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('connector_installations').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-connector-installations'] })
      toast({ title: 'Connecteur désinstallé' })
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    },
  })
}

// ===== API STATS =====

export function useApiStats() {
  return useQuery({
    queryKey: ['api-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

      const [
        todayLogsRes,
        monthLogsRes,
        activeKeysRes,
        activeWebhooksRes,
        installationsRes,
        errorLogsRes,
      ] = await Promise.all([
        supabase
          .from('api_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', today),
        supabase
          .from('api_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', monthStart),
        supabase
          .from('api_keys')
          .select('id', { count: 'exact', head: true })
          .eq('est_active', true),
        supabase
          .from('webhooks')
          .select('id', { count: 'exact', head: true })
          .eq('est_actif', true),
        supabase
          .from('connector_installations')
          .select('id', { count: 'exact', head: true })
          .eq('est_active', true),
        supabase
          .from('api_logs')
          .select('id', { count: 'exact', head: true })
          .gte('status_code', 400)
          .gte('created_at', today),
      ])

      // Calculate average response time
      const { data: timingData } = await supabase
        .from('api_logs')
        .select('duration_ms')
        .not('duration_ms', 'is', null)
        .gte('created_at', today)
        .limit(100)

      const avgTime =
        timingData && timingData.length > 0
          ? timingData.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / timingData.length
          : 0

      const totalToday = todayLogsRes.count || 0
      const errorsToday = errorLogsRes.count || 0
      const errorRate = totalToday > 0 ? (errorsToday / totalToday) * 100 : 0

      return {
        total_requests_today: totalToday,
        total_requests_month: monthLogsRes.count || 0,
        active_api_keys: activeKeysRes.count || 0,
        active_webhooks: activeWebhooksRes.count || 0,
        installed_connectors: installationsRes.count || 0,
        avg_response_time_ms: Math.round(avgTime),
        error_rate: Math.round(errorRate * 100) / 100,
      } as ApiStats
    },
  })
}
