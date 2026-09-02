import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type ITAssetCategory =
  | 'laptop'
  | 'desktop'
  | 'phone'
  | 'tablet'
  | 'monitor'
  | 'headset'
  | 'printer'
  | 'network'
  | 'server'
  | 'peripheral'
  | 'other'
export type ITAssetStatus =
  | 'in_stock'
  | 'assigned'
  | 'in_repair'
  | 'lost'
  | 'stolen'
  | 'decommissioned'
export type ITLicenseBillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'one_time'

export interface ITAsset {
  id: string
  category: ITAssetCategory
  brand: string | null
  model: string
  serial_number: string | null
  status: ITAssetStatus
  purchase_date: string | null
  purchase_price: number | null
  supplier: string | null
  invoice_ref: string | null
  warranty_end: string | null
  assigned_to_profile_id: string | null
  assigned_at: string | null
  location: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ITLicense {
  id: string
  name: string
  vendor: string | null
  description: string | null
  seats_total: number
  cost_amount: number | null
  billing_cycle: ITLicenseBillingCycle
  renewal_date: string | null
  auto_renew: boolean
  contract_ref: string | null
  notes: string | null
  tags: string[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface ITLicenseAssignment {
  id: string
  license_id: string
  profile_id: string
  assigned_at: string
  revoked_at: string | null
  notes: string | null
}

export interface ITRenewalRow {
  kind: 'license' | 'warranty'
  id: string
  label: string
  vendor: string | null
  due_date: string
  amount: number | null
  days_until: number
  category: ITAssetCategory | null
}

export function useITAssets() {
  return useQuery({
    queryKey: ['it_assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_assets')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return (data ?? []) as ITAsset[]
    },
  })
}

export function useUpsertITAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ITAsset> & { model: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('it_assets').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('it_assets').insert(payload as never)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it_assets'] }),
  })
}

export function useDeleteITAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_assets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it_assets'] }),
  })
}

export function useITLicenses() {
  return useQuery({
    queryKey: ['it_software_licenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('it_software_licenses')
        .select('*')
        .order('renewal_date', { ascending: true, nullsFirst: false })
        .limit(1000)
      if (error) throw error
      return (data ?? []) as ITLicense[]
    },
  })
}

export function useUpsertITLicense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ITLicense> & { name: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload
        const { error } = await supabase.from('it_software_licenses').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('it_software_licenses').insert(payload as never)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it_software_licenses'] }),
  })
}

export function useDeleteITLicense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('it_software_licenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it_software_licenses'] }),
  })
}

export function useLicenseAssignments(licenseId?: string) {
  return useQuery({
    queryKey: ['it_license_assignments', licenseId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('it_license_assignments').select('*').is('revoked_at', null)
      if (licenseId) q = q.eq('license_id', licenseId)
      const { data, error } = await q.limit(2000)
      if (error) throw error
      return (data ?? []) as ITLicenseAssignment[]
    },
  })
}

export function useAssignLicense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { license_id: string; profile_id: string; notes?: string }) => {
      const { error } = await supabase.from('it_license_assignments').insert(payload as never)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it_license_assignments'] }),
  })
}

export function useRevokeLicense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('it_license_assignments')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['it_license_assignments'] }),
  })
}

export function useITRenewals() {
  return useQuery({
    queryKey: ['v_it_renewals_upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_it_renewals_upcoming')
        .select('*')
        .order('due_date', { ascending: true })
        .limit(200)
      if (error) throw error
      return (data ?? []) as ITRenewalRow[]
    },
  })
}
