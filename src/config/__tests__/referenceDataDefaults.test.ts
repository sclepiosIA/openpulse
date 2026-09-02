import { describe, it, expect } from 'vitest';
import {
  FALLBACK_STATUTS_ETABLISSEMENT,
  FALLBACK_REGIONS,
  FALLBACK_TYPES_ETABLISSEMENT,
  FALLBACK_DPI,
  FALLBACK_TYPES_OFFRE,
  FALLBACK_PALLIERS,
  FALLBACK_DEPLOIEMENT_STATUTS,
  FALLBACK_STATUTS_TACHES,
  FALLBACK_KANBAN_STATUTS,
  FALLBACK_FUNNEL_STATUTS,
  FALLBACK_STATUTS_IMPORT,
} from '../referenceDataDefaults';
import { PHASE_STATUTS } from '../statusConfig';

describe('referenceDataDefaults', () => {
  it('STATUTS_ETABLISSEMENT suit le pipeline, sans les statuts propres à un métier', () => {
    // Le sélecteur reprend le pipeline partagé dans l'ordre des phases, mais
    // écarte ce que le secteur actif n'emploie pas. Par défaut le secteur est
    // générique : « Étude émise » (étude médico-économique) et « Autre compte /
    // GHT » (groupement hospitalier de territoire) n'ont de sens que dans la
    // santé française et ne doivent pas être proposés à tout le monde.
    expect(FALLBACK_STATUTS_ETABLISSEMENT).toEqual([
      'Prospect',
      'Attente RDV',
      'RDV pris',
      'Dans les RDV',
      'Attente post RDV',
      'Négociation',
      'Bloqué',
      'Contractuel',
      'Contractualisation',
      'Vendu',
      'Conformité',
      'Déploiement',
      'Formation',
      'Go-Live',
      'Production',
    ]);
    expect(FALLBACK_STATUTS_ETABLISSEMENT).not.toContain('Etude émise');
    expect(FALLBACK_STATUTS_ETABLISSEMENT).not.toContain('Autre compte / GHT');
  });
  it('STATUTS_ETABLISSEMENT includes Production', () => expect(FALLBACK_STATUTS_ETABLISSEMENT).toContain('Production'));
  // Les trois listes ci-dessous étaient épinglées sur leurs valeurs
  // hospitalières françaises : treize régions de France, sept catégories
  // d'établissement de santé, dix-neuf éditeurs de dossier patient. Épingler
  // ces valeurs revenait à interdire au produit d'être installé ailleurs. Ce
  // qui est épinglé maintenant, c'est la NEUTRALITÉ du défaut.
  it('REGIONS ne présuppose aucun pays', () => {
    expect(FALLBACK_REGIONS.length).toBeGreaterThan(0);
    expect(FALLBACK_REGIONS).not.toContain('Île-de-France');
    expect(FALLBACK_REGIONS).not.toContain('Bretagne');
  });
  it("TYPES_ETABLISSEMENT ne présuppose aucun secteur d'activité", () => {
    expect(FALLBACK_TYPES_ETABLISSEMENT.length).toBeGreaterThan(0);
    for (const sectoriel of ['CH', 'CHU', 'GHT', 'ESPIC', 'HIA']) {
      expect(FALLBACK_TYPES_ETABLISSEMENT).not.toContain(sectoriel);
    }
  });
  it('DPI ne propose plus des éditeurs de logiciels hospitaliers', () => {
    expect(FALLBACK_DPI.length).toBeGreaterThan(0);
    for (const editeur of ['Hopital Manager', 'ORBIS', 'Sillage', 'ResUrgences']) {
      expect(FALLBACK_DPI).not.toContain(editeur);
    }
  });
  it('TYPES_OFFRE has 3', () => expect(FALLBACK_TYPES_OFFRE).toEqual(['Au succès', 'Forfait', 'Hybride']));
  it('PALLIERS has 4', () => expect(FALLBACK_PALLIERS.length).toBe(4));
  it('DEPLOIEMENT_STATUTS matches the complete current deployment phase', () => {
    expect(FALLBACK_DEPLOIEMENT_STATUTS).toEqual(PHASE_STATUTS.deploiement);
    expect(FALLBACK_DEPLOIEMENT_STATUTS).toHaveLength(7);
  });
  it('STATUTS_TACHES has 4', () => expect(FALLBACK_STATUTS_TACHES).toEqual(['A faire', 'En cours', 'Bloqué', 'Terminé']));
  it('KANBAN_STATUTS has 8', () => expect(FALLBACK_KANBAN_STATUTS.length).toBe(8));
  it('KANBAN_STATUTS have key/label/color', () => {
    FALLBACK_KANBAN_STATUTS.forEach(s => {
      expect(s.key).toBeDefined();
      expect(s.label).toBeDefined();
      expect(s.color).toContain('bg-');
    });
  });
  it('FUNNEL_STATUTS has 6', () => expect(FALLBACK_FUNNEL_STATUTS.length).toBe(6));
  it("STATUTS_IMPORT couvre le pipeline sans le vocabulaire d'un exploitant", () => {
    // L'import accepte volontairement plus d'états que le sélecteur : il vient
    // d'un tableur. Mais il ne doit pas proposer le jargon commercial interne
    // du premier exploitant à tous ceux qui installent.
    expect(FALLBACK_STATUTS_IMPORT.length).toBeGreaterThan(0);
    for (const jargon of ['Etude émise', 'Dans les RDV post EME', 'Autre compte / GHT']) {
      expect(FALLBACK_STATUTS_IMPORT).not.toContain(jargon);
    }
    // Les états universels d'un cycle de vente restent proposés.
    for (const commun of ['Prospect', 'Négociation', 'Production', 'Refus']) {
      expect(FALLBACK_STATUTS_IMPORT).toContain(commun);
    }
  });
});
