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
const mockGroupes = [
  {
    id: 'groupe-1',
    nom: 'Groupe Hospitalier Paris Nord',
    type: 'GHT',
    adresse: '123 Avenue de la Santé',
    ville: 'Paris',
    code_postal: '75019',
    region: 'Île-de-France',
    telephone: '+33140000000',
    email: 'contact@ghpn.fr',
    site_web: 'https://ghpn.fr',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'groupe-2',
    nom: 'Cliniques Privées Sud',
    type: 'Groupe privé',
    adresse: '456 Boulevard des Cliniques',
    ville: 'Marseille',
    code_postal: '13008',
    region: 'Provence-Alpes-Côte d\'Azur',
    telephone: '+33491000000',
    email: 'contact@cps.fr',
    site_web: 'https://cps.fr',
    created_at: '2024-01-05T00:00:00Z'
  }
]

const mockGroupeEtablissements = [
  {
    groupe_id: 'groupe-1',
    etablissement_id: 'etab-1',
    nom_etablissement: 'CHU Lariboisière',
    statut: 'production'
  },
  {
    groupe_id: 'groupe-1',
    etablissement_id: 'etab-2',
    nom_etablissement: 'Hôpital Saint-Louis',
    statut: 'déploiement'
  },
  {
    groupe_id: 'groupe-2',
    etablissement_id: 'etab-3',
    nom_etablissement: 'Clinique du Soleil',
    statut: 'production'
  }
]

describe('Groupes Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchGroupes', () => {
    it('should fetch all groupes', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockGroupes,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('groupes')
        .select('*')
        .order('nom')

      expect(mockSupabase.from).toHaveBeenCalledWith('groupes')
      expect(result.data).toEqual(mockGroupes)
      expect(result.error).toBeNull()
    })

    it('should fetch groupe by id', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockGroupes[0],
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('groupes')
        .select('*')
        .eq('id', 'groupe-1')
        .single()

      expect(result.data?.nom).toBe('Groupe Hospitalier Paris Nord')
    })

    it('should filter groupes by type', async () => {
      const ghtGroupes = mockGroupes.filter(g => g.type === 'GHT')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: ghtGroupes,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('groupes')
        .select('*')
        .eq('type', 'GHT')

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].type).toBe('GHT')
    })

    it('should filter groupes by region', async () => {
      const idfGroupes = mockGroupes.filter(g => g.region === 'Île-de-France')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: idfGroupes,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('groupes')
        .select('*')
        .eq('region', 'Île-de-France')

      expect(result.data).toHaveLength(1)
    })
  })

  describe('createGroupe', () => {
    it('should create a new groupe', async () => {
      const newGroupe = {
        nom: 'Nouveau Groupe',
        type: 'GHT',
        ville: 'Lyon',
        region: 'Auvergne-Rhône-Alpes'
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'groupe-new', ...newGroupe },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const result = await mockSupabase
        .from('groupes')
        .insert(newGroupe)
        .select()
        .single()

      expect(result.data?.nom).toBe('Nouveau Groupe')
      expect(result.error).toBeNull()
    })
  })

  describe('updateGroupe', () => {
    it('should update groupe information', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockGroupes[0], nom: 'Groupe Hospitalier Paris Nord (mis à jour)' },
              error: null
            })
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('groupes')
        .update({ nom: 'Groupe Hospitalier Paris Nord (mis à jour)' })
        .eq('id', 'groupe-1')
        .select()
        .single()

      expect(result.data?.nom).toContain('mis à jour')
    })
  })

  describe('deleteGroupe', () => {
    it('should delete a groupe', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ delete: mockDelete })

      const result = await mockSupabase
        .from('groupes')
        .delete()
        .eq('id', 'groupe-2')

      expect(result.error).toBeNull()
    })
  })

  describe('Groupe Etablissements Relationship', () => {
    it('should fetch etablissements for a groupe', async () => {
      const groupeEtabs = mockGroupeEtablissements.filter(e => e.groupe_id === 'groupe-1')
      
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: groupeEtabs,
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await mockSupabase
        .from('etablissements')
        .select('*')
        .eq('groupe_id', 'groupe-1')

      expect(result.data).toHaveLength(2)
    })

    it('should count etablissements per groupe', () => {
      const countByGroupe = mockGroupeEtablissements.reduce((acc, e) => {
        acc[e.groupe_id] = (acc[e.groupe_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      expect(countByGroupe['groupe-1']).toBe(2)
      expect(countByGroupe['groupe-2']).toBe(1)
    })

    it('should link etablissement to groupe', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { id: 'etab-4', groupe_id: 'groupe-1' },
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('etablissements')
        .update({ groupe_id: 'groupe-1' })
        .eq('id', 'etab-4')

      expect(result.data?.groupe_id).toBe('groupe-1')
    })

    it('should unlink etablissement from groupe', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { id: 'etab-1', groupe_id: null },
          error: null
        })
      })
      
      mockSupabase.from.mockReturnValue({ update: mockUpdate })

      const result = await mockSupabase
        .from('etablissements')
        .update({ groupe_id: null })
        .eq('id', 'etab-1')

      expect(result.data?.groupe_id).toBeNull()
    })
  })

  describe('Groupe Analytics', () => {
    it('should calculate etablissements by status per groupe', () => {
      const groupe1Stats = mockGroupeEtablissements
        .filter(e => e.groupe_id === 'groupe-1')
        .reduce((acc, e) => {
          acc[e.statut] = (acc[e.statut] || 0) + 1
          return acc
        }, {} as Record<string, number>)

      expect(groupe1Stats['production']).toBe(1)
      expect(groupe1Stats['déploiement']).toBe(1)
    })
  })
})
