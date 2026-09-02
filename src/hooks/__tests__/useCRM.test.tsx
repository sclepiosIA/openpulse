import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isValidTransition,
  calculatePipelineValue,
  formatContactName,
  isValidFrenchPhone,
  calculatePriorityScore,
  isTaskOverdue,
  groupByRegion,
  haversineDistance,
  calculateMonthlyRevenue,
  formatForCSV,
  buildSearchQuery,
  filterEtablissements,
} from '@/lib/crmUtils'

describe('CRM Utilities', () => {
  describe('Etablissement Status Flow', () => {
    it('should validate status transitions', () => {
      expect(isValidTransition('Prospect', 'Rendez-vous pris')).toBe(true)
      expect(isValidTransition('Négociation', 'Production')).toBe(true)
      expect(isValidTransition('Production', 'Prospect')).toBe(false)
    })

    it('should calculate pipeline value correctly', () => {
      const pipeline = [
        { statut: 'Prospect', valeur_contrat: 10000 },
        { statut: 'Négociation', valeur_contrat: 20000 },
        { statut: 'Contractualisation', valeur_contrat: 15000 },
      ]
      const value = calculatePipelineValue(pipeline)
      expect(value).toBe(10000 * 0.1 + 20000 * 0.6 + 15000 * 0.9)
    })
  })

  describe('Contact Management', () => {
    it('should format contact display name', () => {
      expect(formatContactName({ prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com' })).toBe('Jean Dupont')
      expect(formatContactName({ nom: 'Dupont', email: 'contact@test.com' })).toBe('Dupont')
      expect(formatContactName({ email: 'contact@test.com' })).toBe('contact@test.com')
    })

    it('should validate phone number format', () => {
      expect(isValidFrenchPhone('06 12 34 56 78')).toBe(true)
      expect(isValidFrenchPhone('+33 6 12 34 56 78')).toBe(true)
      expect(isValidFrenchPhone('06.12.34.56.78')).toBe(true)
      expect(isValidFrenchPhone('123456')).toBe(false)
    })
  })

  describe('Task Management', () => {
    it('should calculate task priority score', () => {
      const urgentTask = {
        priorite: 'critique',
        echeance: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
      const normalTask = {
        priorite: 'moyenne',
        echeance: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      }
      expect(calculatePriorityScore(urgentTask)).toBeGreaterThan(calculatePriorityScore(normalTask))
    })

    it('should detect overdue tasks', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      expect(isTaskOverdue(yesterday)).toBe(true)
      expect(isTaskOverdue(tomorrow)).toBe(false)
    })
  })

  describe('Geographic Analysis', () => {
    it('should group etablissements by region', () => {
      const etabs = [
        { id: '1', region: 'Île-de-France' },
        { id: '2', region: 'Île-de-France' },
        { id: '3', region: 'Occitanie' },
      ]
      const grouped = groupByRegion(etabs)
      expect(grouped['Île-de-France']).toHaveLength(2)
      expect(grouped['Occitanie']).toHaveLength(1)
    })

    it('should calculate distance between coordinates', () => {
      const distance = haversineDistance(48.8566, 2.3522, 45.7640, 4.8357)
      expect(distance).toBeGreaterThan(380)
      expect(distance).toBeLessThan(420)
    })
  })

  describe('Revenue Calculation', () => {
    it('should calculate monthly revenue for static model', () => {
      expect(calculateMonthlyRevenue({
        modele_economique: 'Statique',
        prix_licence_mensuel: 2500,
        periodicite_paiement: 'mensuel'
      })).toBe(2500)

      expect(calculateMonthlyRevenue({
        modele_economique: 'Statique',
        prix_licence_annuel: 24000,
        periodicite_paiement: 'annuel'
      })).toBe(2000)
    })
  })

  describe('Data Export', () => {
    it('should format data for CSV export', () => {
      const data = [
        { nom: 'CHU Lyon', ville: 'Lyon', statut: 'Production' },
        { nom: 'Clinique du Parc', ville: 'Paris, 16e', statut: 'Déploiement' },
      ]
      const csv = formatForCSV(data)
      expect(csv).toContain('nom,ville,statut')
      expect(csv).toContain('"Paris, 16e"')
    })
  })
})

describe('CRM Search', () => {
  it('should build search query correctly', () => {
    expect(buildSearchQuery('CHU')).toBe('%CHU%')
    expect(buildSearchQuery('100%')).toBe('%100\\%%')
  })

  it('should filter etablissements by multiple criteria', () => {
    const etabs = [
      { id: '1', nom: 'CHU Lyon', region: 'Auvergne-Rhône-Alpes', statut: 'Production' },
      { id: '2', nom: 'CHU Paris', region: 'Île-de-France', statut: 'Production' },
      { id: '3', nom: 'Clinique Bordeaux', region: 'Nouvelle-Aquitaine', statut: 'Déploiement' },
    ]
    expect(filterEtablissements(etabs, { search: 'CHU' })).toHaveLength(2)
    expect(filterEtablissements(etabs, { region: 'Île-de-France' })).toHaveLength(1)
    expect(filterEtablissements(etabs, { statut: 'Production' })).toHaveLength(2)
    expect(filterEtablissements(etabs, { search: 'CHU', region: 'Île-de-France' })).toHaveLength(1)
  })
})
