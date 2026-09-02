/**
 * Ce qu'un administrateur renseigne au premier lancement.
 *
 * Chaque entrée décrit un champ : où il atterrit dans `app_config`, ce qu'il
 * change pour l'utilisateur, et ce qui se passe s'il reste vide. Cette dernière
 * colonne est la plus importante : plusieurs de ces réglages se dégradent en
 * SILENCE — une facture sort au nom de l'éditeur d'origine, un courriel part
 * d'une adresse qui n'existe pas — et rien dans l'interface ne le signale.
 *
 * Les clés reprennent celles que les hooks existants lisent déjà
 * (`src/hooks/shared/useAppConfig.ts`) : l'assistant remplit une configuration
 * que le reste de l'application sait consommer, il n'en invente pas une autre.
 */

export type GroupeChamp = 'marque' | 'identite' | 'coordonnees' | 'courriel' | 'documents' | 'liens'

export interface DefinitionChamp {
  /** Nom du champ dans l'objet JSON de la clé. */
  nom: string
  /** Libellé affiché à l'administrateur. */
  libelle: string
  /** Ce que ce champ change concrètement. Affiché sous le champ. */
  aide: string
  /** Un champ obligatoire bloque le passage à l'étape suivante. */
  obligatoire?: boolean
  /** Type de saisie et de contrôle. */
  type?: 'texte' | 'courriel' | 'url' | 'telephone' | 'zone'
  /** Exemple montré en filigrane. Jamais une valeur réelle. */
  exemple?: string
}

export interface EtapeConfiguration {
  id: GroupeChamp
  titre: string
  /** Une phrase disant pourquoi cette étape existe. */
  intention: string
  /** Clé `app_config` où l'étape écrit son objet. */
  cle: string
  categorie: string
  description: string
  champs: DefinitionChamp[]
}

