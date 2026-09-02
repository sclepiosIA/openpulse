import { describe, it, expect } from 'vitest';
import { TAB_LABELS } from '../tabLabels';

describe('tabLabels extended', () => {
  describe('people', () => {
    it('pageLabel', () => expect(TAB_LABELS.people.pageLabel).toBe('Ressources Humaines'));
    it('has 7 tabs', () => expect(Object.keys(TAB_LABELS.people.tabs)).toHaveLength(7));
    it('has analyses tab', () => expect(TAB_LABELS.people.tabs.analyses).toBe('Analyses RH'));
    it('has equipe tab', () => expect(TAB_LABELS.people.tabs.equipe).toBe('Équipe'));
    it('has salaires tab', () => expect(TAB_LABELS.people.tabs.salaires).toBe('Salaires'));
    it('has planning tab', () => expect(TAB_LABELS.people.tabs.planning).toBe('Planning'));
    it('has conges tab', () => expect(TAB_LABELS.people.tabs.conges).toBe('Congés'));
    it('has fiches tab', () => expect(TAB_LABELS.people.tabs.fiches).toBe('Dossiers RH'));
    it('has 3 subViews', () => expect(Object.keys(TAB_LABELS.people.subViews)).toHaveLength(3));
  });

  describe('tresorerie', () => {
    it('pageLabel', () => expect(TAB_LABELS.tresorerie.pageLabel).toBe('Trésorerie'));
    it('has 7 tabs', () => expect(Object.keys(TAB_LABELS.tresorerie.tabs)).toHaveLength(7));
    it('has dashboard tab', () => expect(TAB_LABELS.tresorerie.tabs.dashboard).toBe('Dashboard'));
    it('has revenus tab', () => expect(TAB_LABELS.tresorerie.tabs.revenus).toBe('Revenus'));
    it('has depenses tab', () => expect(TAB_LABELS.tresorerie.tabs.depenses).toBe('Dépenses'));
    it('has factures tab', () => expect(TAB_LABELS.tresorerie.tabs.factures).toBe('Factures'));
    it('has admin tab', () => expect(TAB_LABELS.tresorerie.tabs.admin).toBe('Administration'));
    it('has previsionnelSubTabs', () => expect(Object.keys(TAB_LABELS.tresorerie.previsionnelSubTabs)).toHaveLength(3));
  });

  describe('emails', () => {
    it('pageLabel', () => expect(TAB_LABELS.emails.pageLabel).toBe('Emails'));
    it('has 5 tabs', () => expect(Object.keys(TAB_LABELS.emails.tabs)).toHaveLength(5));
    it('has inbox tab', () => expect(TAB_LABELS.emails.tabs.inbox).toBe('Boîte de réception'));
    it('has classification tab', () => expect(TAB_LABELS.emails.tabs.classification).toBe('Classification'));
    it('has drafts tab', () => expect(TAB_LABELS.emails.tabs.drafts).toBe('Brouillons'));
    it('has settings tab', () => expect(TAB_LABELS.emails.tabs.settings).toBe('Paramètres'));
  });

  describe('etablissementDetail', () => {
    it('pageLabel', () => expect(TAB_LABELS.etablissementDetail.pageLabel).toBe('Établissement'));
    it('has 9 categories', () => expect(Object.keys(TAB_LABELS.etablissementDetail.categories)).toHaveLength(9));
    it('has 18 tabs', () => expect(Object.keys(TAB_LABELS.etablissementDetail.tabs)).toHaveLength(18));
    it('categories include informations', () => expect(TAB_LABELS.etablissementDetail.categories.informations).toBe('Informations'));
    it('tabs include kanban', () => expect(TAB_LABELS.etablissementDetail.tabs.kanban).toBe('Kanban'));
    it('tabs include gantt', () => expect(TAB_LABELS.etablissementDetail.tabs.gantt).toBe('Gantt'));
    it('tabs include emails', () => expect(TAB_LABELS.etablissementDetail.tabs.emails).toBe('Emails'));
    it('tabs include csm-playbooks', () => expect(TAB_LABELS.etablissementDetail.tabs['csm-playbooks']).toBe('Playbooks'));
  });
});
