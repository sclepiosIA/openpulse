import { supabase } from '@/integrations/supabase/client'

/**
 * Services Satisfaction V3 (audit Fable 5 · action 180.1).
 * Centralise les accès `satisfaction_v3_*` pour désaccoupler les pages admin.
 */

export interface SatisfactionV3Response {
  id: string
  campaign_id: string | null
  source: string | null
  dpi: string | null
  etablissement: string | null
  service: string | null
  role: string | null
  satisfaction: number | null
  recommendation: number | null
  comment: string | null
  created_at: string
}

export interface SatisfactionV3Filters {
  source?: string
  etab?: string
  dpi?: string
  service?: string
  campaignId?: string
  from?: string
  to?: string
  commentOnly?: boolean
}

/** Normalise l'échelle historique : le DPI note sur 10, le formulaire public sur 5. */
export const satisfactionOnFive = (value: number | null, source: string | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const normalized = source === 'v3-dpi' ? value / 2 : value
  return Math.max(0, Math.min(5, normalized))
}

type Filterable<T> = {
  eq(column: string, value: unknown): T
  ilike(column: string, pattern: string): T
  gte(column: string, value: string): T
  lte(column: string, value: string): T
  not(column: string, operator: string, value: null): T
}

const applyFilters = <T extends Filterable<T>>(query: T, filters: SatisfactionV3Filters): T => {
  let q = query
  if (filters.source && filters.source !== 'all') q = q.eq('source', filters.source)
  if (filters.dpi && filters.dpi !== 'all') q = q.eq('dpi', filters.dpi)
  if (filters.etab) q = q.ilike('etablissement', `%${filters.etab}%`)
  if (filters.service) q = q.ilike('service', `%${filters.service}%`)
  if (filters.campaignId && filters.campaignId !== 'all')
    q = q.eq('campaign_id', filters.campaignId)
  if (filters.from) q = q.gte('created_at', filters.from)
  if (filters.to) q = q.lte('created_at', filters.to + 'T23:59:59')
  if (filters.commentOnly) q = q.not('comment', 'is', null)
  return q
}

export const fetchSatisfactionCampaignsList = async () => {
  const { data, error } = await supabase
    .from('satisfaction_v3_campaigns')
    .select('id, title')
    .order('title')
  if (error) throw error
  return data ?? []
}

export const fetchSatisfactionResponsesPaged = async (
  filters: SatisfactionV3Filters,
  page: number,
  pageSize: number
): Promise<{ rows: SatisfactionV3Response[]; total: number }> => {
  const q = applyFilters(
    supabase
      .from('satisfaction_v3_responses')
      .select(
        'id, campaign_id, source, dpi, etablissement, service, role, satisfaction, recommendation, comment, created_at',
        { count: 'exact' }
      ) as any,
    filters
  )
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)
  const { data, error, count } = await q
  if (error) throw error
  return { rows: (data as SatisfactionV3Response[]) ?? [], total: count ?? 0 }
}

export const fetchSatisfactionStats = async (
  filters: SatisfactionV3Filters
): Promise<
  Pick<SatisfactionV3Response, 'source' | 'satisfaction' | 'recommendation' | 'created_at'>[]
> => {
  const q = applyFilters(
    supabase
      .from('satisfaction_v3_responses')
      .select('source, satisfaction, recommendation, created_at') as any,
    filters
  ).limit(10000)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export const fetchSatisfactionForExport = async (
  filters: SatisfactionV3Filters
): Promise<SatisfactionV3Response[]> => {
  const q = applyFilters(
    supabase
      .from('satisfaction_v3_responses')
      .select(
        'created_at, source, campaign_id, etablissement, dpi, service, role, satisfaction, recommendation, comment'
      ) as any,
    filters
  )
    .order('created_at', { ascending: false })
    .limit(10000)
  const { data, error } = await q
  if (error) throw error
  return (data as SatisfactionV3Response[]) ?? []
}

// ----- Campaigns admin --------------------------------------------------

export interface SatisfactionCampaign {
  id: string
  title: string | null
  message: string | null
  is_active: boolean | null
  priority: number | null
  target_etablissement: string | null
  target_dpi: string | null
  target_service: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string | null
}

export const fetchSatisfactionCampaigns = async (): Promise<SatisfactionCampaign[]> => {
  const { data, error } = await supabase
    .from('satisfaction_v3_campaigns')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as SatisfactionCampaign[]) ?? []
}

export const fetchSatisfactionCampaignCounts = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabase
    .from('satisfaction_v3_responses')
    .select('campaign_id')
    .limit(10000)
  if (error) throw error
  const map: Record<string, number> = {}
  ;(data ?? []).forEach((r: any) => {
    const k = r.campaign_id ?? ''
    if (k) map[k] = (map[k] ?? 0) + 1
  })
  return map
}

export const fetchSatisfactionEtabOptions = async (): Promise<string[]> => {
  const [respRes, etabRes] = await Promise.all([
    supabase
      .from('satisfaction_v3_responses')
      .select('etablissement')
      .not('etablissement', 'is', null)
      .limit(5000),
    supabase
      .from('etablissements')
      .select('nom')
      .eq('statut', 'Production')
      .order('nom')
      .limit(1000),
  ])
  const set = new Set<string>()
  ;(respRes.data ?? []).forEach((r: any) => {
    if (r.etablissement) set.add(String(r.etablissement))
  })
  ;(etabRes.data ?? []).forEach((r: any) => {
    if (r.nom) set.add(String(r.nom))
  })
  return Array.from(set)
    .filter((s) => s.trim())
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

export const fetchSatisfactionServiceOptions = async (): Promise<string[]> => {
  const { data } = await supabase
    .from('satisfaction_v3_responses')
    .select('service')
    .not('service', 'is', null)
    .limit(5000)
  const set = new Set<string>()
  ;(data ?? []).forEach((r: any) => {
    if (r.service && String(r.service).trim()) set.add(String(r.service).trim())
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
}

export const upsertSatisfactionCampaign = async (
  payload: Record<string, unknown>,
  editingId: string | null
): Promise<void> => {
  if (editingId) {
    const { id: _drop, ...update } = payload as any
    void _drop
    const { error } = await supabase
      .from('satisfaction_v3_campaigns')
      .update(update)
      .eq('id', editingId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('satisfaction_v3_campaigns').insert(payload as any)
    if (error) throw error
  }
}

export const toggleSatisfactionCampaignActive = async (
  campaignId: string,
  isActive: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('satisfaction_v3_campaigns')
    .update({ is_active: isActive })
    .eq('id', campaignId)
  if (error) throw error
}
