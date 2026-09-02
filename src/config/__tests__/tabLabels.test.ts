import { describe, it, expect } from 'vitest'
import { TAB_LABELS } from '../tabLabels'

describe('tabLabels', () => {
  describe('people', () => {
    it('pageLabel', () => expect(TAB_LABELS.people.pageLabel).toBe('Ressources Humaines'))
    it('has 7 tabs', () => expect(Object.keys(TAB_LABELS.people.tabs).length).toBe(7))
    it('equipe tab', () => expect(TAB_LABELS.people.tabs.equipe).toBe('Équipe'))
    it('salaires tab', () => expect(TAB_LABELS.people.tabs.salaires).toBe('Salaires'))
    it('has subViews', () => expect(TAB_LABELS.people.subViews.cards).toBe('Vue Cartes'))
  })

  describe('tresorerie', () => {
    it('pageLabel', () => expect(TAB_LABELS.tresorerie.pageLabel).toBe('Trésorerie'))
    it('has 7 tabs', () => expect(Object.keys(TAB_LABELS.tresorerie.tabs).length).toBe(7))
    it('dashboard tab', () => expect(TAB_LABELS.tresorerie.tabs.dashboard).toBe('Dashboard'))
    it('has previsionnelSubTabs', () =>
      expect(TAB_LABELS.tresorerie.previsionnelSubTabs.jour).toBe('Trésorerie jour'))
  })

  describe('emails', () => {
    it('pageLabel', () => expect(TAB_LABELS.emails.pageLabel).toBe('Emails'))
    it('has 5 tabs', () => expect(Object.keys(TAB_LABELS.emails.tabs).length).toBe(5))
    it('inbox tab', () => expect(TAB_LABELS.emails.tabs.inbox).toBe('Boîte de réception'))
  })

  describe('etablissementDetail', () => {
    it('pageLabel', () => expect(TAB_LABELS.etablissementDetail.pageLabel).toBe('Établissement'))
    it('has 9 categories', () =>
      expect(Object.keys(TAB_LABELS.etablissementDetail.categories).length).toBe(9))
    it('has 18 tabs', () =>
      expect(Object.keys(TAB_LABELS.etablissementDetail.tabs).length).toBe(18))
    it('kanban tab', () => expect(TAB_LABELS.etablissementDetail.tabs.kanban).toBe('Kanban'))
    it('csm-playbooks tab', () =>
      expect(TAB_LABELS.etablissementDetail.tabs['csm-playbooks']).toBe('Playbooks'))
  })
})
