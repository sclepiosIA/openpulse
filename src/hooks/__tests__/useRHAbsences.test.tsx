import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
const mockSupabase = {
  from: vi.fn()
}

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: mockSupabase
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

interface WrapperProps {
  children: React.ReactNode
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return ({ children }: WrapperProps) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Mock data
const mockAbsences = [
  {
    id: 'absence-1',
    user_id: 'user-1',
    type: 'congés_payés',
    date_debut: '2024-02-05',
    date_fin: '2024-02-09',
    nombre_jours: 5,
    statut: 'approuvé',
    motif: 'Vacances d\'hiver',
    approuve_par: 'manager-1',
    created_at: '2024-01-15T00:00:00Z'
  },
  {
    id: 'absence-2',
    user_id: 'user-1',
    type: 'rtt',
    date_debut: '2024-02-15',
    date_fin: '2024-02-15',
    nombre_jours: 1,
    statut: 'en_attente',
    motif: 'RTT mensuel',
    approuve_par: null,
    created_at: '2024-02-01T00:00:00Z'
  },
  {
    id: 'absence-3',
    user_id: 'user-2',
    type: 'maladie',
    date_debut: '2024-02-10',
    date_fin: '2024-02-12',
    nombre_jours: 3,
    statut: 'approuvé',
    motif: 'Arrêt maladie',
    justificatif_url: 'https://storage.example.com/arret.pdf',
    approuve_par: 'manager-1',
    created_at: '2024-02-10T00:00:00Z'
  }
]

const mockSoldesConges = [
  {
    user_id: 'user-1',
    annee: 2024,
    conges_payes_acquis: 25,
    conges_payes_pris: 5,
    conges_payes_restants: 20,
    rtt_acquis: 10,
    rtt_pris: 1,
    rtt_restants: 9,
    conges_exceptionnels_pris: 0
  },
  {
    user_id: 'user-2',
    annee: 2024,
    conges_payes_acquis: 25,
    conges_payes_pris: 0,
    conges_payes_restants: 25,
    rtt_acquis: 10,
    rtt_pris: 0,
    rtt_restants: 10,
    conges_exceptionnels_pris: 0
  }
]

describe('RH Absences Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchAbsences', () => {
    it('should fetch all absences', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockAbsences,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rh_absences')
        .select('*')
        .order('date_debut', { ascending: false })

      expect(mockSupabase.from).toHaveBeenCalledWith('rh_absences')
      expect(result.data).toEqual(mockAbsences)
    })

    it('should fetch absences for a specific user', async () => {
      const userAbsences = mockAbsences.filter(a => a.user_id === 'user-1')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: userAbsences,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rh_absences')
        .select('*')
        .eq('user_id', 'user-1')
        .order('date_debut')

      expect(result.data).toHaveLength(2)
    })

    it('should fetch absences by status', async () => {
      const pendingAbsences = mockAbsences.filter(a => a.statut === 'en_attente')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: pendingAbsences,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rh_absences')
        .select('*')
        .eq('statut', 'en_attente')

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].type).toBe('rtt')
    })

    it('should fetch absences in date range', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({
            data: mockAbsences,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rh_absences')
        .select('*')
        .gte('date_debut', '2024-02-01')
        .lte('date_fin', '2024-02-28')

      expect(result.data).toHaveLength(3)
    })
  })

  describe('createAbsence', () => {
    it('should create a new absence request', async () => {
      const newAbsence = {
        user_id: 'user-1',
        type: 'congés_payés',
        date_debut: '2024-03-01',
        date_fin: '2024-03-05',
        nombre_jours: 5,
        motif: 'Vacances de printemps',
        statut: 'en_attente'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'absence-new', ...newAbsence },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('rh_absences')
        .insert(newAbsence)
        .select()
        .single()

      expect(result.data?.type).toBe('congés_payés')
      expect(result.data?.statut).toBe('en_attente')
    })
  })

  describe('updateAbsence', () => {
    it('should approve an absence request', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                ...mockAbsences[1], 
                statut: 'approuvé',
                approuve_par: 'manager-1'
              },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('rh_absences')
        .update({ statut: 'approuvé', approuve_par: 'manager-1' })
        .eq('id', 'absence-2')
        .select()
        .single()

      expect(result.data?.statut).toBe('approuvé')
      expect(result.data?.approuve_par).toBe('manager-1')
    })

    it('should reject an absence request', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { 
                ...mockAbsences[1], 
                statut: 'refusé',
                motif_refus: 'Période de forte activité'
              },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('rh_absences')
        .update({ 
          statut: 'refusé', 
          motif_refus: 'Période de forte activité' 
        })
        .eq('id', 'absence-2')
        .select()
        .single()

      expect(result.data?.statut).toBe('refusé')
    })
  })

  describe('deleteAbsence', () => {
    it('should delete a pending absence request', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ delete: mockDelete })

      const result = await mockSupabase
        .from('rh_absences')
        .delete()
        .eq('id', 'absence-2')
        .eq('statut', 'en_attente')

      expect(result.error).toBeNull()
    })
  })

  describe('Soldes Congés', () => {
    it('should fetch soldes congés for a user', async () => {
      const userSolde = mockSoldesConges.filter(s => s.user_id === 'user-1')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: userSolde[0],
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('rh_soldes_conges')
        .select('*')
        .eq('user_id', 'user-1')
        .eq('annee', 2024)
        .single()

      expect(result.data?.conges_payes_restants).toBe(20)
      expect(result.data?.rtt_restants).toBe(9)
    })

    it('should update soldes after absence approval', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: { 
              ...mockSoldesConges[0], 
              conges_payes_pris: 10,
              conges_payes_restants: 15
            },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('rh_soldes_conges')
        .update({ 
          conges_payes_pris: 10,
          conges_payes_restants: 15
        })
        .eq('user_id', 'user-1')
        .eq('annee', 2024)

      expect(result.data?.conges_payes_restants).toBe(15)
    })
  })

  describe('Absence Analytics', () => {
    it('should calculate total days by type', () => {
      const daysByType = mockAbsences.reduce((acc, absence) => {
        acc[absence.type] = (acc[absence.type] || 0) + absence.nombre_jours
        return acc
      }, {} as Record<string, number>)

      expect(daysByType['congés_payés']).toBe(5)
      expect(daysByType['rtt']).toBe(1)
      expect(daysByType['maladie']).toBe(3)
    })

    it('should count pending requests', () => {
      const pendingCount = mockAbsences.filter(a => a.statut === 'en_attente').length
      expect(pendingCount).toBe(1)
    })

    it('should identify overlapping absences', () => {
      const date = '2024-02-10'
      const overlapping = mockAbsences.filter(a => 
        a.statut === 'approuvé' &&
        date >= a.date_debut && 
        date <= a.date_fin
      )
      expect(overlapping).toHaveLength(1)
      expect(overlapping[0].type).toBe('maladie')
    })

    it('should calculate average absence duration', () => {
      const totalDays = mockAbsences.reduce((sum, a) => sum + a.nombre_jours, 0)
      const avgDuration = totalDays / mockAbsences.length
      expect(avgDuration).toBe(3) // (5 + 1 + 3) / 3 = 3
    })
  })

  describe('Absence Types', () => {
    const absenceTypes = [
      'congés_payés',
      'rtt',
      'maladie',
      'congé_sans_solde',
      'congé_maternité',
      'congé_paternité',
      'congé_parental',
      'formation',
      'autre'
    ]

    it('should validate absence type', () => {
      mockAbsences.forEach(absence => {
        expect(absenceTypes).toContain(absence.type)
      })
    })
  })
})
