/**
 * Types pour la page Analyse Géographique
 * 
 * Ces types permettent un typage strict des établissements
 * affichés dans la carte et la table géographique.
 */

import type { ProfileRelation } from './database-relations';

/** Relation profile simplifiée pour la vue géo (id optionnel) */
interface GeoProfileRelation {
  id?: string;
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
}

/** Structure minimale d'un établissement pour l'analyse géographique */
export interface EtablissementForGeo {
  id: string;
  nom: string;
  ville?: string | null;
  region?: string | null;
  type?: string | null;
  statut: string;
  dpi?: string | null;
  commercial?: GeoProfileRelation | null;
  chef_projet?: GeoProfileRelation | null;
  csm?: GeoProfileRelation | null;
  date_signature?: string | null;
  date_go_live?: string | null;
  nombre_passages_urgences_annuel?: number | null;
  // Coordonnées GPS optionnelles
  latitude?: number | null;
  longitude?: number | null;
  // Groupe associé (optionnel)
  groupe?: { id: string; nom: string } | null;
}

/** Type pour le tri des colonnes dans la table géographique */
export type GeoSortKey = keyof Pick<
  EtablissementForGeo,
  'nom' | 'ville' | 'region' | 'type' | 'statut' | 'dpi'
>;

/** Configuration de tri pour la table géographique */
export interface GeoSortConfig {
  key: GeoSortKey;
  direction: 'asc' | 'desc';
}
