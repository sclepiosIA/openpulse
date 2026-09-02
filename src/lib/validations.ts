import { z } from 'zod'

// Enums pour assurer la cohérence avec les types de base de données
export const EtablissementType = z.enum(['CH', 'GHT', 'CHU', 'ESPIC', 'Privé'])

export const EtablissementStatut = z.enum([
  'Prospect',
  'Contractuel',
  'Conformité',
  'Déploiement',
  'Formation',
  'Go-Live',
  'Production',
  'Suspendu',
  'Refus',
  'Reporté',
  'Bloqué',
  'Contacté',
  'Attente RDV',
  'RDV pris',
  'Attente post RDV',
  'Dans les RDV',
  'Etude émise',
  'Dans les RDV post EME',
  'Négociation',
  'Contractualisation',
  'Vendu',
  'Autre compte / GHT',
])

export const TypeDpi = z.enum([
  'Hopital Manager',
  'ORBIS',
  'Care4U',
  'Easily',
  'Axigate',
  'ResUrgences',
  'Terminal Urgences',
  'Sillage',
  'Cerner',
  'UrQual',
  'TrakCare',
  'DxCare',
  'Xtreme Santé',
  'M-Crossway',
  'Mediburn',
  'Autre Lourd',
  'Autre Web',
  'Inconnu',
  'Maincare',
])

export const PrioriteTache = z.enum(['low', 'medium', 'high'])

export const StatutTache = z.enum(['A faire', 'En cours', 'Bloqué', 'Terminé'])

export const UserRole = z.enum(['admin', 'commercial', 'chef_projet', 'csm', 'manager'])

// Schémas de validation pour les formulaires
const EtablissementBaseSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  ville: z.string().min(1, 'La ville est requise').max(100, 'La ville est trop longue'),
  region: z.string().min(1, 'La région est requise').max(100, 'La région est trop longue'),
  pays: z.string().max(100, 'Le pays est trop long').optional(),
  type: EtablissementType,
  logo_url: z.string().url('URL invalide').max(500, 'URL trop longue').optional().or(z.literal('')),
  statut: EtablissementStatut.optional().default('Prospect'),
  adresse: z.string().max(500, "L'adresse est trop longue").optional(),
  code_postal: z.string().max(10, 'Le code postal est trop long').optional(),
  telephone: z.string().max(20, 'Le téléphone est trop long').optional(),
  email: z
    .string()
    .email('Email invalide')
    .max(255, 'Email trop long')
    .optional()
    .or(z.literal('')),
  date_prise_contact: z
    .string()
    .min(1, 'La date de prise de contact est requise')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  date_signature: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  date_fin_contrat: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  date_go_live: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  commercial_id: z
    .union([
      z.string().uuid('ID commercial invalide'),
      z.literal(''),
      z.literal('none'),
      z.literal('unassigned'),
    ])
    .optional(),
  chef_projet_id: z
    .union([
      z.string().uuid('ID chef de projet invalide'),
      z.literal(''),
      z.literal('none'),
      z.literal('unassigned'),
    ])
    .optional(),
  csm_id: z
    .union([
      z.string().uuid('ID CSM invalide'),
      z.literal(''),
      z.literal('none'),
      z.literal('unassigned'),
    ])
    .optional(),
  type_offre: z.string().max(100).optional(),
  pallier_vise: z.string().max(50).optional(),
  pallier_realise: z.string().max(50).optional(),
  notes: z.string().max(2000, 'Les notes sont trop longues').optional(),
  nombre_passages_urgences_annuel: z
    .number()
    .int()
    .min(0, 'Le nombre de passages aux urgences doit être supérieur ou égal à 0')
    .max(1000000, 'Le nombre de passages aux urgences ne peut pas dépasser 1 000 000')
    .optional(),
  dpi: TypeDpi.optional(),
  dpi_portail: z.enum(['hm', 'resurgences']).optional(),
  directeur_general_nom: z.string().max(100).optional(),
  directeur_general_prenom: z.string().max(100).optional(),
  directeur_general_email: z.string().email('Email invalide').max(255).optional().or(z.literal('')),
  siren_client: z.string().max(20).optional(),
  date_previsionnelle_signature: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  modules_proposes: z.array(z.string()).optional(),
  apporteurs_affaires_ids: z.array(z.string().uuid()).optional(),
  modele_statique_succes: z.string().max(100).optional(),
  seuils_palliers: z.record(z.string(), z.number()).optional(),
  tarifs_palliers: z.record(z.string(), z.number()).optional(),
  stats_utilisation_url: z.union([z.string().url('URL invalide'), z.literal('')]).optional(),
  stats_urgences_url: z.union([z.string().url('URL invalide'), z.literal('')]).optional(),
})

// Cohérence des dates (audit 2026-06-20 prompts 3 et 7)
const checkSignatureAfterContact = (data: {
  date_prise_contact?: string
  date_signature?: string
}) =>
  !data.date_prise_contact ||
  !data.date_signature ||
  data.date_signature === '' ||
  data.date_signature >= data.date_prise_contact

