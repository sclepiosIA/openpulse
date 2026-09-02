/**
 * Valeurs de repli des référentiels.
 *
 * Elles servent tant que la table `reference_data` est vide — donc au premier
 * démarrage, et dans les contextes sans base (construction, épreuves). Ce sont
 * elles que voit quelqu'un qui vient d'installer.
 *
 * Elles ne sont plus écrites en dur : elles viennent du secteur d'activité
 * configuré (`src/config/secteurs.ts`), dont le défaut est neutre. Un
 * exploitant du secteur hospitalier retrouve les listes historiques avec
 * `VITE_SECTEUR_METIER=sante-fr` ; n'importe qui d'autre écrit les siennes,
 * liste par liste, sans avoir à modifier ce fichier.
 *
 * Les noms exportés n'ont pas changé : les composants qui les importent
 * n'avaient pas à connaître ce déplacement.
 */

import { PHASE_STATUTS } from './statusConfig';
import { SECTEUR } from './secteurs';

// ============= REPLIS ISSUS DU SECTEUR =============

/**
 * Retire du pipeline partagé les statuts que le secteur actif n'emploie pas.
 *
 * Le filtre ne s'applique qu'à ce qui est *proposé*. Une ligne déjà enregistrée
 * avec un statut écarté reste affichée et conserve sa couleur, puisque
 * `statusConfig` continue de la connaître.
 */
const ignores = new Set<string>(SECTEUR.statutsPipelineIgnores);
const retenus = (statuts: readonly string[]): string[] =>
  statuts.filter((statut: string): boolean => !ignores.has(statut));

export const FALLBACK_STATUTS_ETABLISSEMENT: readonly string[] = [
  ...retenus(PHASE_STATUTS.prospect),
  ...retenus(PHASE_STATUTS.deploiement),
  ...retenus(PHASE_STATUTS.production),
];

export const FALLBACK_STATUTS_IMPORT: readonly string[] = SECTEUR.statutsImport;

export const FALLBACK_REGIONS: readonly string[] = SECTEUR.zones;

export const FALLBACK_TYPES_ETABLISSEMENT: readonly string[] = SECTEUR.typesEntite;

/**
 * Solutions déjà en place chez l'entité.
 *
 * Le nom `FALLBACK_DPI` est conservé pour les importateurs existants ; le
 * concept, lui, n'a rien de médical : c'est l'existant que l'on remplace ou
 * avec lequel on coexiste. Le libellé affiché vient de `LEXIQUE.systemeEnPlace`.
 */
export const FALLBACK_DPI: readonly string[] = SECTEUR.systemesEnPlace;

export const FALLBACK_PALLIERS: readonly string[] = SECTEUR.paliers;

// ============= REPLIS INDÉPENDANTS DU SECTEUR =============
// Ces listes décrivent le fonctionnement du produit, pas un métier : elles
// valent telles quelles pour n'importe quelle activité.

export const FALLBACK_TYPES_OFFRE = ['Au succès', 'Forfait', 'Hybride'] as const;

export const FALLBACK_DEPLOIEMENT_STATUTS: readonly string[] = retenus(
  PHASE_STATUTS.deploiement,
);

export const FALLBACK_STATUTS_TACHES = ['A faire', 'En cours', 'Bloqué', 'Terminé'] as const;

// Statuts du kanban, avec leur présentation
export const FALLBACK_KANBAN_STATUTS = [
  { key: 'Prospect', label: 'Prospects', color: 'bg-slate-500' },
  { key: 'Négociation', label: 'Négociation', color: 'bg-yellow-500' },
  { key: 'Contractuel', label: 'Contractuel', color: 'bg-blue-500' },
  { key: 'Conformité', label: 'Conformité', color: 'bg-orange-500' },
  { key: 'Déploiement', label: 'Déploiement', color: 'bg-purple-500' },
  { key: 'Formation', label: 'Formation', color: 'bg-indigo-500' },
  { key: 'Go-Live', label: 'Go-Live', color: 'bg-green-500' },
  { key: 'Production', label: 'Production', color: 'bg-emerald-500' },
] as const;

// Statuts de l'entonnoir des rapports (vue simplifiée du pipeline)
export const FALLBACK_FUNNEL_STATUTS = ['Prospect', 'Contractuel', 'Déploiement', 'Formation', 'Go-Live', 'Production'] as const;
