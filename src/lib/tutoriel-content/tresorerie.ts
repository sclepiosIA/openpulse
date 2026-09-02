import { TutorielModule } from '@/types/tutoriel'

export const tresorerieModule: TutorielModule = {
  id: 'tresorerie',
  title: 'Trésorerie',
  description: 'Gérez vos finances : revenus, dépenses et prévisions',
  icon: 'Euro',
  category: 'finance',
  estimatedTime: '25 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'dashboard-financier',
      title: 'Dashboard financier',
      description: 'Vue d\'ensemble de votre situation financière',
      steps: [
        {
          id: 'solde-actuel',
          title: 'Solde actuel',
          content: 'Le solde bancaire actuel issu de la synchronisation Qonto. Ce KPI se met à jour automatiquement lors de chaque synchronisation.',
          detailedContent: `Le solde actuel représente la position de trésorerie en temps réel de votre entreprise.

**Sources du solde :**

• Synchronisation Qonto (automatique toutes les heures)
• Mise à jour manuelle possible via le bouton "Actualiser"

**Indicateurs visuels :**

• 🟢 Vert : Solde confortable (> 2 mois de charges)
• 🟡 Orange : Attention (1-2 mois de charges)
• 🔴 Rouge : Critique (< 1 mois de charges)

**Calcul du seuil critique :**
Moyenne des dépenses mensuelles × Nombre de mois de sécurité souhaité`,
          tip: 'Configurez une alerte automatique quand le solde passe sous votre seuil de sécurité.'
        },
        {
          id: 'revenus-mensuels',
          title: 'Revenus mensuels',
          content: 'Total des revenus du mois en cours : encaissés (reçus sur le compte) et prévus (attendus selon les contrats).',
          detailedContent: `Les revenus mensuels sont décomposés en deux catégories principales :

**Revenus encaissés (confirmés)**

• Paiements reçus sur le compte bancaire
• Virement SEPA, CB, prélèvement
• Rapprochés automatiquement avec les factures

**Revenus prévus (attendus)**

• Basés sur les échéances contractuelles
• Factures émises non encore payées
• Récurrences automatiques des contrats

**Graphique d'évolution :**

• Comparaison N vs N-1
• Tendance sur 12 mois glissants
• Saisonnalité détectée automatiquement`,
          example: 'Janvier 2026 : 45 000€ encaissés + 12 000€ prévus = 57 000€ de revenus totaux'
        },
        {
          id: 'depenses-mensuelles',
          title: 'Dépenses mensuelles',
          content: 'Total des dépenses du mois : salaires, cotisations sociales, fournisseurs et frais généraux.',
          detailedContent: `Les dépenses sont catégorisées pour une analyse fine de votre structure de coûts.

**Catégories principales :**

| Catégorie | Exemple | % typique |
|-----------|---------|-----------|
| Salaires nets | Paie des collaborateurs | 35-45% |
| Cotisations sociales | URSSAF, retraite | 15-20% |
| Hébergement | Serveurs, cloud | 5-10% |
| Marketing | Publicité, événements | 5-15% |
| Frais généraux | Loyer, fournitures | 10-15% |

**Alertes automatiques :**

• Dépassement du budget par catégorie
• Variation anormale vs mois précédent
• Nouvelle dépense non catégorisée`,
          tip: 'Utilisez les filtres pour analyser l\'évolution d\'une catégorie spécifique.'
        },
        {
          id: 'a-encaisser',
          title: 'À encaisser',
          content: 'Montant des revenus attendus mais non encore reçus. Inclut les factures émises et les échéances contractuelles.',
          detailedContent: `Le "À encaisser" représente votre créance client et vos revenus futurs confirmés.

**Composition :**

1. **Factures émises** (dues)
   • Factures envoyées en attente de paiement
   • Échéance dépassée ou à venir
   • Montant TTC

2. **Échéances contractuelles**
   • Prochaines facturations prévues (contrats récurrents)
   • Jalons de projets
   • Renouvellements

**Vieillissement des créances :**

• 0-30 jours : Normal
• 31-60 jours : Relance automatique
• 61-90 jours : Alerte urgente
• >90 jours : Contentieux potentiel`,
          warning: 'Surveillez ce KPI pour anticiper les retards de paiement.',
          example: 'À encaisser : 28 500€ dont 5 000€ en retard de paiement (>30 jours)'
        }
      ]
    },
    {
      id: 'gestion-revenus',
      title: 'Gestion des revenus',
      description: 'Enregistrez et suivez vos revenus',
      steps: [
        {
          id: 'creer-revenu',
          title: 'Créer un revenu',
          content: 'Cliquez sur "Nouveau revenu" pour enregistrer un revenu. Indiquez le montant, l\'établissement source, la catégorie et la date d\'échéance.',
          detailedContent: `L'interface de création de revenu guide pas à pas l'enregistrement.

**Champs obligatoires :**

• **Montant HT** : Valeur hors taxes
• **Établissement** : Client source du revenu
• **Catégorie** : Abonnement, Prestation, Formation, etc.
• **Date d'échéance** : Date prévue de réception

**Champs optionnels :**

• Description détaillée
• Numéro de facture associé
• Fichiers joints (devis, bon de commande)
• Notes internes

**Calcul automatique :**

• TVA selon le taux paramétré (20% par défaut)
• Montant TTC
• Conversion si devise étrangère`,
          tip: 'Liez toujours le revenu à un établissement pour un suivi précis de la rentabilité client.'
        },
        {
          id: 'recurrence',
          title: 'Revenus récurrents',
          content: 'Pour les contrats avec paiements réguliers, configurez la récurrence : mensuelle, trimestrielle ou annuelle. Les revenus futurs sont générés automatiquement.',
          detailedContent: `Les revenus récurrents simplifient la gestion des contrats à paiements réguliers.

**Types de récurrence :**
| Fréquence | Génération | Usage typique |
|-----------|------------|---------------|
| Mensuelle | 1er du mois | SaaS, maintenance |
| Trimestrielle | 1er du trimestre | Services récurrents |
| Semestrielle | Janvier/Juillet | Contrats long terme |
| Annuelle | Date anniversaire | Licences |

**Paramètres avancés :**

• Date de début et de fin
• Nombre d'occurrences
• Indexation automatique (%)
• Prorata si démarrage en cours de mois

**Automatisation :**

• Génération des factures
• Rappels avant échéance
• Notification si non-paiement`,
          tip: 'Les modèles économiques des établissements (Statique, Au succès) déterminent la périodicité.',
          example: 'Contrat Groupe Vallois : 2 500€/mois → 12 revenus générés automatiquement pour l\'année'
        },
        {
          id: 'statut-revenu',
          title: 'Statut du revenu',
          content: 'Chaque revenu a un statut : Prévu (attendu), Encaissé (reçu sur le compte), Annulé. Mettez à jour le statut lors de la réception du paiement.',
          detailedContent: `Le cycle de vie d'un revenu suit un workflow précis.

**États possibles :**

| Statut | Description | Action suivante |
|--------|-------------|-----------------|
| 📋 Prévu | En attente de réception | → Encaissé ou Annulé |
| ✅ Encaissé | Paiement reçu confirmé | Final |
| ❌ Annulé | Revenu non réalisé | Final |
| ⏳ En retard | Échéance dépassée | Relance → Encaissé |

**Transitions automatiques :**

• Prévu → Encaissé : via rapprochement bancaire Qonto
• Prévu → En retard : si échéance dépassée de 7 jours

**Actions manuelles :**

• Marquer comme encaissé (si pas de synchro bancaire)
• Annuler avec motif
• Reporter l'échéance`
        }
      ]
    },
    {
      id: 'gestion-depenses',
      title: 'Gestion des dépenses',
      description: 'Enregistrez et catégorisez vos dépenses',
      steps: [
        {
          id: 'creer-depense',
          title: 'Créer une dépense',
          content: 'Enregistrez une dépense avec : montant, catégorie (Salaires, Charges, Fournisseurs, Frais généraux), date et description.',
          detailedContent: `L'enregistrement des dépenses permet un suivi précis de vos coûts.

**Création manuelle :**

1. Cliquez sur "Nouvelle dépense"
2. Renseignez le montant TTC
3. Sélectionnez la catégorie
4. Indiquez le fournisseur
5. Ajoutez le justificatif (optionnel)

**Import automatique :**

• Synchronisation Qonto : les transactions sont importées
• Catégorisation IA : suggestion automatique
• Validation en un clic

**Champs importants :**

• Date d'engagement vs date de paiement
• TVA récupérable ou non
• Récurrence pour charges fixes`,
          tip: 'Joignez toujours le justificatif pour faciliter la comptabilité.'
        },
        {
          id: 'categories-depenses',
          title: 'Catégories',
          content: 'Les dépenses sont organisées par catégorie pour une analyse fine : Salaires, Cotisations sociales, Hébergement, Marketing, Déplacements, etc.',
          detailedContent: `La catégorisation permet des analyses et des budgets par poste de coût.

**Catégories standard :**

**👥 Personnel**

• Salaires nets
• Cotisations sociales patronales
• Primes et avantages
• Formation

**🏢 Structure**

• Loyer et charges
• Assurances
• Télécom, Internet
• Fournitures

**💻 Technique**

• Hébergement cloud
• Licences logiciels
• Matériel informatique
• Maintenance

**📣 Commercial**

• Marketing digital
• Événements
• Déplacements clients
• Représentation

**Personnalisation :**
Créez vos propres catégories dans Paramètres > Trésorerie > Catégories`
        },
        {
          id: 'sync-rh',
          title: 'Synchronisation RH',
          content: 'Les salaires sont automatiquement synchronisés depuis le module RH. Les cotisations patronales sont calculées et ajoutées séparément.',
          detailedContent: `L'intégration RH-Trésorerie automatise la gestion de la masse salariale.

**Données synchronisées :**

• Salaires nets (depuis bulletins de paie)
• Cotisations patronales (calculées)
• Primes et variables
• Indemnités

**Processus mensuel :**

1. Import des bulletins dans People
2. Extraction automatique des montants (IA)
3. Création des dépenses "Salaires"
4. Calcul des charges (~45% du brut)

**Réconciliation :**
Les virements de salaires sont automatiquement rapprochés avec les dépenses RH.`,
          tip: 'Vérifiez que les bulletins de salaire sont bien importés dans le module RH.',
          warning: 'Les cotisations sont estimées. Ajustez selon votre situation réelle.'
        }
      ]
    },
    {
      id: 'integration-qonto',
      title: 'Intégration Qonto',
      description: 'Synchronisez votre compte bancaire Qonto',
      steps: [
        {
          id: 'connexion-api',
          title: 'Connexion API',
          content: 'Dans les paramètres de trésorerie, configurez votre connexion Qonto avec votre clé API et identifiant d\'organisation.',
          detailedContent: `L'intégration Qonto permet une synchronisation bancaire en temps réel.

**Prérequis :**

• Compte Qonto Business ou Enterprise
• Accès administrateur Qonto
• Clé API générée depuis l'interface Qonto

**Configuration :**

1. Connectez-vous à Qonto > Paramètres > Intégrations
2. Créez une clé API avec les permissions "Lecture transactions"
3. Copiez la clé et l'ID organisation
4. Collez dans OpenPulse > Paramètres > Trésorerie > Qonto

**Permissions requises :**

• Lecture des transactions
• Lecture des soldes
• Lecture des comptes`,
          warning: 'La clé API est sensible. Ne la partagez pas et conservez-la en lieu sûr.',
          tip: 'Régénérez votre clé API régulièrement pour plus de sécurité.'
        },
        {
          id: 'sync-transactions',
          title: 'Synchronisation des transactions',
          content: 'Les transactions des 90 derniers jours sont synchronisées automatiquement. Cliquez sur "Synchroniser" pour une mise à jour manuelle.',
          detailedContent: `La synchronisation récupère toutes les opérations bancaires pour un suivi précis.

**Fréquence de synchronisation :**

• Automatique : toutes les heures
• Manuelle : bouton "Actualiser"
• Webhook : notification en temps réel (bientôt)

**Données synchronisées :**
| Type | Exemple |
|------|---------|
| Virements reçus | Paiement client |
| Virements émis | Paiement fournisseur |
| Prélèvements | Charges, abonnements |
| Cartes | Achats CB équipe |

**Historique :**

• 90 jours glissants par défaut
• Possibilité d'extension à 12 mois`,
          example: 'Dernière sync : il y a 23 min • 156 transactions ce mois'
        },
        {
          id: 'rapprochement',
          title: 'Rapprochement automatique',
          content: 'L\'algorithme de rapprochement associe automatiquement les transactions bancaires aux revenus et dépenses enregistrés (tolérance ±5% montant, ±7 jours date).',
          detailedContent: `Le rapprochement intelligent connecte vos mouvements bancaires à vos prévisions.

**Algorithme de matching :**

1. **Correspondance exacte** : montant + date identiques
2. **Tolérance montant** : ±5% du montant prévu
3. **Tolérance date** : ±7 jours de l'échéance
4. **Analyse libellé** : mots-clés et références

**Score de confiance :**

• 🟢 >90% : Rapprochement automatique
• 🟡 70-90% : Suggestion à valider
• 🔴 <70% : Manuel requis

**Actions possibles :**

• Valider un rapprochement suggéré
• Corriger une association erronée
• Créer un revenu/dépense depuis la transaction`,
          tip: 'Les transactions non rapprochées sont signalées pour un traitement manuel.'
        }
      ]
    },
    {
      id: 'previsionnel',
      title: 'Prévisionnel',
      description: 'Anticipez votre trésorerie future',
      steps: [
        {
          id: 'projections',
          title: 'Projections 3/6/12 mois',
          content: 'Visualisez l\'évolution prévisionnelle de votre trésorerie sur différents horizons. Les projections intègrent les revenus contractualisés et les dépenses récurrentes.',
          detailedContent: `Les projections de trésorerie vous aident à anticiper et planifier.

**Sources des projections :**

**Revenus :**

• Contrats récurrents (100% pondéré)
• Pipeline commercial (pondéré par probabilité)
• Saisonnalité historique

**Dépenses :**

• Charges fixes (loyer, salaires)
• Charges variables (estimation moyenne)
• Échéances connues (impôts, emprunts)

**Horizons disponibles :**
| Horizon | Précision | Utilisation |
|---------|-----------|-------------|
| 3 mois | ±5% | Pilotage court terme |
| 6 mois | ±10% | Planification |
| 12 mois | ±20% | Vision stratégique |

**Graphique interactif :**

• Courbe du solde projeté
• Zones de risque (seuil critique)
• Points d'inflexion identifiés`,
          tip: 'Mettez à jour vos projections après chaque signature de contrat.'
        },
        {
          id: 'scenarios',
          title: 'Scénarios',
          content: 'Trois scénarios sont calculés : Optimiste (tous les prospects convertis), Réaliste (50% conversion), Seuil critique (revenus minimums). Comparez-les pour anticiper les risques.',
          detailedContent: `L'analyse par scénarios vous prépare à différentes situations.

**Scénario Optimiste (best case)**

• 100% du pipeline converti
• Pas de perte de client
• Croissance des revenus récurrents
• Utilisation : objectif ambitieux

**Scénario Réaliste (base case)**

• Pipeline pondéré par probabilité
• Taux de churn historique
• Croissance modérée
• Utilisation : budget principal

**Scénario Pessimiste (worst case)**

• 25% du pipeline uniquement
• Perte de clients majeurs possible
• Pas de croissance
• Utilisation : plan de contingence

**Analyse de sensibilité :**

• Impact d'un retard de paiement majeur
• Effet d'une hausse des charges
• Conséquence d'une perte de client`,
          tip: 'Le pipeline commercial pondéré par probabilité de conversion alimente le scénario réaliste.',
          example: 'Scénario réaliste à 6 mois : solde prévu de 125 000€ (±10 000€)'
        }
      ]
    },
    {
      id: 'reporting-finance',
      title: 'Reporting financier',
      description: 'Générez des rapports et analyses financières',
      steps: [
        {
          id: 'exports-comptables',
          title: 'Exports comptables',
          content: 'Exportez vos données au format compatible avec votre logiciel comptable (FEC, CSV, Excel). Sélectionnez la période et les types de mouvements.',
          detailedContent: `Les exports facilitent la collaboration avec votre expert-comptable.

**Formats d'export :**

• **FEC** : Fichier des Écritures Comptables (norme fiscale)
• **CSV** : Import dans tout logiciel
• **Excel** : Analyses personnalisées
• **PDF** : Synthèse visuelle

**Données exportables :**

• Revenus et encaissements
• Dépenses et décaissements
• Rapprochements bancaires
• Détail TVA collectée/déductible

**Automatisation :**
Planifiez un export mensuel automatique envoyé par email à votre comptable.`,
          tip: 'L\'export FEC est obligatoire en cas de contrôle fiscal.'
        },
        {
          id: 'kpis-financiers',
          title: 'KPIs financiers',
          content: 'Suivez vos indicateurs clés : runway (durée de vie), burn rate (consommation mensuelle), MRR (revenus récurrents mensuels), ARR (annualisés).',
          detailedContent: `Les KPIs financiers donnent une vision claire de la santé de votre entreprise.

**Indicateurs de trésorerie :**

• **Runway** : Mois restants au rythme actuel
• **Burn rate** : Consommation nette mensuelle
• **Cash flow** : Flux de trésorerie net

**Indicateurs de revenus :**

• **MRR** : Monthly Recurring Revenue
• **ARR** : Annual Recurring Revenue
• **ARPA** : Average Revenue Per Account

**Indicateurs de rentabilité :**

• **Marge brute** : Revenus - Coûts directs
• **Marge nette** : Après toutes charges
• **LTV/CAC** : Valeur client / Coût acquisition

**Dashboard personnalisable :**
Configurez l'affichage des KPIs qui vous importent le plus.`
        }
      ]
    }
  ]
}
