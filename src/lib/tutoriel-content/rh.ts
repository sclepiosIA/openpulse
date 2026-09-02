import { TutorielModule } from '@/types/tutoriel'

export const rhModule: TutorielModule = {
  id: 'rh',
  title: 'People / RH',
  description: 'Gérez votre équipe, les salaires, documents RH et absences',
  icon: 'UserCog',
  category: 'finance',
  estimatedTime: '30 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'vue-ensemble',
      title: 'Vue d\'ensemble',
      description: 'KPIs RH et tableau de bord',
      steps: [
        {
          id: 'kpis-rh',
          title: 'KPIs RH',
          content: 'Le dashboard RH affiche : effectif total, nouveaux arrivants du mois, départs prévus, et taux de rotation.',
          detailedContent: `Le tableau de bord RH centralise tous les indicateurs clés de gestion des ressources humaines.

**Indicateurs principaux :**

| KPI | Description | Calcul |
|-----|-------------|--------|
| Effectif total | Nombre de collaborateurs actifs | Contrats en cours |
| Nouveaux | Arrivées du mois | Date embauche = mois courant |
| Départs | Prévus ce mois | Date fin contrat = mois courant |
| Turnover | Taux de rotation | (Départs / Effectif moyen) × 100 |

**Tendances affichées :**

• Évolution de l'effectif sur 12 mois
• Comparaison N vs N-1
• Projection fin d'année

**Alertes automatiques :**

• Contrat arrivant à échéance (30 jours)
• Période d'essai se terminant
• Anniversaire d'entreprise`,
          example: 'Effectif: 24 | +2 ce mois | 1 départ prévu | Turnover: 8%'
        },
        {
          id: 'masse-salariale',
          title: 'Masse salariale',
          content: 'Trois indicateurs de masse salariale : Nette (versée aux employés), Brute (avant cotisations salariales), Coût total employeur (brut + cotisations patronales).',
          detailedContent: `La masse salariale est décomposée pour une vision complète des coûts RH.

**Définitions :**

**Salaire Net** 💰

• Ce que perçoit réellement l'employé
• Après cotisations salariales
• Base pour le virement bancaire

**Salaire Brut** 📊

• Avant cotisations salariales
• Reference contractuelle
• Base de calcul des droits

**Coût Employeur** 💼

• Brut + cotisations patronales
• Coût réel pour l'entreprise
• Inclut : URSSAF, retraite, prévoyance, mutuelle

**Ratios clés :**
| Ratio | Calcul | Benchmark |
|-------|--------|-----------|
| Charges/Brut | Patronales / Brut | ~45% |
| Net/Brut | Net / Brut | ~78% |
| Coût/Net | Employeur / Net | ~180% |

**Graphique d'évolution :**
Courbe mensuelle sur 12 mois avec tendance et moyenne mobile.`,
          tip: 'Les valeurs annuelles sont calculées sur les 12 derniers mois réels, pas une extrapolation.',
          example: 'Mensuel : Net 85 000€ | Brut 110 000€ | Coût 158 000€'
        },
        {
          id: 'effectifs',
          title: 'Effectifs',
          content: 'Répartition des effectifs par département, par type de contrat (CDI, CDD, Stage) et évolution dans le temps.',
          detailedContent: `L'analyse des effectifs permet de piloter la structure organisationnelle.

**Répartitions disponibles :**

**Par département :**

• Commercial : X personnes
• Technique : Y personnes
• Support : Z personnes
• Direction : N personnes

**Par type de contrat :**
| Type | Description | Couleur |
|------|-------------|---------|
| CDI | Contrat durée indéterminée | 🟢 Vert |
| CDD | Contrat durée déterminée | 🟡 Orange |
| Stage | Conventions de stage | 🔵 Bleu |
| Alternance | Contrats pro/apprentissage | 🟣 Violet |

**Par ancienneté :**

• < 1 an : Nouveaux
• 1-3 ans : Confirmés
• 3-5 ans : Seniors
• > 5 ans : Piliers

**Pyramide des âges :**
Visualisation de la répartition par tranche d'âge pour anticiper les départs.`,
          example: 'CDI: 20 (83%) | CDD: 3 (12.5%) | Stage: 1 (4.5%)'
        }
      ]
    },
    {
      id: 'gestion-equipe',
      title: 'Gestion de l\'équipe',
      description: 'Gérez les membres de votre équipe',
      steps: [
        {
          id: 'liste-membres',
          title: 'Liste des membres',
          content: 'La liste affiche tous les membres de l\'équipe avec leur statut, rôle, et informations de contact. Cliquez sur un membre pour accéder à son dossier.',
          detailedContent: `L'interface de gestion d'équipe offre une vue complète de vos collaborateurs.

**Colonnes affichées :**

• Photo / Avatar
• Nom complet
• Poste / Fonction
• Département
• Date d'embauche
• Type de contrat
• Statut (Actif, En congé, Parti)

**Actions rapides :**

• 📧 Envoyer un email
• 📞 Appeler (si numéro renseigné)
• 📝 Ajouter une note
• 📁 Voir le dossier

**Filtres disponibles :**

• Par département
• Par type de contrat
• Par statut
• Par manager

**Tri :**

• Alphabétique (nom)
• Date d'embauche
• Ancienneté`,
          example: 'Marie Dupont | Dev Senior | Technique | CDI depuis 2021 | Active'
        },
        {
          id: 'fiches-employes',
          title: 'Fiches employés',
          content: 'Chaque employé a une fiche complète avec : informations personnelles, coordonnées, historique de carrière, documents, et absences.',
          detailedContent: `Le dossier employé centralise toutes les informations RH d'un collaborateur.

**Onglets disponibles :**

**📋 Informations générales**

• Nom, prénom, date de naissance
• Adresse, téléphone, email personnel
• Numéro de sécurité sociale
• Contact d'urgence

**💼 Contrat & Carrière**

• Type de contrat actuel
• Date d'embauche / fin prévue
• Poste et département
• Manager direct
• Historique des postes

**💰 Rémunération**

• Salaire brut actuel
• Historique des salaires
• Primes et avantages
• Bulletins de paie archivés

**📅 Absences**

• Soldes de congés (CP, RTT)
• Historique des absences
• Arrêts maladie

**📁 Documents**

• Contrat de travail
• Avenants
• Attestations
• Certificats de formation`,
          tip: 'Cliquez sur l\'onglet pour afficher la section correspondante.'
        },
        {
          id: 'roles-permissions',
          title: 'Rôles et permissions',
          content: 'Les rôles définissent les accès dans l\'application : Admin (tous accès), Commercial, Chef de projet, CSM, RH. Assignez le rôle approprié à chaque membre.',
          detailedContent: `Le système de rôles contrôle finement les accès et actions possibles.

**Rôles disponibles :**

| Rôle | Accès CRM | Accès RH | Accès Finance |
|------|-----------|----------|---------------|
| Admin | ✅ Complet | ✅ Complet | ✅ Complet |
| Manager | ✅ Complet | 👁️ Lecture | 👁️ Lecture |
| Commercial | ✅ Ses clients | ❌ Aucun | ❌ Aucun |
| Chef Projet | ✅ Ses projets | ❌ Aucun | ❌ Aucun |
| CSM | ✅ Ses clients | ❌ Aucun | ❌ Aucun |
| RH | 👁️ Lecture | ✅ Complet | 👁️ Salaires |
| User | 👁️ Lecture | 👁️ Soi-même | ❌ Aucun |

**Attribution des rôles :**

1. Accédez à la fiche de l'employé
2. Section "Rôle & Accès"
3. Sélectionnez le rôle
4. Enregistrez

**Multi-rôles :**
Un utilisateur peut avoir plusieurs rôles combinés.`,
          warning: 'Seuls les admins peuvent modifier les rôles. Limitez le nombre d\'administrateurs.'
        }
      ]
    },
    {
      id: 'salaires',
      title: 'Salaires',
      description: 'Gérez les salaires et bulletins de paie',
      steps: [
        {
          id: 'saisie-manuelle',
          title: 'Saisie manuelle',
          content: 'Créez un enregistrement de salaire avec : mois, montant brut, net payé, cotisations patronales. Utilisez cette option pour les corrections ou imports manuels.',
          detailedContent: `La saisie manuelle permet d'enregistrer les salaires sans bulletin PDF.

**Champs obligatoires :**

• Employé (sélection)
• Mois/Année de la paie
• Salaire brut
• Salaire net
• Cotisations patronales

**Champs optionnels :**

• Heures supplémentaires
• Primes (montant et libellé)
• Avantages en nature
• Indemnités diverses
• Notes internes

**Contrôles automatiques :**

• Cohérence brut/net/charges
• Alerte si écart important vs mois précédent
• Doublon (même mois déjà saisi)

**Calculs automatiques :**
Si vous ne renseignez que le brut, le système estime le net (~78%) et les charges (~45%).`,
          example: 'Février 2026 : Brut 4 500€ | Net 3 510€ | Charges 2 025€',
          tip: 'Utilisez cette fonction pour corriger une erreur d\'extraction IA.'
        },
        {
          id: 'upload-bulletins',
          title: 'Upload bulletins (PDF)',
          content: 'Importez directement les bulletins de paie au format PDF. Vous pouvez uploader plusieurs bulletins simultanément.',
          detailedContent: `L'import de bulletins PDF est la méthode recommandée pour sa fiabilité.

**Formats acceptés :**

• PDF (recommandé)
• Images (JPG, PNG) - OCR appliqué

**Import multiple :**

1. Cliquez sur "Importer des bulletins"
2. Sélectionnez plusieurs fichiers (Ctrl+clic)
3. Ou glissez-déposez un dossier
4. Validez l'import

**Limites :**

• Taille max par fichier : 10 Mo
• Nombre max par import : 50 fichiers
• Formats de bulletin supportés : 95%

**Nommage recommandé :**
\`NOM_Prénom_AAAA-MM.pdf\`
Exemple : DUPONT_Marie_2026-02.pdf

Le système détecte automatiquement le mois si le nommage est correct.`,
          tip: 'Nommez vos fichiers avec le format "NOM_Prénom_AAAA-MM.pdf" pour faciliter l\'association.',
          example: 'Import de 24 bulletins février 2026 → Traitement en ~30 secondes'
        },
        {
          id: 'parsing-ia',
          title: 'Parsing IA automatique',
          content: 'L\'IA GPT-5 analyse les bulletins PDF et extrait automatiquement : nom de l\'employé, période, salaire brut, net payé, cotisations. Validez ou corrigez les données extraites.',
          detailedContent: `L'extraction IA utilise Azure GPT-5 pour analyser les bulletins de paie.

**Données extraites :**

• Nom et prénom de l'employé
• Période (mois/année)
• Salaire brut
• Salaire net payé
• Cotisations salariales
• Cotisations patronales (si présentes)
• Heures travaillées
• Congés pris/restants

**Processus :**

1. Upload du PDF
2. Extraction du texte (OCR si image)
3. Analyse IA du contenu
4. Présentation des résultats
5. Validation ou correction manuelle
6. Enregistrement

**Précision :**
| Champ | Taux de réussite |
|-------|------------------|
| Nom employé | 98% |
| Période | 95% |
| Salaire brut | 92% |
| Salaire net | 94% |
| Cotisations | 88% |

**Formats supportés :**
La plupart des logiciels de paie français : ADP, Sage, Cegid, PayFit, Silae, etc.`,
          warning: 'Vérifiez toujours les données extraites. L\'IA peut faire des erreurs sur certains formats de bulletin.',
          tip: 'Les bulletins standardisés (ADP, PayFit) ont un meilleur taux d\'extraction.'
        },
        {
          id: 'historique-graphiques',
          title: 'Historique et graphiques',
          content: 'Consultez l\'historique des salaires de chaque employé avec des graphiques d\'évolution. Analysez les tendances et comparez avec les objectifs.',
          detailedContent: `L'historique salarial permet de suivre l'évolution de la rémunération.

**Vue individuelle :**

• Courbe d'évolution du salaire brut
• Comparaison brut/net/coût employeur
• Dates des augmentations
• Pourcentage d'évolution annuelle

**Vue globale (masse salariale) :**

• Total mensuel par catégorie
• Évolution sur 12/24/36 mois
• Répartition par département
• Benchmark interne (écarts à la moyenne)

**Analyses disponibles :**

• Évolution moyenne des salaires
• Impact des augmentations générales
• Écart hommes/femmes (index égalité)
• Coût des cotisations sociales

**Export :**
Téléchargez les graphiques en PNG ou les données en CSV.`,
          example: 'Marie Dupont : +8% sur 3 ans | Moyenne équipe : +6%'
        }
      ]
    },
    {
      id: 'documents-rh',
      title: 'Documents RH',
      description: 'Stockez et organisez les documents RH',
      steps: [
        {
          id: 'upload-documents',
          title: 'Upload documents',
          content: 'Uploadez les documents RH : contrats, avenants, attestations, certificats de formation. Les fichiers sont stockés de manière sécurisée.',
          detailedContent: `Le coffre-fort documentaire RH sécurise tous les documents sensibles.

**Types de documents :**

• Contrats de travail
• Avenants au contrat
• Bulletins de salaire (archivés)
• Attestations employeur
• Certificats de formation
• CV et lettres de motivation
• Évaluations annuelles
• Certificats médicaux

**Upload :**

1. Ouvrez le dossier de l'employé
2. Onglet "Documents"
3. Cliquez "Ajouter un document"
4. Sélectionnez le type
5. Choisissez le fichier
6. Validez

**Organisation automatique :**
Les documents sont classés par type et par date.`,
          tip: 'Utilisez des noms de fichiers explicites pour faciliter la recherche.'
        },
        {
          id: 'types-documents',
          title: 'Types de documents',
          content: 'Catégorisez vos documents : Contrat de travail, Avenant, Bulletin de salaire, Attestation employeur, CV, Lettre de recommandation, Certificat médical.',
          detailedContent: `La catégorisation facilite l'organisation et la recherche.

**Catégories prédéfinies :**

| Catégorie | Rétention | Accès |
|-----------|-----------|-------|
| Contrat | Permanent | RH + Admin |
| Avenant | Permanent | RH + Admin |
| Bulletin | 5 ans | RH + Employé |
| Attestation | 2 ans | RH + Employé |
| CV | Embauche | RH |
| Formation | 3 ans | RH + Employé |
| Médical | 5 ans | RH (restreint) |

**Personnalisation :**
Créez des catégories supplémentaires dans Paramètres > RH > Types de documents.

**Recherche :**
Recherchez par nom, type, employé ou date d'ajout.`
        },
        {
          id: 'telechargement-securise',
          title: 'Téléchargement sécurisé',
          content: 'Les documents sont accessibles uniquement aux utilisateurs autorisés (Admin, RH). Les URLs sont temporaires et expirent après téléchargement.',
          detailedContent: `La sécurité des documents RH est une priorité absolue.

**Mesures de sécurité :**

• Stockage chiffré (AES-256)
• URLs signées temporaires (15 min)
• Logs d'accès complets
• Watermark optionnel sur les PDF

**Contrôle d'accès :**
| Document | Employé concerné | RH | Admin |
|----------|------------------|-----|-------|
| Contrat | ✅ | ✅ | ✅ |
| Bulletin | ✅ | ✅ | ✅ |
| Médical | ❌ | ✅ | ❌ |
| Évaluation | ✅ | ✅ | ✅ |

**Audit trail :**
Chaque téléchargement est enregistré : qui, quand, quel document.`,
          tip: 'Les documents sensibles comme les bulletins ne sont accessibles qu\'au propriétaire et aux RH.',
          warning: 'Ne partagez jamais d\'URL de téléchargement par email.'
        }
      ]
    },
    {
      id: 'absences',
      title: 'Absences',
      description: 'Gérez les absences et congés',
      steps: [
        {
          id: 'soldes-conges',
          title: 'Soldes congés',
          content: 'Chaque employé a un compteur de jours : Congés payés (CP), RTT, Jours de récupération. Le solde est mis à jour automatiquement.',
          detailedContent: `Les compteurs de congés sont gérés automatiquement.

**Types de compteurs :**

| Type | Acquisition | Report |
|------|-------------|--------|
| CP | 2.5 j/mois | Oui (N+1) |
| RTT | Forfait annuel | Non |
| Récup | Sur demande | 3 mois |
| Ancienneté | Selon ancienneté | Oui |

**Calcul automatique :**

• Acquisition mensuelle (CP)
• Déduction lors d'une absence validée
• Report automatique fin de période

**Visualisation :**

• Solde actuel par type
• Historique des mouvements
• Projection fin d'année
• Alertes si solde bas`,
          example: 'CP: 18.5 jours | RTT: 6 jours | Récup: 2 jours'
        },
        {
          id: 'historique-absences',
          title: 'Historique des absences',
          content: 'Consultez l\'historique complet des absences : dates, type (CP, RTT, Maladie, Formation), durée et statut (Validée, En attente, Refusée).',
          detailedContent: `L'historique centralise toutes les absences passées et futures.

**Informations affichées :**

• Date de début et fin
• Type d'absence
• Durée (jours ouvrés)
• Statut de validation
• Valideur
• Commentaire éventuel

**Statuts possibles :**
| Statut | Description |
|--------|-------------|
| 🟡 En attente | Demande soumise |
| ✅ Validée | Approuvée |
| ❌ Refusée | Non approuvée |
| 🔵 Annulée | Par le demandeur |

**Filtres :**

• Par période (année, trimestre, mois)
• Par type d'absence
• Par statut`
        },
        {
          id: 'filtres-type-annee',
          title: 'Filtres par type/année',
          content: 'Filtrez les absences par type (Congé payé, Maladie, RTT) et par année pour une analyse ciblée.',
          detailedContent: `Les filtres permettent d'analyser les tendances d'absences.

**Filtres disponibles :**

**Par type :**

• Congés payés (CP)
• RTT
• Maladie
• Formation
• Événement familial
• Sans solde
• Autre

**Par période :**

• Année civile (2024, 2025, 2026)
• Période de référence (juin N à mai N+1)
• Trimestre
• Mois

**Analyses possibles :**

• Taux d'absentéisme par type
• Comparaison année N vs N-1
• Saisonnalité des absences
• Impact sur la charge de travail`,
          tip: 'Exportez les données filtrées pour vos rapports RH.'
        }
      ]
    },
    {
      id: 'planning',
      title: 'Planning',
      description: 'Visualisez les absences de l\'équipe',
      steps: [
        {
          id: 'calendrier-absences',
          title: 'Calendrier des absences',
          content: 'Le calendrier affiche les absences de toute l\'équipe avec un code couleur par type. Identifiez les périodes creuses et les conflits de planning.',
          detailedContent: `Le calendrier d'équipe offre une vue globale des disponibilités.

**Vues disponibles :**

• Mois (vue par défaut)
• Semaine (détail jour par jour)
• Année (vue d'ensemble)

**Code couleur :**
| Type | Couleur |
|------|---------|
| CP | 🟢 Vert |
| RTT | 🔵 Bleu |
| Maladie | 🔴 Rouge |
| Formation | 🟣 Violet |
| Autre | ⚪ Gris |

**Interactions :**

• Cliquez sur une absence pour voir les détails
• Survolez pour un aperçu rapide
• Filtrez par département ou personne`,
          example: 'Semaine 32 : 8 personnes absentes (35% de l\'équipe)'
        },
        {
          id: 'vue-equipe',
          title: 'Vue équipe',
          content: 'Visualisez côte à côte les absences de tous les membres pour planifier les réunions et les projets.',
          detailedContent: `La vue équipe permet d'identifier les chevauchements d'absences.

**Affichage :**

• Ligne par collaborateur
• Colonnes par jour
• Barres colorées pour les absences

**Fonctionnalités :**

• Zoom semaine/mois/trimestre
• Filtrage par département
• Export pour réunions d'équipe

**Alertes visuelles :**

• Rouge : >50% équipe absente
• Orange : >30% équipe absente
• Vert : Effectif normal

**Utilisation :**
Idéal pour planifier des réunions importantes ou des deadlines projet.`,
          tip: 'Évitez les réunions importantes pendant les périodes de forte absence (été, fêtes).'
        }
      ]
    },
    {
      id: 'onboarding-offboarding',
      title: 'Onboarding & Offboarding',
      description: 'Gérez les arrivées et départs des collaborateurs',
      steps: [
        {
          id: 'checklist-arrivee',
          title: 'Checklist d\'arrivée',
          content: 'Une checklist automatique est générée pour chaque nouvel arrivant : création des accès, attribution du matériel, formation initiale, etc.',
          detailedContent: `L'onboarding est structuré par une checklist personnalisable.

**Tâches standard d'arrivée :**

**Avant l'arrivée (J-7)**

• ☐ Préparer le poste de travail
• ☐ Créer les comptes (email, OpenPulse)
• ☐ Commander le matériel
• ☐ Préparer le contrat

**Jour J**

• ☐ Accueil et visite des locaux
• ☐ Remise du matériel
• ☐ Signature du contrat
• ☐ Photo pour badge/profil

**Première semaine**

• ☐ Formation outils internes
• ☐ Présentation de l'équipe
• ☐ Objectifs de la période d'essai

**Personnalisation :**
Paramètres > RH > Checklists d'onboarding`,
          tip: 'Assignez un "buddy" pour accompagner le nouvel arrivant.'
        },
        {
          id: 'checklist-depart',
          title: 'Checklist de départ',
          content: 'Lors d\'un départ, une checklist garantit que toutes les procédures sont suivies : récupération du matériel, clôture des accès, solde de tout compte.',
          detailedContent: `L'offboarding sécurise la sortie d'un collaborateur.

**Tâches standard de départ :**

**2 semaines avant**

• ☐ Entretien de départ
• ☐ Planification de la passation
• ☐ Documentation des projets en cours

**Dernière semaine**

• ☐ Passation effective
• ☐ Sauvegarde des données
• ☐ Retour du matériel

**Jour du départ**

• ☐ Clôture des accès informatiques
• ☐ Remise des documents (certificat travail, attestation Pôle Emploi)
• ☐ Solde de tout compte

**Post-départ**

• ☐ Archivage du dossier
• ☐ Mise à jour des organigrammes`,
          warning: 'Désactivez les accès informatiques le jour du départ pour des raisons de sécurité.'
        }
      ]
    },
    {
      id: 'exports-rh',
      title: 'Exports',
      description: 'Exportez vos données RH',
      steps: [
        {
          id: 'export-csv',
          title: 'Export CSV',
          content: 'Exportez les données de salaires, absences ou effectifs au format CSV pour vos tableaux Excel et analyses.',
          detailedContent: `L'export CSV permet d'exploiter les données dans d'autres outils.

**Données exportables :**

• Liste des employés
• Historique des salaires
• Registre des absences
• Compteurs de congés

**Personnalisation :**

• Sélection des colonnes
• Filtres appliqués (période, département)
• Format de date (FR/EN)
• Séparateur (virgule, point-virgule)

**Usage typique :**

• Reporting mensuel
• Déclarations sociales
• Analyses Excel/Google Sheets`,
          example: 'Export salaires Q1 2026 : 72 lignes, 15 colonnes, fichier 45 Ko'
        },
        {
          id: 'export-sepa',
          title: 'Export SEPA XML',
          content: 'Générez un fichier SEPA XML pour les virements de salaires. Compatible avec la plupart des logiciels bancaires.',
          detailedContent: `L'export SEPA simplifie le paiement des salaires.

**Format :**

• SEPA Credit Transfer (SCT)
• ISO 20022 XML
• Compatible toutes banques européennes

**Données incluses :**

• IBAN/BIC du bénéficiaire
• Montant du virement
• Libellé (référence paie)
• Date d'exécution

**Processus :**

1. Sélectionnez la période de paie
2. Vérifiez les montants et IBAN
3. Générez le fichier XML
4. Importez dans votre espace bancaire
5. Validez les virements

**Contrôles avant génération :**

• IBAN valides
• Montants cohérents
• Doublons détectés`,
          tip: 'Vérifiez les IBAN avant de générer le fichier SEPA.',
          warning: 'Conservez une copie du fichier XML comme preuve de virement.'
        }
      ]
    }
  ]
}
