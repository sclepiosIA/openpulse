import {
  Shield, Eye, Minimize2, Lock, UserCheck, FileCheck, Scale,
  Server, MapPin, KeyRound, HardDrive,
  ShieldCheck, Fingerprint, ScrollText, Bug, Layers, Award,
  UserCog, Pencil, Trash2, ArrowRightLeft, Ban, Pause, Clock,
  type LucideIcon
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
export interface DpoStat {
  label: string;
  value: string;
  icon: string;
}

export interface DpoEngagement {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface DpoHebergementItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface DpoSecuriteItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface DpoTraitement {
  finalite: string;
  baseLegale: string;
  categories: string;
  conservation: string;
}

export interface DpoDroit {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface DpoFaq {
  question: string;
  answer: string;
}

export interface DpoConfig {
  slug: string;
  etablissement: string;
  stats: DpoStat[];
  contactDpo: {
    name: string;
    email: string;
    phone?: string;
    adresse?: string;
  };
  engagements: DpoEngagement[];
  hebergement: DpoHebergementItem[];
  securite: DpoSecuriteItem[];
  traitements: DpoTraitement[];
  droits: DpoDroit[];
  faq: DpoFaq[];
}

// ─── Config établissement exemple ────────────────────────────────────────
export const dpoConfigExemple: DpoConfig = {
  slug: "exemple",
  etablissement: "Établissement exemple",

  stats: [
    { label: "Hébergement certifié", value: "Azure HDS", icon: "🏥" },
    { label: "Conformité", value: "RGPD", icon: "✅" },
    { label: "Après analyse IA", value: "Suppression instantanée", icon: "🔒" },
  ],

  contactDpo: {
    name: "Délégué à la Protection des Données (DPO)",
    email: "dpo@exploitant.example.org",
    adresse: "Marque IA SAS — DPO, 210 Boulevard Constantin Descat, 59200 Tourcoing",
  },

  engagements: [
    {
      title: "Transparence",
      description:
        "Conformément à l'article 6 de nos CGU, l'établissement s'engage à informer les patients de l'utilisation de OpenPulse avant tout traitement de leurs données. Toute collecte est réalisée de manière loyale et transparente.",
      icon: Eye,
    },
    {
      title: "Minimisation",
      description:
        "Les données patient sont pseudonymisées en local avant tout envoi au modèle d'IA. Le LLM ne reçoit aucune donnée nominative : noms, adresses, dates de naissance, n° de sécurité sociale et n° de dossier sont systématiquement supprimés.",
      icon: Minimize2,
    },
    {
      title: "Sécurité",
      description:
        "Chiffrement AES-256 GCM au repos, TLS 1.3 en transit, hébergement sur serveurs Microsoft Azure certifiés HDS. Chaque requête utilise une clé de chiffrement unique pour garantir la confidentialité des échanges.",
      icon: Lock,
    },
    {
      title: "Consentement",
      description:
        "L'utilisation de OpenPulse est subordonnée à l'acceptation explicite des Conditions Générales d'Utilisation via un bouton « J'accepte ». L'établissement reste responsable du recueil du consentement des patients.",
      icon: UserCheck,
    },
    {
      title: "Portabilité",
      description:
        "Conformément à l'article 15 du RGPD, vous pouvez obtenir une copie de vos données personnelles dans un format structuré et lisible par machine, transmise à l'adresse email de votre choix.",
      icon: FileCheck,
    },
    {
      title: "Accountability",
      description:
        "OpenPulse documente sa conformité : Analyse d'Impact (AIPD), registre des sous-traitants, audits réguliers. Le sous-traitant met à disposition du responsable de traitement toutes les informations nécessaires pour démontrer le respect des obligations RGPD.",
      icon: Scale,
    },
  ],

  hebergement: [
    {
      title: "Microsoft Azure certifié HDS",
      description:
        "Toutes les données de santé sont hébergées sur l'infrastructure Microsoft Azure, certifiée Hébergeur de Données de Santé (HDS) conformément à l'article L.1111-8 du Code de la santé publique. Azure dispose également des certifications ISO 27001, SOC 2 Type 2 et ISO 27018.",
      icon: Server,
    },
    {
      title: "Aucun transfert hors Union Européenne",
      description:
        "Les données sont exclusivement stockées sur des serveurs situés en France et dans l'Union Européenne. Aucun transfert de données n'est réalisé hors de l'Union Européenne, conformément aux articles 44 à 49 du RGPD.",
      icon: MapPin,
    },
    {
      title: "Chiffrement au repos AES-256 GCM",
      description:
        "Toutes les données sont chiffrées au repos avec l'algorithme AES-256 GCM. Les identifiants patients (IEP) sont hashés via SHA-256 pour garantir l'intégrité et la confidentialité, même en cas d'accès physique aux serveurs.",
      icon: KeyRound,
    },
    {
      title: "Chiffrement en transit TLS 1.3",
      description:
        "Les communications sont protégées par TLS 1.3. Les échanges entre le backend et le LLM transitent via un réseau privé virtuel (VNet) Azure, empêchant toute interception par un tiers.",
      icon: HardDrive,
    },
  ],

  securite: [
    {
      title: "Pseudonymisation systématique",
      description:
        "Un algorithme dédié supprime automatiquement noms, prénoms, adresses, dates de naissance, numéros de téléphone, numéros de sécurité sociale et numéros de dossier avant tout envoi au modèle d'IA. Le LLM ne peut ni recevoir ni renvoyer de données nominatives.",
      icon: Fingerprint,
    },
    {
      title: "Chiffrement AES-256 GCM par requête",
      description:
        "Chaque requête est chiffrée en local avec une clé unique avant transmission. Ce chiffrement de bout en bout garantit que seuls les systèmes autorisés peuvent déchiffrer les données échangées.",
      icon: ShieldCheck,
    },
    {
      title: "Suppression instantanée",
      description:
        "Aucune donnée patient n'est conservée après analyse par le LLM. Les données sont supprimées immédiatement après le traitement. Azure OpenAI ne stocke ni les prompts ni les résultats (opt-out abuse monitoring activé).",
      icon: Trash2,
    },
    {
      title: "Session privée Azure OpenAI",
      description:
        "Le modèle d'IA fonctionne en session fermée sur Azure OpenAI, isolé via un réseau privé virtuel (VNet). Aucun accès tiers n'est possible. Les données ne sont pas utilisées pour entraîner le modèle.",
      icon: Lock,
    },
    {
      title: "Cloisonnement par niveaux de visibilité",
      description:
        "Les données sont classifiées en 4 niveaux : données anonymes, données pseudonymisées, identifiants patients (IEP hashé), identifiants utilisateurs. Chaque niveau a des règles d'accès et de traitement distinctes.",
      icon: Layers,
    },
    {
      title: "Conformité SOC 2 Type 2 & démarche ISO 27001",
      description:
        "L'infrastructure Azure est certifiée SOC 2 Type 2, garantissant des contrôles de sécurité audités. OpenPulse s'inscrit dans une démarche de certification ISO 27001 pour son système de management de la sécurité de l'information.",
      icon: Award,
    },
  ],

  traitements: [
    {
      finalite: "Codage CIM-10 (diagnostics)",
      baseLegale: "À définir par le responsable de traitement (hôpital)",
      categories: "Données médicales pseudonymisées issues du DPI (comptes rendus, observations, résultats)",
      conservation: "Durée du contrat — suppression instantanée après analyse",
    },
    {
      finalite: "Codage CCAM (actes médicaux)",
      baseLegale: "À définir par le responsable de traitement (hôpital)",
      categories: "Données médicales pseudonymisées issues du DPI (actes, interventions, protocoles)",
      conservation: "Durée du contrat — suppression instantanée après analyse",
    },
    {
      finalite: "Scores IOA (tri aux urgences)",
      baseLegale: "À définir par le responsable de traitement (hôpital)",
      categories: "Données cliniques pseudonymisées (motifs de consultation, constantes, symptômes)",
      conservation: "Durée du contrat — suppression instantanée après analyse",
    },
    {
      finalite: "Prescriptions & courriers médicaux",
      baseLegale: "À définir par le responsable de traitement (hôpital)",
      categories: "Données médicales pseudonymisées, traduction multilingue",
      conservation: "Durée du contrat — suppression instantanée après analyse",
    },
    {
      finalite: "Maintenance, support technique & amélioration du service",
      baseLegale: "Intérêt légitime (Art. 6.1.f RGPD)",
      categories: "Données d'utilisation, rapports de bug, journaux techniques (aucune donnée patient)",
      conservation: "Durée du contrat",
    },
    {
      finalite: "Questionnaire de satisfaction utilisateurs",
      baseLegale: "Intérêt légitime (Art. 6.1.f RGPD)",
      categories: "Identité professionnelle, fonction, avis et commentaires",
      conservation: "1 an après réception",
    },
  ],

  droits: [
    {
      title: "Droit d'accès (art. 15 RGPD)",
      description:
        "Vous pouvez obtenir la confirmation que des données vous concernant sont traitées et en recevoir une copie, transmise à l'adresse email de votre choix, dans un délai de 30 jours.",
      icon: Eye,
    },
    {
      title: "Droit de rectification (art. 16 RGPD)",
      description:
        "Vous pouvez demander la correction de données inexactes ou incomplètes vous concernant. La rectification est effectuée dans les meilleurs délais.",
      icon: Pencil,
    },
    {
      title: "Droit à l'effacement (art. 17 RGPD)",
      description:
        "Vous pouvez demander la suppression de vos données personnelles, sous réserve des obligations légales de conservation et de l'existence d'un motif légitime.",
      icon: Trash2,
    },
    {
      title: "Droit à la limitation (art. 18 RGPD)",
      description:
        "Vous pouvez demander la suspension provisoire du traitement de vos données, notamment en cas de contestation de l'exactitude des données ou d'opposition au traitement.",
      icon: Pause,
    },
    {
      title: "Droit d'opposition (art. 21 RGPD)",
      description:
        "Vous pouvez vous opposer au traitement de vos données fondé sur l'intérêt légitime, pour des motifs tenant à votre situation particulière. Le responsable de traitement doit alors justifier de raisons impérieuses.",
      icon: Ban,
    },
    {
      title: "Droit post-mortem",
      description:
        "Vous pouvez définir des directives relatives à la conservation, l'effacement et la communication de vos données personnelles après votre décès, conformément à la loi Informatique et Libertés.",
      icon: Clock,
    },
  ],

  faq: [
    {
      question: "À qui mes données de santé sont-elles communiquées ?",
      answer:
        "Les données traitées par OpenPulse sont accessibles uniquement à l'équipe de soins de l'établissement, au département d'information médicale (DIM) et aux administrateurs OpenPulse soumis à un strict contrat de confidentialité. Aucune donnée n'est revendue ou communiquée à des tiers commerciaux.",
    },
    {
      question: "Où sont stockées mes données ?",
      answer:
        "Toutes les données sont hébergées sur Microsoft Azure, certifié Hébergeur de Données de Santé (HDS), sur des serveurs situés en France et dans l'Union Européenne. Aucun transfert de données n'est réalisé hors de l'Union Européenne.",
    },
    {
      question: "Combien de temps mes données sont-elles conservées ?",
      answer:
        "Les données médicales du DPI sont conservées par l'hôpital selon la réglementation en vigueur (jusqu'à 20 ans pour un dossier médical). Les données traitées par l'IA sont supprimées instantanément après analyse. Les questionnaires de satisfaction sont conservés 1 an. Les données techniques sont conservées pendant la durée du contrat.",
    },
    {
      question: "Comment exercer mes droits sur mes données ?",
      answer:
        "Vous pouvez exercer vos droits (accès, rectification, effacement, limitation, opposition) en contactant notre Délégué à la Protection des Données (DPO) par email à dpo@exploitant.example.org ou par courrier à : Marque IA SAS — DPO, 210 Boulevard Constantin Descat, 59200 Tourcoing. Nous répondons dans un délai de 30 jours. Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).",
    },
    {
      question: "L'intelligence artificielle a-t-elle accès aux données nominatives des patients ?",
      answer:
        "Non. Un algorithme de pseudonymisation supprime systématiquement les noms, prénoms, adresses, dates de naissance, numéros de sécurité sociale et numéros de dossier avant tout envoi au modèle d'IA. Le LLM ne peut ni recevoir ni renvoyer d'identifiants personnels.",
    },
    {
      question: "OpenPulse est-il un dispositif médical ?",
      answer:
        "Non. OpenPulse n'est pas un dispositif médical au sens du Règlement (UE) 2017/745 (MDR). Sa destination d'usage est exclusivement documentaire, administrative et de valorisation : optimiser la complétude, la traçabilité et la structuration des dossiers médicaux à des fins PMSI / T2A. L'outil n'établit, ne modifie ni n'influence aucun diagnostic, ne recommande aucune thérapeutique et ne surveille aucun paramètre physiologique. Le professionnel de santé conserve l'entière responsabilité de ses décisions cliniques ; les propositions rédactionnelles de l'IA sont systématiquement validées par le praticien.",
    },
    {
      question: "Qui est responsable du traitement des données ?",
      answer:
        "L'établissement de santé (hôpital, clinique) est le responsable de traitement au sens du RGPD. OpenPulse SAS intervient en qualité de sous-traitant, conformément à l'article 28 du RGPD et au contrat de sous-traitance (DPA) signé avec chaque établissement.",
    },
  ],
};

// ─── Registry par slug (pour future extensibilité) ────────────
export const dpoConfigs: Record<string, DpoConfig> = {
  exemple: dpoConfigExemple,
};
