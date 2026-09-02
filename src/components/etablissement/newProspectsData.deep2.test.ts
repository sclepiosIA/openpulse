import { describe, it, expect } from 'vitest';
import { newProspects, type ProspectData } from './newProspectsData';

/**
 * Clés que `mapStatut` (ImportNewProspects.tsx) sait traduire vers l'énumération
 * `statut_etablissement`. Toute autre valeur retombe silencieusement sur « Prospect ».
 */
const STATUTS_MAPPES: readonly string[] = [
  'I-Etude médico-éco émise',
  'H-Dans les rdvs',
  'G-Attente post rdv',
  'F-RDV pris',
  'E-Attente rdv',
  'C-Bloqué',
  'B-Reporté',
];

function compter(valeurs: readonly string[]): Record<string, number> {
  const comptes: Record<string, number> = {};
  for (const valeur of valeurs) {
    comptes[valeur] = (comptes[valeur] ?? 0) + 1;
  }
  return comptes;
}

/**
 * Couplage entre le jeu de démonstration et son unique consommateur,
 * `src/components/etablissement/ImportNewProspects.tsx`.
 *
 * Les assertions portent sur le CONTRAT (valeurs interprétables par les tables de
 * correspondance, volumétrie minimale exigée par l'écran) et jamais sur des identités.
 */
describe('newProspectsData — couplage avec l’écran d’import', () => {
  it('n’utilise que des statuts interprétables par mapStatut, ou la chaîne vide', () => {
    const statutsAutorises = new Set<string>([...STATUTS_MAPPES, '']);

    const inconnus = newProspects
      .map(prospect => prospect.statut)
      .filter(statut => !statutsAutorises.has(statut));

    expect(inconnus).toEqual([]);
  });

  it('exerce plusieurs branches distinctes de mapStatut', () => {
    const statutsMappes = new Set(
      newProspects.map(prospect => prospect.statut).filter(statut => STATUTS_MAPPES.includes(statut)),
    );

    // Un jeu de démonstration qui n'exercerait qu'un seul statut ne prouverait rien
    // de la table de correspondance.
    expect(statutsMappes.size).toBeGreaterThan(1);
  });

  it('fournit assez de prospects pour déclencher le repli « et N autres » de l’écran', () => {
    // L'écran rend `newProspects.slice(0, 10)` puis annonce le reste : la volumétrie
    // doit rester strictement supérieure à 10 pour couvrir cette branche d'affichage.
    expect(newProspects.length).toBeGreaterThan(10);
  });

  it('répartit les prospects sur plusieurs types et plusieurs régions', () => {
    const parType = compter(newProspects.map(prospect => prospect.type));
    const parRegion = compter(newProspects.map(prospect => prospect.region));

    expect(Object.keys(parType).length).toBeGreaterThan(1);
    expect(Object.keys(parRegion).length).toBeGreaterThan(1);

    const totalTypes = Object.values(parType).reduce((total, compte) => total + compte, 0);
    expect(totalTypes).toBe(newProspects.length);
  });

  it('formate eta_signature de sorte que parseETA sache la lire, ou la laisse à null', () => {
    // parseETA reconnaît « AAAA TQ » et « soon » ; tout autre libellé produit null,
    // ce qui viderait la date de signature estimée à l'import.
    const motifTrimestre = /^\d{4}\s*T[1-4]$/;

    const illisibles = newProspects
      .map(prospect => prospect.eta_signature)
      .filter((eta): eta is string => eta !== null)
      .filter(eta => eta !== 'soon' && !motifTrimestre.test(eta));

    expect(illisibles).toEqual([]);
  });

  it('reste un tableau homogène de ProspectData', () => {
    const premier: ProspectData | undefined = newProspects[0];
    expect(premier).toBeDefined();

    if (premier === undefined) {
      return;
    }

    const clesReference = Object.keys(premier).sort();

    // Toutes les entrées doivent partager la même forme, sinon l'import produit des
    // lignes partiellement renseignées selon la position.
    for (const prospect of newProspects) {
      expect(Object.keys(prospect).sort()).toEqual(clesReference);
    }
  });
});