export const ETAPES: EtapeConfiguration[] = [
  {
    id: 'marque',
    titre: 'Votre marque',
    intention:
      "Le nom et le logo affichés dans l'application. Ils remplacent ceux livrés par défaut, sans qu'il soit nécessaire de reconstruire l'application.",
    cle: 'marque',
    categorie: 'identite',
    description: 'Identité de marque appliquée à chaud, par-dessus les valeurs de construction',
    champs: [
      {
        nom: 'nomProduit',
        libelle: 'Nom affiché',
        aide: "Apparaît sur l'écran de connexion, dans la barre latérale et l'onglet du navigateur.",
        obligatoire: true,
        exemple: 'Ma Société',
      },
      {
        nom: 'nomCourt',
        libelle: 'Nom court',
        aide: "Utilisé là où la place manque, notamment sur l'icône de l'application installée.",
        exemple: 'MaSoc',
      },
      {
        nom: 'baseline',
        libelle: 'Accroche',
        aide: "Une phrase sous le nom, sur l'écran de connexion. Laissez vide pour n'en afficher aucune.",
        exemple: 'La gestion, simplement.',
      },
      {
        nom: 'url',
        libelle: 'Site public',
        aide: 'Adresse de votre site, citée dans les mentions légales.',
        type: 'url',
        exemple: 'https://mon-domaine.fr',
      },
      {
        nom: 'logo',
        libelle: 'Adresse du logo',
        aide: "Chemin ou URL d'une image. Laissez vide pour garder le logo livré.",
        exemple: 'https://mon-domaine.fr/logo.svg',
      },
    ],
  },
  {
    id: 'identite',
    titre: 'Votre organisation',
    intention: "Le nom qui apparaît dans l'application, sur vos documents et dans vos courriels.",
    cle: 'company_info',
    categorie: 'identite',
    description: "Identité de l'organisation qui exploite cette instance",
    champs: [
      {
        nom: 'name',
        libelle: 'Nom de l’organisation',
        aide: "Affiché dans l'en-tête des documents et le pied de page des courriels.",
        obligatoire: true,
        exemple: 'Ma Société',
      },
      {
        nom: 'email',
        libelle: 'Adresse de contact',
        aide: "Adresse publique de votre organisation, celle qu'un client utilise pour vous joindre.",
        obligatoire: true,
        type: 'courriel',
        exemple: 'contact@mon-domaine.fr',
      },
      {
        nom: 'phone',
        libelle: 'Téléphone',
        aide: 'Figure sur les documents émis.',
        type: 'telephone',
        exemple: '01 99 00 00 00',
      },
      {
        nom: 'address',
        libelle: 'Adresse',
        aide: 'Numéro et voie.',
        exemple: '1 rue de l’Exemple',
      },
      { nom: 'city', libelle: 'Code postal et ville', aide: '', exemple: '75000 Paris' },
    ],
  },
  {
    id: 'coordonnees',
    titre: 'Mentions légales',
    intention:
      'Ces informations figurent sur vos factures et vos devis. Une facture sans elles n’est pas conforme.',
    cle: 'company_info_legal',
    categorie: 'identite',
    description: 'Identifiants légaux et coordonnées bancaires',
    champs: [
      {
        nom: 'siret',
        libelle: 'SIRET ou identifiant d’entreprise',
        aide: 'Obligatoire sur une facture émise en France.',
        exemple: '000 000 000 00000',
      },
      {
        nom: 'tva_intracom',
        libelle: 'Numéro de TVA intracommunautaire',
        aide: 'Requis dès que vous facturez dans l’Union européenne.',
        exemple: 'FR00000000000',
      },
      {
        nom: 'iban',
        libelle: 'IBAN',
        aide: 'Apparaît sur les factures pour le règlement par virement.',
        exemple: 'FR76 0000 0000 0000 0000 0000 000',
      },
      { nom: 'bic', libelle: 'BIC', aide: '', exemple: 'XXXXFRPPXXX' },
    ],
  },
  {
    id: 'courriel',
    titre: 'Courriels sortants',
    intention:
      'Les adresses d’expédition de l’application. Renseignez des adresses qui existent réellement sur votre domaine : un envoi depuis une adresse inconnue est rejeté par la plupart des messageries.',
    cle: 'email_sender',
    categorie: 'courriel',
    description: 'Adresses d’expédition des courriels automatiques',
    champs: [
      {
        nom: 'default_from',
        libelle: 'Expéditeur par défaut',
        aide: 'Utilisé quand aucune adresse plus précise ne s’applique.',
        obligatoire: true,
        type: 'courriel',
        exemple: 'ne-pas-repondre@mon-domaine.fr',
      },
      {
        nom: 'notifications_from',
        libelle: 'Notifications',
        aide: 'Alertes et rappels automatiques.',
        type: 'courriel',
        exemple: 'notifications@mon-domaine.fr',
      },
      {
        nom: 'support_from',
        libelle: 'Assistance',
        aide: 'Réponses aux demandes d’assistance.',
        type: 'courriel',
        exemple: 'support@mon-domaine.fr',
      },
      {
        nom: 'formations_from',
        libelle: 'Formations',
        aide: 'Convocations et suivis de formation.',
        type: 'courriel',
        exemple: 'formations@mon-domaine.fr',
      },
    ],
  },
  {
    id: 'documents',
    titre: 'Pied de page des documents',
    intention:
      'Ce bloc apparaît au bas de chaque PDF que vous produisez : devis, factures, contrats.',
    cle: 'document_footer',
    categorie: 'documents',
    description: 'Bloc de pied de page des documents engendrés',
    champs: [
      {
        nom: 'company_name',
        libelle: 'Nom affiché',
        aide: 'Reprenez le nom de l’étape précédente, ou une raison sociale complète.',
        obligatoire: true,
        exemple: 'Ma Société',
      },
      {
        nom: 'email',
        libelle: 'Adresse affichée',
        aide: '',
        type: 'courriel',
        exemple: 'contact@mon-domaine.fr',
      },
      {
        nom: 'phone',
        libelle: 'Téléphone affiché',
        aide: '',
        type: 'telephone',
        exemple: '01 99 00 00 00',
      },
      {
        nom: 'confidential_text',
        libelle: 'Mention de confidentialité',
        aide: 'Laissez vide si vous n’en voulez pas.',
        type: 'zone',
        exemple: 'Document confidentiel — diffusion restreinte.',
      },
    ],
  },
  {
    id: 'liens',
    titre: 'Adresse publique',
    intention:
      'L’adresse à laquelle vos utilisateurs joignent l’application. Elle sert à fabriquer les liens envoyés par courriel : sans elle, ces liens ne mènent nulle part.',
    cle: 'production_url',
    categorie: 'infrastructure',
    description: 'Adresse publique de l’instance',
    champs: [
      {
        nom: 'url',
        libelle: 'Adresse de l’application',
        aide: 'Avec https://, sans barre oblique finale.',
        obligatoire: true,
        type: 'url',
        exemple: 'https://gestion.mon-domaine.fr',
      },
    ],
  },
]

/** Contrôles de saisie. Volontairement permissifs : ils écartent les fautes de
 *  frappe, ils ne prétendent pas valider un format à la lettre. */
export function verifierChamp(champ: DefinitionChamp, valeur: string): string | null {
  const v = valeur.trim()
  if (champ.obligatoire && !v) return 'Ce champ est nécessaire pour continuer.'
  if (!v) return null

  if (champ.type === 'courriel' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    return 'Cette adresse ne ressemble pas à une adresse électronique.'
  }
  if (champ.type === 'url') {
    try {
      const u = new URL(v)
      if (!['http:', 'https:'].includes(u.protocol)) return 'L’adresse doit commencer par https://.'
    } catch {
      return 'Cette adresse n’est pas une URL valide.'
    }
  }
  return null
}
