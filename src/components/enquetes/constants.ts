// Référentiels partagés des enquêtes de suivi clients
export const FONCTIONS = [
  { value: 'medecin', label: 'Médecin' },
  { value: 'interne', label: 'Interne' },
  { value: 'iao', label: 'IAO' },
  { value: 'ide', label: 'IDE' },
  { value: 'medecin_dim', label: 'Médecin DIM' },
  { value: 'secretaire_medicale', label: 'Secrétaire médicale' },
  { value: 'cadre_sante', label: 'Cadre de santé' },
  { value: 'autre', label: 'Autre' },
] as const;

export const DPIS = [
  { value: 'hopital_manager', label: 'Hôpital Manager' },
  { value: 'resurgence', label: 'Résurgence' },
  { value: 'mediboard', label: 'Mediboard' },
  { value: 'easily', label: 'Easily' },
  { value: 'crossway', label: 'Crossway' },
  { value: 'dxcare', label: 'DxCare' },
  { value: 'autre', label: 'Autre' },
] as const;

export const FONCTIONNALITES = [
  { value: 'dictee_vocale', label: 'Dictée vocale' },
  { value: 'ocr', label: 'OCR' },
  { value: 'aide_cotation', label: 'Aide à la cotation' },
  { value: 'generation_documents', label: 'Génération de documents' },
  { value: 'reformatage', label: 'Reformatage' },
] as const;

export const MODULES = [
  { value: 'urgence', label: 'Urgence' },
  { value: 'mco', label: 'MCO' },
  { value: 'smr', label: 'SMR' },
  { value: 'ioa', label: 'IOA' },
] as const;

export const OUI_NON_4 = [
  { value: 'oui_tout_a_fait', label: 'Oui, tout à fait' },
  { value: 'plutot_oui', label: 'Plutôt oui' },
  { value: 'plutot_non', label: 'Plutôt non' },
  { value: 'non_pas_du_tout', label: 'Non, pas du tout' },
] as const;

export const OUI_PARTIEL_NON = [
  { value: 'oui', label: 'Oui' },
  { value: 'partiellement', label: 'Partiellement' },
  { value: 'non', label: 'Non' },
] as const;

export const INTENTION_USAGE = [
  { value: 'oui_des_que_possible', label: 'Oui, dès que possible' },
  { value: 'oui_ponctuellement', label: 'Oui, ponctuellement' },
  { value: 'je_ne_sais_pas', label: 'Je ne sais pas encore' },
  { value: 'non', label: 'Non' },
] as const;

export const ACCES_FORMATION = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'je_ne_sais_pas', label: 'Je ne sais pas' },
] as const;

export const FREQUENCE_USAGE = [
  { value: 'chaque_patient', label: 'Pour chaque patient pris en charge' },
  { value: 'plusieurs_par_jour', label: 'Pour plusieurs patients par jour' },
  { value: 'occasionnellement', label: 'Occasionnellement dans la semaine' },
  { value: 'rarement', label: 'Je l\'utilise très rarement' },
] as const;

export const BEAUCOUP_PAS_DU_TOUT = [
  { value: 'beaucoup', label: 'Beaucoup' },
  { value: 'un_peu', label: 'Un peu' },
  { value: 'tres_peu', label: 'Très peu' },
  { value: 'pas_du_tout', label: 'Pas du tout' },
] as const;

export const GAIN_TEMPS = [
  { value: '10_15min', label: 'Entre 10 et 15 minutes' },
  { value: '5_10min', label: 'Entre 5 et moins de 10 minutes' },
  { value: '2_5min', label: 'Entre 2 et moins de 5 minutes' },
  { value: 'moins_2min', label: 'Moins de 2 minutes' },
  { value: 'aucun', label: 'Aucun gain de temps constaté' },
] as const;

export const FORMATION_RECUE = [
  { value: 'oui_complete', label: 'Oui, formation complète' },
  { value: 'oui_partielle', label: 'Oui, formation partielle' },
  { value: 'non', label: 'Non' },
] as const;

export const CSM_CONTRIB = [
  { value: 'oui_beaucoup', label: 'Oui, beaucoup' },
  { value: 'oui_un_peu', label: 'Oui, un peu' },
  { value: 'tres_peu', label: 'Très peu' },
  { value: 'pas_du_tout', label: 'Pas du tout' },
] as const;

export const CSM_COMPREHENSION = [
  { value: 'oui_tout_a_fait', label: 'Oui, tout à fait' },
  { value: 'oui_globalement', label: 'Oui, globalement' },
  { value: 'partiellement', label: 'Partiellement' },
  { value: 'non', label: 'Non' },
] as const;

export const CSM_REACTIVITE = [
  { value: 'oui_systematiquement', label: 'Oui, systématiquement' },
  { value: 'oui_la_plupart', label: 'Oui, la plupart du temps' },
  { value: 'rarement', label: 'Rarement' },
  { value: 'jamais', label: 'Jamais' },
] as const;

export const CSM_UTILITE_COMITES = [
  { value: 'tres_utiles', label: 'Oui, très utiles' },
  { value: 'plutot_utiles', label: 'Oui, plutôt utiles' },
  { value: 'peu_utiles', label: 'Peu utiles' },
  { value: 'pas_utiles', label: 'Pas du tout utiles' },
] as const;

export const CSM_FREQUENCE = [
  { value: 'oui', label: 'Oui, adaptée' },
  { value: 'trop_frequente', label: 'Non, trop fréquente' },
  { value: 'pas_assez_frequente', label: 'Non, pas assez fréquente' },
] as const;

export type EnqueteType = 'post_formation' | 'ces' | 'satisfaction' | 'suivi_csm';

export const ENQUETE_LABELS: Record<EnqueteType, { title: string; subtitle: string }> = {
  post_formation: {
    title: 'Évaluation de la formation OpenPulse',
    subtitle: 'Votre retour nous aide à améliorer la qualité de nos formations.',
  },
  ces: {
    title: 'Évaluation de la prise en main de OpenPulse',
    subtitle: 'Mesurez en moins de 2 minutes votre effort d\'adoption.',
  },
  satisfaction: {
    title: 'Questionnaire de satisfaction – OpenPulse',
    subtitle: 'Aidez-nous à mieux vous accompagner et à faire évoluer le produit.',
  },
  suivi_csm: {
    title: 'Évaluation du suivi CSM',
    subtitle: 'Votre avis sur l\'accompagnement par votre Customer Success Manager.',
  },
};
