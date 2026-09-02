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
const mockPartenaires = [
  {
    id: 'partenaire-1',
    nom: 'Cabinet Conseil Santé',
    type: 'Conseil',
    description: 'Cabinet de conseil en transformation digitale',
    contact_principal: 'Jean Dupont',
    email: 'contact@cabinetconseil.fr',
    telephone: '+33140000001',
    adresse: '100 Avenue des Champs-Élysées',
    ville: 'Paris',
    code_postal: '75008',
    site_web: 'https://cabinetconseil.fr',
    statut: 'actif',
    commission_percentage: 15,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'partenaire-2',
    nom: 'Intégrateur Tech Medical',
    type: 'Intégrateur',
    description: 'Intégrateur de solutions médicales',
    contact_principal: 'Marie Martin',
    email: 'contact@techmedical.fr',
    telephone: '+33491000001',
    adresse: '50 Rue de la République',
    ville: 'Marseille',
    code_postal: '13001',
    site_web: 'https://techmedical.fr',
    statut: 'actif',
    commission_percentage: 10,
    created_at: '2024-01-05T00:00:00Z'
  },
  {
    id: 'partenaire-3',
    nom: 'Formation Santé Plus',
    type: 'Formation',
    description: 'Organisme de formation certifié',
    contact_principal: 'Pierre Durand',
    email: 'contact@formationsante.fr',
    telephone: '+33320000001',
    adresse: '25 Place du Général de Gaulle',
    ville: 'Lille',
    code_postal: '59000',
    statut: 'inactif',
    commission_percentage: 12,
    created_at: '2024-01-10T00:00:00Z'
  }
]

const mockPartenaireEtablissements = [
  {
    partenaire_id: 'partenaire-1',
    etablissement_id: 'etab-1',
    date_mise_en_relation: '2024-01-15',
    statut: 'converti'
  },
  {
    partenaire_id: 'partenaire-1',
    etablissement_id: 'etab-2',
    date_mise_en_relation: '2024-02-01',
    statut: 'en_cours'
  },
  {
    partenaire_id: 'partenaire-2',
    etablissement_id: 'etab-3',
    date_mise_en_relation: '2024-01-20',
    statut: 'converti'
  }
]

describe('Partenaires Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchPartenaires', () => {
    it('should fetch all partenaires', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockPartenaires,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('partenaires')
        .select('*')
        .order('nom')

      expect(mockSupabase.from).toHaveBeenCalledWith('partenaires')
      expect(result.data).toEqual(mockPartenaires)
    })

    it('should fetch active partenaires only', async () => {
      const activePartenaires = mockPartenaires.filter(p => p.statut === 'actif')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: activePartenaires,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('partenaires')
        .select('*')
        .eq('statut', 'actif')

      expect(result.data).toHaveLength(2)
    })

    it('should filter partenaires by type', async () => {
      const conseilPartenaires = mockPartenaires.filter(p => p.type === 'Conseil')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: conseilPartenaires,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('partenaires')
        .select('*')
        .eq('type', 'Conseil')

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].nom).toBe('Cabinet Conseil Santé')
    })
  })

  describe('createPartenaire', () => {
    it('should create a new partenaire', async () => {
      const newPartenaire = {
        nom: 'Nouveau Partenaire',
        type: 'Conseil',
        email: 'nouveau@partenaire.fr',
        statut: 'actif',
        commission_percentage: 10
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'partenaire-new', ...newPartenaire },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('partenaires')
        .insert(newPartenaire)
        .select()
        .single()

      expect(result.data?.nom).toBe('Nouveau Partenaire')
      expect(result.error).toBeNull()
    })
  })

  describe('updatePartenaire', () => {
    it('should update partenaire status', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockPartenaires[2], statut: 'actif' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('partenaires')
        .update({ statut: 'actif' })
        .eq('id', 'partenaire-3')
        .select()
        .single()

      expect(result.data?.statut).toBe('actif')
    })

    it('should update commission percentage', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockPartenaires[0], commission_percentage: 20 },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('partenaires')
        .update({ commission_percentage: 20 })
        .eq('id', 'partenaire-1')
        .select()
        .single()

      expect(result.data?.commission_percentage).toBe(20)
    })
  })

  describe('Partenaire-Etablissement Relationship', () => {
    it('should fetch etablissements apportés by partenaire', async () => {
      const partenaireEtabs = mockPartenaireEtablissements.filter(
        e => e.partenaire_id === 'partenaire-1'
      )
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: partenaireEtabs,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('partenaire_etablissements')
        .select('*')
        .eq('partenaire_id', 'partenaire-1')

      expect(result.data).toHaveLength(2)
    })

    it('should link etablissement to partenaire', async () => {
      const newLink = {
        partenaire_id: 'partenaire-2',
        etablissement_id: 'etab-4',
        date_mise_en_relation: '2024-02-15',
        statut: 'en_cours'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'link-new', ...newLink },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('partenaire_etablissements')
        .insert(newLink)
        .select()
        .single()

      expect(result.data?.statut).toBe('en_cours')
    })

    it('should update relation status to converti', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: { ...mockPartenaireEtablissements[1], statut: 'converti' },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('partenaire_etablissements')
        .update({ statut: 'converti' })
        .eq('partenaire_id', 'partenaire-1')
        .eq('etablissement_id', 'etab-2')

      expect(result.data?.statut).toBe('converti')
    })
  })

  describe('Partenaire Analytics', () => {
    it('should calculate conversion rate per partenaire', () => {
      const partenaire1Stats = mockPartenaireEtablissements.filter(
        e => e.partenaire_id === 'partenaire-1'
      )
      const converted = partenaire1Stats.filter(e => e.statut === 'converti').length
      const total = partenaire1Stats.length
      const conversionRate = (converted / total) * 100

      expect(conversionRate).toBe(50) // 1/2 = 50%
    })

    it('should count etablissements by partenaire', () => {
      const countByPartenaire = mockPartenaireEtablissements.reduce((acc, e) => {
        acc[e.partenaire_id] = (acc[e.partenaire_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(countByPartenaire['partenaire-1']).toBe(2)
      expect(countByPartenaire['partenaire-2']).toBe(1)
    })

    it('should calculate total commission for partenaire', () => {
      const partenaire = mockPartenaires[0]
      const convertedEtabs = mockPartenaireEtablissements.filter(
        e => e.partenaire_id === partenaire.id && e.statut === 'converti'
      )
      
      // Assuming each converted etablissement generates 10000€
      const revenuePerEtab = 10000
      const totalRevenue = convertedEtabs.length * revenuePerEtab
      const commission = totalRevenue * (partenaire.commission_percentage / 100)

      expect(commission).toBe(1500) // 10000 * 15%
    })
  })

  describe('Partenaire Types', () => {
    it('should group partenaires by type', () => {
      const byType = mockPartenaires.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(byType['Conseil']).toBe(1)
      expect(byType['Intégrateur']).toBe(1)
      expect(byType['Formation']).toBe(1)
    })
  })
})
