import { createElement, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import {
  ProjetsTaskListPreview,
  ProjetsFiltresPreview,
  ProjetsAnalyticsPreview,
  ProjetsActionsEnMassePreview,
} from './ProjetsPreviews'

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) =>
        ({ children }: { children?: ReactNode }) =>
          createElement(typeof tag === 'string' ? tag : 'div', null, children),
    }
  ),
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: ({ value }: { value: number }) =>
    createElement('span', { 'data-testid': 'countup' }, String(value)),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: ReactNode }) =>
    createElement('span', { 'data-testid': 'badge' }, children),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) =>
    createElement('div', {
      'data-testid': 'progress',
      'data-value': String(value),
      role: 'progressbar',
    }),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'card' }, children),
  CardContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  CardHeader: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  CardTitle: ({ children }: { children?: ReactNode }) =>
    createElement('h3', null, children),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, 'aria-label': ariaLabel }: { children?: ReactNode; 'aria-label'?: string }) =>
    createElement('button', { type: 'button', 'aria-label': ariaLabel }, children),
}))

describe('ProjetsPreviews', () => {
  describe('ProjetsTaskListPreview', () => {
    it('a un displayName défini', () => {
      expect(ProjetsTaskListPreview.displayName).toBe('ProjetsTaskListPreview')
    })

    it('affiche le titre, le compteur de tâches et les 5 tâches mockées', () => {
      render(<ProjetsTaskListPreview />)

      expect(screen.getByText('Mes tâches')).toBeTruthy()
      expect(screen.getByTestId('countup').textContent).toBe('5')

      expect(screen.getByText('Préparer la démo client')).toBeTruthy()
      expect(screen.getByText('Corriger bug interface email')).toBeTruthy()
      expect(screen.getByText('Documenter API v2')).toBeTruthy()
      expect(screen.getByText('Relancer Clinique ABC')).toBeTruthy()
      expect(screen.getByText('Mise à jour serveur staging')).toBeTruthy()
    })

    it('affiche les assignés et échéances des tâches', () => {
      render(<ProjetsTaskListPreview />)

      expect(screen.getByText('Marie D.')).toBeTruthy()
      expect(screen.getAllByText('Thomas L.')).toHaveLength(2)
      expect(screen.getByText("Aujourd'hui")).toBeTruthy()
      expect(screen.getByText('Demain')).toBeTruthy()
    })

    it('barre la tâche terminée (classe line-through)', () => {
      render(<ProjetsTaskListPreview />)

      const done = screen.getByText('Mise à jour serveur staging')
      expect(done.className).toContain('line-through')

      const inProgress = screen.getByText('Préparer la démo client')
      expect(inProgress.className).not.toContain('line-through')
    })

    it('rend un bouton "Plus d\'options" par tâche', () => {
      render(<ProjetsTaskListPreview />)
      expect(screen.getAllByLabelText("Plus d'options")).toHaveLength(5)
    })
  })

  describe('ProjetsFiltresPreview', () => {
    it('a un displayName défini', () => {
      expect(ProjetsFiltresPreview.displayName).toBe('ProjetsFiltresPreview')
    })

    it('affiche le titre et les 5 filtres', () => {
      render(<ProjetsFiltresPreview />)

      expect(screen.getByText('Filtres et Tri')).toBeTruthy()
      expect(screen.getByText('Statut')).toBeTruthy()
      expect(screen.getByText('Échéance')).toBeTruthy()
      expect(screen.getByText('Catégorie')).toBeTruthy()
    })

    it('affiche les valeurs des filtres actifs dans des badges', () => {
      render(<ProjetsFiltresPreview />)

      expect(screen.getByText('En cours')).toBeTruthy()
      expect(screen.getByText('Moi')).toBeTruthy()
    })

    it('affiche les options de tri et le résumé des résultats', () => {
      render(<ProjetsFiltresPreview />)

      expect(screen.getByText('Trier par')).toBeTruthy()
      expect(screen.getByText('Date')).toBeTruthy()
      expect(screen.getByText('12 tâches')).toBeTruthy()
      expect(
        screen.getByText(/correspondent à vos filtres/)
      ).toBeTruthy()
    })
  })

  describe('ProjetsAnalyticsPreview', () => {
    it('a un displayName défini', () => {
      expect(ProjetsAnalyticsPreview.displayName).toBe('ProjetsAnalyticsPreview')
    })

    it('affiche le titre et les 3 KPIs avec leurs valeurs', () => {
      render(<ProjetsAnalyticsPreview />)

      expect(screen.getByText('Analytics Projets')).toBeTruthy()
      expect(screen.getByText('Tâches terminées')).toBeTruthy()
      expect(screen.getByText('En retard')).toBeTruthy()
      expect(screen.getByText('À venir (7j)')).toBeTruthy()

      const countups = screen.getAllByTestId('countup')
      expect(countups.map((c) => c.textContent)).toEqual(['24', '3', '12'])
      expect(screen.getByText('/35')).toBeTruthy()
    })

    it('affiche les tendances des KPIs', () => {
      render(<ProjetsAnalyticsPreview />)

      expect(screen.getByText('+8 cette semaine')).toBeTruthy()
      expect(screen.getByText('-2 vs semaine dernière')).toBeTruthy()
      expect(screen.getByText('5 haute priorité')).toBeTruthy()
    })

    it('affiche la performance équipe avec une barre de progression par membre', () => {
      render(<ProjetsAnalyticsPreview />)

      expect(screen.getByText('Performance équipe')).toBeTruthy()
      expect(screen.getByText('Marie D.')).toBeTruthy()
      expect(screen.getByText('Pierre V.')).toBeTruthy()
      expect(screen.getByText('8 terminées')).toBeTruthy()

      const bars = screen.getAllByTestId('progress')
      expect(bars).toHaveLength(4)
      expect(bars.map((b) => b.getAttribute('data-value'))).toEqual([
        '73',
        '60',
        '71',
        '50',
      ])
    })
  })

  describe('ProjetsActionsEnMassePreview', () => {
    it('a un displayName défini', () => {
      expect(ProjetsActionsEnMassePreview.displayName).toBe(
        'ProjetsActionsEnMassePreview'
      )
    })

    it('affiche le compteur de sélection et le bouton de désélection', () => {
      render(<ProjetsActionsEnMassePreview />)

      expect(screen.getByText('3 tâches sélectionnées')).toBeTruthy()
      expect(screen.getByText('Tout désélectionner')).toBeTruthy()
    })

    it('affiche les 4 actions en masse disponibles', () => {
      render(<ProjetsActionsEnMassePreview />)

      expect(screen.getByText('Changer le statut')).toBeTruthy()
      expect(screen.getByText('Réassigner')).toBeTruthy()
      expect(screen.getByText('Modifier la priorité')).toBeTruthy()
      expect(screen.getByText('Supprimer')).toBeTruthy()
    })

    it('affiche les 3 tâches sélectionnées avec des cases cochées', () => {
      render(<ProjetsActionsEnMassePreview />)

      expect(screen.getByText('Préparer la démo client')).toBeTruthy()
      expect(screen.getByText('Corriger bug interface')).toBeTruthy()
      expect(screen.getByText('Documenter API v2')).toBeTruthy()

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(3)
      checkboxes.forEach((cb) => {
        expect((cb as HTMLInputElement).checked).toBe(true)
      })
    })
  })
})