const checkFinAfterSignature = (data: { date_signature?: string; date_fin_contrat?: string }) =>
  !data.date_signature ||
  data.date_signature === '' ||
  !data.date_fin_contrat ||
  data.date_fin_contrat === '' ||
  data.date_fin_contrat >= data.date_signature

// Audit fullrun-0621-2355 : si pas de signature mais une date_fin_contrat saisie,
// elle doit au minimum être postérieure à la date de prise de contact.
const checkFinAfterContact = (data: { date_prise_contact?: string; date_fin_contrat?: string }) =>
  !data.date_prise_contact ||
  !data.date_fin_contrat ||
  data.date_fin_contrat === '' ||
  data.date_fin_contrat >= data.date_prise_contact

const checkPrevisionnelleAfterContact = (data: {
  date_prise_contact?: string
  date_previsionnelle_signature?: string
}) =>
  !data.date_prise_contact ||
  !data.date_previsionnelle_signature ||
  data.date_previsionnelle_signature === '' ||
  data.date_previsionnelle_signature >= data.date_prise_contact

export const CreateEtablissementSchema = EtablissementBaseSchema.refine(
  checkSignatureAfterContact,
  {
    message: 'La date de signature doit être postérieure à la date de prise de contact',
    path: ['date_signature'],
  }
)
  .refine(checkFinAfterSignature, {
    message: 'La date de fin de contrat doit être postérieure à la date de signature',
    path: ['date_fin_contrat'],
  })
  .refine(checkFinAfterContact, {
    message: 'La date de fin de contrat doit être postérieure à la date de prise de contact',
    path: ['date_fin_contrat'],
  })
  .refine(checkPrevisionnelleAfterContact, {
    message:
      'La date prévisionnelle de signature doit être postérieure à la date de prise de contact',
    path: ['date_previsionnelle_signature'],
  })

export const UpdateEtablissementSchema = EtablissementBaseSchema.partial()
  .refine(checkSignatureAfterContact, {
    message: 'La date de signature doit être postérieure à la date de prise de contact',
    path: ['date_signature'],
  })
  .refine(checkFinAfterSignature, {
    message: 'La date de fin de contrat doit être postérieure à la date de signature',
    path: ['date_fin_contrat'],
  })
  .refine(checkFinAfterContact, {
    message: 'La date de fin de contrat doit être postérieure à la date de prise de contact',
    path: ['date_fin_contrat'],
  })
  .refine(checkPrevisionnelleAfterContact, {
    message:
      'La date prévisionnelle de signature doit être postérieure à la date de prise de contact',
    path: ['date_previsionnelle_signature'],
  })

export const CreateTacheSchema = z.object({
  titre: z.string().min(1, 'Le titre est requis').max(255, 'Le titre est trop long'),
  description: z.string().max(2000, 'La description est trop longue').optional(),
  priorite: PrioriteTache.default('medium'),
  statut: StatutTache.default('A faire'),
  categorie_id: z.string().uuid('ID catégorie invalide'),
  etablissement_id: z.string().uuid('ID établissement invalide'),
  responsable_id: z.string().uuid('ID responsable invalide').optional(),
  date_debut: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  echeance: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  date_realisation: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  commentaires: z.string().max(2000, 'Les commentaires sont trop longs').optional(),
  ordre: z.number().int().min(0).optional(),
})

export const UpdateTacheSchema = CreateTacheSchema.partial()

export const CreateContactSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long'),
  prenom: z.string().max(100, 'Le prénom est trop long').optional(),
  fonction: z.string().min(1, 'La fonction est requise').max(100, 'La fonction est trop longue'),
  email: z
    .string()
    .email('Email invalide')
    .max(255, 'Email trop long')
    .optional()
    .or(z.literal('')),
  telephone: z.string().max(20, 'Le téléphone est trop long').optional(),
  etablissement_id: z.string().uuid('ID établissement invalide'),
  est_contact_principal: z.boolean().optional().default(false),
  type_contact: z.string().max(50).optional(),
})

export const UpdateContactSchema = CreateContactSchema.partial()

export const CreateProfileSchema = z.object({
  prenom: z.string().min(1, 'Le prénom est requis').max(100, 'Le prénom est trop long'),
  nom: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long'),
  email: z.string().email('Email invalide').max(255, 'Email trop long'),
  role: UserRole.default('commercial'),
  actif: z.boolean().optional().default(true),
})

export const UpdateProfileSchema = CreateProfileSchema.partial()

// Enums pour Partenaires
export const PartenaireType = z.enum(['institutionnel', 'industriel', 'prestataire'])

export const PartenaireStatutRelation = z.enum(['prospect', 'actif', 'inactif', 'termine'])

