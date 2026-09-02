import type { CreateEtablissementData, Etablissement } from '@/hooks/crm/useEtablissements'

/**
 * Construit les `defaultValues` du formulaire d'édition d'un établissement
 * à partir de l'entité chargée. Normalise les `null` en `""`/`"unassigned"`/`undefined`
 * pour s'aligner sur les composants `Select`/`Input` contrôlés.
 *
 * Extrait de `EtablissementEditForm.tsx` (S90).
 */
export function buildEtablissementFormDefaults(e: Etablissement): CreateEtablissementData {
  return {
    nom: e.nom,
    type: e.type,
    ville: e.ville,
    region: e.region,
    date_prise_contact: e.date_prise_contact || new Date().toISOString().split('T')[0],
    statut: e.statut,
    date_signature: e.date_signature || '',
    date_fin_contrat: e.date_fin_contrat || '',
    date_go_live: e.date_go_live || '',
    commercial_id: e.commercial_id || 'unassigned',
    chef_projet_id: e.chef_projet_id || 'unassigned',
    csm_id: e.csm_id || 'unassigned',
    adresse: e.adresse || '',
    code_postal: e.code_postal || '',
    telephone: e.telephone || '',
    email: e.email || '',
    type_offre: e.type_offre || '',
    pallier_vise: e.pallier_vise || '',
    pallier_realise: e.pallier_realise || '',
    notes: e.notes || '',
    nombre_passages_urgences_annuel: e.nombre_passages_urgences_annuel ?? undefined,
    dpi: e.dpi ?? undefined,
    directeur_general_nom: e.directeur_general_nom || '',
    directeur_general_prenom: e.directeur_general_prenom || '',
    directeur_general_email: e.directeur_general_email || '',
    siren_client: e.siren_client || '',
    date_previsionnelle_signature: e.date_previsionnelle_signature || '',
    modules_proposes: e.modules_proposes || [],
    apporteurs_affaires_ids: e.apporteurs_affaires_ids || [],
    modele_statique_succes: e.modele_statique_succes || '',
    seuils_palliers: e.seuils_palliers || {},
    tarifs_palliers: e.tarifs_palliers || {},
    stats_utilisation_url: e.stats_utilisation_url || '',
    stats_urgences_url: e.stats_urgences_url || '',
  } as CreateEtablissementData
}

/**
 * Nettoie le payload avant `updateEtablissement` :
 * - `""` → `undefined` pour les champs texte/date optionnels
 * - `"unassigned"` → `undefined` pour les FK profils
 * - objets vides (`seuils_palliers`, `tarifs_palliers`) → `undefined`
 */
export function sanitizeEtablissementPayload(
  data: CreateEtablissementData
): CreateEtablissementData {
  const toUndef = (v: string | null | undefined) => (v === '' || v == null ? undefined : v)
  const toUndefUnassigned = (v: string | null | undefined) =>
    v === 'unassigned' || v === '' || v == null ? undefined : v

  return {
    ...data,
    nombre_passages_urgences_annuel: data.nombre_passages_urgences_annuel ?? undefined,
    date_signature: toUndef(data.date_signature),
    date_fin_contrat: toUndef(data.date_fin_contrat),
    date_go_live: toUndef(data.date_go_live),
    date_previsionnelle_signature: toUndef(data.date_previsionnelle_signature),
    commercial_id: toUndefUnassigned(data.commercial_id),
    chef_projet_id: toUndefUnassigned(data.chef_projet_id),
    csm_id: toUndefUnassigned(data.csm_id),
    adresse: toUndef(data.adresse),
    code_postal: toUndef(data.code_postal),
    telephone: toUndef(data.telephone),
    email: toUndef(data.email),
    type_offre: toUndef(data.type_offre),
    pallier_vise: toUndef(data.pallier_vise),
    pallier_realise: toUndef(data.pallier_realise),
    notes: toUndef(data.notes),
    directeur_general_nom: toUndef(data.directeur_general_nom),
    directeur_general_prenom: toUndef(data.directeur_general_prenom),
    directeur_general_email: toUndef(data.directeur_general_email),
    siren_client: toUndef(data.siren_client),
    modele_statique_succes: toUndef(data.modele_statique_succes),
    dpi: !data.dpi ? undefined : data.dpi,
    seuils_palliers:
      data.seuils_palliers && Object.keys(data.seuils_palliers).length > 0
        ? data.seuils_palliers
        : undefined,
    tarifs_palliers:
      data.tarifs_palliers && Object.keys(data.tarifs_palliers).length > 0
        ? data.tarifs_palliers
        : undefined,
    stats_utilisation_url: toUndef(data.stats_utilisation_url),
    stats_urgences_url: toUndef(data.stats_urgences_url),
  }
}
