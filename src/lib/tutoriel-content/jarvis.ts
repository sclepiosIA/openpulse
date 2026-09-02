import { TutorielModule } from '@/types/tutoriel'

export const jarvisModule: TutorielModule = {
  id: 'jarvis',
  title: 'JARVIS - Assistant IA',
  description: 'Maîtrisez l\'assistant intelligent intégré pour automatiser vos tâches',
  icon: 'Bot',
  category: 'principal',
  estimatedTime: '10 min',
  level: 'debutant',
  sections: [
    {
      id: 'introduction-jarvis',
      title: 'Découvrir JARVIS',
      description: 'Présentation de l\'assistant IA et ses capacités',
      steps: [
        {
          id: 'quest-ce-que-jarvis',
          title: 'Qu\'est-ce que JARVIS ?',
          content: 'JARVIS est votre assistant personnel intelligent, capable d\'exécuter plus de 100 actions différentes.',
          detailedContent: `JARVIS (Just A Rather Very Intelligent System) est un assistant IA intégré qui vous aide à :

- **Rechercher des informations** dans votre CRM, vos courriels, vos pages et vos documents
- **Créer et modifier** des établissements, contacts, tâches, événements
- **Analyser des données** avec des rapports et prédictions
- **Automatiser des actions** récurrentes

Il comprend le contexte de votre travail et adapte ses suggestions en conséquence.`,
          tip: 'JARVIS apprend de vos habitudes et améliore ses suggestions au fil du temps.'
        },
        {
          id: 'ouvrir-jarvis',
          title: 'Ouvrir JARVIS',
          content: 'Cliquez sur le logo OpenPulse dans la sidebar ou utilisez le raccourci Cmd/Ctrl+J.',
          detailedContent: `Plusieurs méthodes pour accéder à JARVIS :

1. **Logo dans la sidebar** : Cliquez sur le logo OpenPulse en haut à gauche
2. **Raccourci clavier** : Appuyez sur **Cmd+J** (Mac) ou **Ctrl+J** (Windows/Linux)
3. **Bouton flottant** : Sur certaines pages, un bouton IA apparaît

Le logo pulse avec un effet lumineux quand JARVIS a des suggestions pour vous.`,
          example: 'Raccourci rapide : Cmd/Ctrl + J depuis n\'importe quelle page'
        }
      ]
    },
    {
      id: 'utilisation-basique',
      title: 'Utilisation basique',
      description: 'Interagir avec JARVIS au quotidien',
      steps: [
        {
          id: 'poser-question',
          title: 'Poser une question',
          content: 'Tapez votre question en langage naturel, comme si vous parliez à un collègue.',
          detailedContent: `JARVIS comprend le français courant. Exemples de questions :\n\n- "Combien de tâches en retard ai-je cette semaine ?"\n\n- "Quel est le chiffre d'affaires du mois dernier ?"\n\n- "Trouve tous les contacts du Groupe Vallois"\n\n- "Résume les derniers emails de support"\n\nLa réponse apparaît en temps réel avec un indicateur de réflexion.`,
          tip: 'Soyez précis dans vos demandes pour obtenir des réponses plus pertinentes.'
        },
        {
          id: 'demander-action',
          title: 'Demander une action',
          content: 'JARVIS peut exécuter des actions concrètes : créer, modifier, envoyer, planifier.',
          detailedContent: `Exemples d'actions que JARVIS peut effectuer :\n\n**CRM**\n\n- "Crée un nouvel établissement Groupe Vallois"\n\n- "Ajoute un contact Mme Martin pour cet établissement"\n\n**Tâches & Calendrier**\n\n- "Crée une tâche de rappel pour vendredi"\n\n- "Planifie une réunion avec l'équipe commerciale demain à 14h"\n\n**Emails**\n\n- "Rédige un email de suivi pour le Groupe Vallois"\n\n- "Recherche les emails non lus de cette semaine"\n\n**Documents**\n\n- "Résume ce document PDF"\n\n- "Génère un rapport des ventes du trimestre"`,
          warning: 'Certaines actions sensibles (suppression, envoi d\'email) demandent une confirmation.'
        },
        {
          id: 'actions-contextuelles',
          title: 'Actions contextuelles',
          content: 'JARVIS adapte ses suggestions selon la page où vous vous trouvez.',
          detailedContent: `Le "Mode Focus" enrichit les suggestions selon votre contexte :

**Sur la fiche d'un établissement**
→ "Crée une tâche pour cet établissement"
→ "Envoie un email au contact principal"

**Dans la messagerie**
→ "Résume cette conversation"
→ "Suggère une réponse"

**Dans le calendrier**
→ "Ajoute un événement"
→ "Vérifie mes disponibilités"

Les boutons d'actions rapides apparaissent en bas du panneau JARVIS.`,
          tip: 'Les actions contextuelles sont les plus rapides à utiliser.'
        }
      ]
    },
    {
      id: 'fonctionnalites-avancees',
      title: 'Fonctionnalités avancées',
      description: 'Exploiter tout le potentiel de JARVIS',
      steps: [
        {
          id: 'recherche-semantique',
          title: 'Recherche sémantique',
          content: 'JARVIS comprend le sens de vos questions, pas seulement les mots-clés.',
          detailedContent: `La recherche sémantique permet de trouver des informations même si vous n'utilisez pas les mots exacts :

**Exemples**

- "Établissements en difficulté" → trouve ceux avec un score de santé faible
- "Clients importants" → identifie les établissements à fort CA
- "Problèmes récents" → affiche les tickets support ouverts

JARVIS cite ses sources : chaque réponse renvoie vers la page ou le document dont elle vient, que vous pouvez ouvrir pour vérifier.

La recherche porte sur les pages rédigées et les documents de votre instance — ceux auxquels vous avez accès, et eux seuls.`,
          example: '"Quels sont les établissements qui n\'ont pas été contactés depuis 3 mois ?" → Recherche intelligente combinant CRM + activité emails'
        },
        {
          id: 'analyse-ia',
          title: 'Analyse IA',
          content: 'Demandez à JARVIS d\'analyser des tendances, détecter des anomalies ou faire des prédictions.',
          detailedContent: `Capacités d'analyse avancée :

**Tendances**

- "Quelle est la tendance du CA sur les 6 derniers mois ?"
- "Analyse l'évolution des tickets support"

**Anomalies**

- "Y a-t-il des dépenses inhabituelles ce mois ?"
- "Détecte les établissements avec un comportement atypique"

**Prédictions**

- "Prévois le CA du prochain trimestre"
- "Quels établissements risquent de churner ?"

**Corrélations**

- "Y a-t-il un lien entre le nombre de formations et la satisfaction ?"`,
          tip: 'Les analyses prennent quelques secondes de plus car JARVIS traite plus de données.'
        },
        {
          id: 'automatisation',
          title: 'Automatisation',
          content: 'Créez des règles automatiques et des tâches planifiées.',
          detailedContent: `JARVIS peut configurer des automatisations :

**Rappels**

- "Rappelle-moi de relancer ce client dans 3 jours"
- "Notifie-moi quand un ticket est ouvert depuis plus de 48h"

**Règles automatiques**

- "Assigne automatiquement les tickets support à l'équipe technique"
- "Crée une tâche de suivi quand un établissement passe en production"

**Rapports planifiés**

- "Envoie-moi un résumé des KPIs chaque lundi matin"
- "Génère un export des ventes chaque fin de mois"`,
          warning: 'Les automatisations sont réservées aux utilisateurs avec les permissions appropriées.'
        },
        {
          id: 'mode-autonome',
          title: 'Mode autonome',
          content: 'Activez le mode autonome pour que JARVIS exécute automatiquement les actions à haute confiance.',
          detailedContent: `Le **mode autonome** permet à JARVIS d'exécuter certaines actions sans confirmation :

**Comment ça marche**

- JARVIS calcule un score de confiance pour chaque action (0-100%)
- Les actions au-dessus du seuil (par défaut 95%) sont auto-approuvées
- Les actions en-dessous restent en attente de validation

**Activation**

1. Ouvrez JARVIS (Cmd/Ctrl+J)
2. Cliquez sur le switch "Mode autonome" dans le header
3. Ajustez le seuil dans les paramètres si besoin

**Actions éligibles**

- Création de tâches simples
- Ajout de rappels
- Classification d'emails
- Suggestions de réponse

**Actions toujours manuelles**

- Envoi d'emails
- Suppressions
- Modifications de données sensibles`,
          tip: 'JARVIS apprend de vos validations et ajuste ses suggestions pour augmenter la confiance.',
          warning: 'Vérifiez régulièrement l\'historique des actions auto-approuvées dans l\'onglet "Actions".'
        },
        {
          id: 'interface-vocale',
          title: 'Interface vocale',
          content: 'Parlez à JARVIS avec le wake-word "Jarvis" ou le bouton micro.',
          detailedContent: `JARVIS supporte l'interaction vocale bidirectionnelle :

**Activation vocale**

1. Activez la voix dans les paramètres JARVIS (icône engrenage)
2. Dites "Jarvis" pour activer l'écoute (wake-word)
3. Ou cliquez sur le bouton micro 🎤

**Commandes vocales**

- "Jarvis, combien de tâches aujourd'hui ?"
- "Jarvis, crée une réunion avec l'équipe demain"
- "Jarvis, résume mes emails non lus"

**Réponse vocale (TTS)**

- JARVIS lit ses réponses à voix haute
- Vous pouvez interrompre avec "Stop"
- Vitesse et voix configurables dans les paramètres

**Configuration**

- Voix : Française (Denise) par défaut
- Vitesse : 0.5x à 2x
- Volume : Ajustable`,
          tip: 'L\'interface vocale fonctionne mieux dans un environnement calme.',
          warning: 'Nécessite l\'autorisation du microphone dans votre navigateur.'
        }
      ]
    },
    {
      id: 'onglets-jarvis',
      title: 'Les 4 onglets',
      description: 'Navigation dans l\'interface JARVIS',
      steps: [
        {
          id: 'onglet-chat',
          title: 'Onglet Chat',
          content: 'Conversation principale avec JARVIS.',
          detailedContent: `L'onglet **Chat** est l'interface principale :

**Fonctionnalités**

- Zone de conversation avec historique
- Actions rapides contextuelles
- Indicateur de réflexion en temps réel
- Rendu Markdown des réponses

**Raccourcis dans le chat**

- Entrée : Envoyer le message
- Maj+Entrée : Nouvelle ligne
- Cmd/Ctrl+V : Coller du texte ou images`
        },
        {
          id: 'onglet-actions',
          title: 'Onglet Actions',
          content: 'Gérez les suggestions en attente de validation.',
          detailedContent: `L'onglet **Actions** affiche les suggestions de JARVIS :

**Types d'actions**

- 📧 Envoi d'emails
- ✅ Création de tâches
- 📅 Planification de réunions
- 📝 Mises à jour de statuts

**Pour chaque action**

- Voir le détail de l'action proposée
- Modifier avant d'approuver
- Approuver (✓) ou Rejeter (✗)
- Donner un feedback

**Badge compteur**
Le nombre dans le badge indique les actions en attente.`,
          tip: 'Les actions expirent après 24h si non traitées.'
        },
        {
          id: 'onglet-templates',
          title: 'Onglet Templates',
          content: 'Modèles de prompts réutilisables.',
          detailedContent: `L'onglet **Templates** propose des modèles prêts à l'emploi :

**Catégories**

- 📊 Rapports & Analytics
- 📧 Emails & Communication
- ✅ Tâches & Suivi
- 📅 Calendrier & Planning

**Utilisation**

1. Parcourez les templates par catégorie
2. Cliquez sur un template pour le charger
3. Personnalisez les variables si nécessaire
4. Envoyez la demande

**Templates populaires**

- "Résumé hebdomadaire des KPIs"
- "Email de relance client"
- "Préparation de réunion"
- "Analyse de la semaine"`,
          tip: 'Vous pouvez créer vos propres templates dans les paramètres.'
        },
        {
          id: 'onglet-stats',
          title: 'Onglet Stats',
          content: 'Tableau de bord d\'utilisation de JARVIS.',
          detailedContent: `L'onglet **Stats** affiche vos métriques d'utilisation :

**Indicateurs**

- Nombre de conversations
- Actions exécutées
- Taux d'approbation
- Temps moyen de réponse

**Graphiques**

- Évolution de l'utilisation
- Répartition par type d'action
- Heures d'activité

**Période**

- Aujourd'hui
- Cette semaine
- Ce mois
- Personnalisée`,
          tip: 'Un taux d\'approbation élevé permet de débloquer le mode autonome avancé.'
        }
      ]
    },
    {
      id: 'personnalisation',
      title: 'Personnalisation',
      description: 'Configurer JARVIS selon vos préférences',
      steps: [
        {
          id: 'parametres-jarvis',
          title: 'Paramètres JARVIS',
          content: 'Accédez aux paramètres via l\'icône engrenage dans le panneau JARVIS.',
          detailedContent: `Options de personnalisation disponibles :

**Général**

- Activer/désactiver JARVIS
- Langue préférée (français par défaut)
- Mode sombre/clair du panneau

**Suggestions**

- Suggestions automatiques activées/désactivées
- Fréquence des suggestions proactives
- Types de suggestions (tâches, rappels, analyses)

**Notifications**

- Alertes sur les insights importants
- Résumés quotidiens/hebdomadaires`,
          tip: 'Désactivez les suggestions si vous préférez utiliser JARVIS uniquement à la demande.'
        },
        {
          id: 'historique-conversations',
          title: 'Historique des conversations',
          content: 'Retrouvez vos échanges précédents avec JARVIS.',
          detailedContent: `L'historique vous permet de :

- **Reprendre une conversation** interrompue
- **Rechercher** une information déjà demandée
- **Supprimer** des conversations obsolètes
- **Exporter** des échanges importants

Accédez à l'historique via l'icône horloge dans le panneau JARVIS.`,
          example: 'Recherchez "rapport ventes" dans l\'historique pour retrouver un export généré la semaine dernière.'
        }
      ]
    },
    {
      id: 'bonnes-pratiques',
      title: 'Bonnes pratiques',
      description: 'Conseils pour une utilisation optimale',
      steps: [
        {
          id: 'formuler-demandes',
          title: 'Bien formuler ses demandes',
          content: 'Des demandes claires donnent des résultats plus précis.',
          detailedContent: `**À faire** ✅\n\n- Être spécifique : "Crée une tâche pour appeler le Groupe Vallois demain à 10h"\n\n- Donner du contexte : "Pour l'établissement actuel, génère un rapport de suivi"\n\n- Utiliser des dates précises : "Les emails de la semaine dernière"\n\n**À éviter** ❌\n\n- Trop vague : "Fais quelque chose avec les clients"\n\n- Plusieurs demandes à la fois : "Crée une tâche, envoie un email et génère un rapport"\n\n- Informations manquantes : "Envoie un email" (à qui ? quel sujet ?)`,
          tip: 'Si JARVIS demande des précisions, c\'est pour mieux vous aider.'
        },
        {
          id: 'verifier-actions',
          title: 'Vérifier les actions',
          content: 'Confirmez toujours les actions importantes avant leur exécution.',
          detailedContent: `JARVIS demande confirmation pour les actions sensibles :

**Actions avec confirmation**

- Envoi d'emails
- Suppression de données
- Modifications importantes
- Actions sur plusieurs éléments

**Actions sans confirmation**

- Recherches et consultations
- Calculs et analyses
- Génération de brouillons

Lisez toujours le résumé de l'action avant de confirmer.`,
          warning: 'Une action confirmée ne peut pas toujours être annulée.'
        },
        {
          id: 'feedback',
          title: 'Donner du feedback',
          content: 'Aidez JARVIS à s\'améliorer en signalant les réponses utiles ou incorrectes.',
          detailedContent: `Utilisez les boutons de feedback sous chaque réponse :

- 👍 **Utile** : La réponse vous a aidé
- 👎 **Pas utile** : La réponse était incorrecte ou hors sujet
- 📝 **Suggérer** : Proposer une amélioration

Ce feedback permet d'améliorer JARVIS pour toute l'équipe.`,
          tip: 'Plus vous donnez de feedback, plus JARVIS devient pertinent.'
        }
      ]
    }
  ]
}