// Schéma de validation pour Partenaire
export const CreatePartenaireSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  type_partenaire: PartenaireType,
  logo_url: z.string().url('URL invalide').max(500, 'URL trop longue').optional().or(z.literal('')),
  sous_type: z.string().max(100, 'Le sous-type est trop long').optional(),
  adresse: z.string().max(500, "L'adresse est trop longue").optional(),
  code_postal: z.string().max(10, 'Le code postal est trop long').optional(),
  ville: z.string().max(100, 'La ville est trop longue').optional(),
  region: z.string().max(100, 'La région est trop longue').optional(),
  pays: z.string().max(100, 'Le pays est trop long').default('France'),
  telephone: z.string().max(20, 'Le téléphone est trop long').optional(),
  email: z
    .string()
    .email('Email invalide')
    .max(255, 'Email trop long')
    .optional()
    .or(z.literal('')),
  site_web: z.string().url('URL invalide').max(255, 'URL trop longue').optional().or(z.literal('')),
  email_domains: z.array(z.string()).optional().default([]),
  statut_relation: PartenaireStatutRelation.default('prospect'),
  date_debut_partenariat: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  date_fin_partenariat: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  responsable_marque_id: z.string().uuid('ID responsable invalide').optional().or(z.literal('')),
  engagement_score: z.number().int().min(0).max(100).default(0),
  dernier_contact: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  prochaine_action: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  valeur_partenariat: z.number().min(0).optional(),
  notes: z.string().max(5000, 'Les notes sont trop longues').optional(),
  tags: z.array(z.string()).optional().default([]),
})

export const UpdatePartenaireSchema = CreatePartenaireSchema.partial()

// Types TypeScript générés à partir des schémas Zod
export type CreateEtablissementData = z.infer<typeof CreateEtablissementSchema>
export type UpdateEtablissementData = z.infer<typeof UpdateEtablissementSchema>
export type CreateTacheData = z.infer<typeof CreateTacheSchema>
export type UpdateTacheData = z.infer<typeof UpdateTacheSchema>
export type CreateContactData = z.infer<typeof CreateContactSchema>
export type UpdateContactData = z.infer<typeof UpdateContactSchema>
export type CreateProfileData = z.infer<typeof CreateProfileSchema>
export type UpdateProfileData = z.infer<typeof UpdateProfileSchema>
export type CreatePartenaireData = z.infer<typeof CreatePartenaireSchema>
export type UpdatePartenaireData = z.infer<typeof UpdatePartenaireSchema>

// Types pour les données complètes depuis la base
export type EtablissementData = CreateEtablissementData & {
  id: string
  progression?: number
  created_at: string
  updated_at: string
  logo_url?: string | null
  contacts?: ContactData[]
  commercial?: { prenom: string; nom: string; email: string }
  chef_projet?: { prenom: string; nom: string; email: string }
  csm?: { prenom: string; nom: string; email: string }
}

export type TacheData = CreateTacheData & {
  id: string
  archive: boolean
  date_realisation?: string
  completed_by?: string
  created_at: string
  updated_at: string
}

export type ContactData = CreateContactData & {
  id: string
  created_at: string
  updated_at: string
}

export type ProfileData = CreateProfileData & {
  id: string
  user_id: string
  preferences?: Record<string, any>
  two_factor_enabled: boolean
  created_at: string
  updated_at: string
}

export type PartenaireData = CreatePartenaireData & {
  id: string
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
  responsable?: { prenom: string; nom: string; email: string }
}

// Schéma pour les métriques de santé client
export const HealthStatus = z.enum(['healthy', 'at-risk', 'churn-risk', 'critical', 'onboarding'])
export const PaymentStatus = z.enum(['on_time', 'late', 'overdue'])

export const UpdateHealthMetricsSchema = z.object({
  etablissement_id: z.string().uuid(),

  // Adoption - Métriques médicales
  taux_utilisation_cotation: z.number().min(0).max(100).optional(),
  taux_completion_dossier: z.number().min(0).max(100).optional(),

  // Engagement - Métriques UHCD et qualité médicale
  taux_uhcd_mono_rum: z.number().min(0).max(100).optional(),
  nombre_avis_specialise: z.number().int().min(0).optional(),
  nombre_ccmu_2_plus: z.number().int().min(0).optional(),
  nombre_ccmu_3_plus: z.number().int().min(0).optional(),

  // Support
  support_tickets_open: z.number().int().min(0).optional(),
  support_tickets_closed_30d: z.number().int().min(0).optional(),
  avg_resolution_time_hours: z.number().min(0).optional(),
  last_ticket_date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),

  // Satisfaction
  nps_score: z.number().min(0).max(10).optional(),
  nps_survey_date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  satisfaction_score: z.number().int().min(1).max(5).optional(),

  // Contrat et financier
  payment_status: PaymentStatus.optional(),
  contract_value: z.number().min(0).optional(),
  contract_start_date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  contract_end_date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'), z.literal('')])
    .optional(),
  roi_annuel: z.number().optional(),

  // Notes
  notes: z.string().max(2000).optional(),
})

export type UpdateHealthMetricsData = z.infer<typeof UpdateHealthMetricsSchema>
