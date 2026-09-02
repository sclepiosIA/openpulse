import { TutorielModule } from '@/types/tutoriel'

export const dashboardModule: TutorielModule = {
  id: 'dashboard',
  title: 'Tableau de bord',
  description: 'Votre vue d\'ensemble sur l\'activité commerciale et opérationnelle',
  icon: 'LayoutDashboard',
  category: 'principal',
  estimatedTime: '10 min',
  level: 'debutant',
  sections: [
    {
      id: 'kpis',
      title: 'Comprendre les KPIs',
      description: 'Interprétez les indicateurs clés de performance',
      steps: [
        {
          id: 'total-etablissements',
          title: 'Total des établissements',
          content: 'Ce KPI affiche le nombre total d\'établissements dans votre base de données, toutes phases confondues (prospects, contractuels, production).',
          detailedContent: `Ce compteur central vous donne une vue instantanée de la taille de votre portefeuille client.

**Composition du compteur :**

• Prospects en phase commerciale (qualification, négociation, closing)
• Clients contractuels en cours de déploiement
• Clients en production active

**Comment interpréter ce chiffre :**
Une croissance régulière indique une bonne dynamique commerciale. Si le nombre stagne, analysez votre pipeline de prospects et le taux de conversion.`,
          example: '147 établissements = 45 prospects + 32 en déploiement + 70 en production',
          tip: 'Cliquez sur le KPI pour voir la répartition détaillée par phase et par mois.'
        },
        {
          id: 'prospects-pipeline',
          title: 'Prospects et Pipeline',
          content: 'Visualisez le nombre de prospects actifs et leur progression dans le pipeline commercial. Les prospects sont les établissements en phase de prospection.',
          detailedContent: `Le pipeline commercial représente le parcours de vos prospects de la première prise de contact jusqu'à la signature.

**Les étapes du pipeline :**

1. **Prospect** : Premier contact établi, besoin identifié
2. **RDV pris** : Démonstration planifiée
3. **Négociation** : Discussion tarifaire en cours
4. **Closing** : Proposition commerciale envoyée

**Indicateurs clés à surveiller :**

• Nombre de prospects par étape
• Temps moyen de conversion entre étapes
• Taux de perte à chaque étape`,
          example: 'Un pipeline sain montre une forme d\'entonnoir : 40 prospects → 25 RDV → 15 négociations → 8 closings',
          tip: 'Le drag & drop permet de faire avancer un prospect d\'une étape à l\'autre.'
        },
        {
          id: 'valeur-potentielle',
          title: 'Valeur potentielle',
          content: 'La somme des revenus potentiels basée sur les modèles économiques des établissements en cours de négociation, pondérée par leur probabilité de signature.',
          detailedContent: `La valeur potentielle pondérée est un indicateur prédictif de votre chiffre d\'affaires futur.

**Calcul de la pondération :**

• Prospect : 10% de probabilité
• RDV pris : 25% de probabilité
• Négociation : 50% de probabilité
• Closing : 80% de probabilité

**Modèle économique pris en compte :**
Chaque établissement a un modèle économique (forfait mensuel, % CA, par pallier) qui détermine la valeur estimée du contrat.`,
          example: 'Un établissement à 2000€/mois en phase négociation (50%) compte pour 1000€ de valeur potentielle',
          tip: 'Cette valeur est calculée selon les seuils et palliers définis pour chaque établissement.'
        },
        {
          id: 'taux-conversion',
          title: 'Taux de conversion',
          content: 'Le pourcentage de prospects qui passent en phase contractuelle. Un bon indicateur de l\'efficacité de votre processus commercial.',
          detailedContent: `Le taux de conversion mesure l\\'efficacité de votre équipe commerciale à transformer les prospects en clients.\n\n**Comment il est calculé :**\n(Nombre de signatures / Nombre de premiers contacts) × 100\n\n**Benchmark secteur d\\'activité :**\n• < 15% : À améliorer - Vérifier la qualification des leads\n• 15-25% : Correct - Processus commercial fonctionnel\n• 25-40% : Excellent - Forte adéquation produit/marché\n• > 40% : Exceptionnel - Souvent lié à des leads très qualifiés\n\n**Facteurs d\\'amélioration :**\n• Meilleure qualification des prospects en amont\n• Démonstrations personnalisées\n• Suivi régulier et relances planifiées`,
          example: 'Sur 100 prospects ce trimestre, 28 ont signé → Taux de conversion de 28%',
          warning: 'Un taux très élevé peut indiquer que vous ciblez des prospects trop faciles et manquez des opportunités.'
        }
      ]
    },
    {
      id: 'pipeline-unifie',
      title: 'Pipeline unifié',
      description: 'Visualisez le cycle de vie complet de vos clients',
      steps: [
        {
          id: 'phase-commerciale',
          title: 'Phase Commerciale',
          content: 'De Prospect à Vendu : suivez la progression des établissements à travers les étapes de qualification, négociation et closing. Chaque colonne représente un statut du pipeline.',
          detailedContent: `La phase commerciale couvre tout le cycle de vente, de l\'identification du prospect jusqu\'à la signature du contrat.

**Structure du pipeline commercial :**

| Étape | Durée moyenne | Actions clés |
|-------|---------------|--------------|
| Prospect | 2-4 semaines | Qualification, premier contact |
| RDV pris | 1-2 semaines | Préparation démo, envoi documentation |
| Négociation | 2-6 semaines | Proposition, négociation tarifs |
| Closing | 1-2 semaines | Contrat, validation juridique |

**Bonnes pratiques :**

• Ne laissez pas un prospect plus de 3 semaines sans interaction
• Documentez chaque échange dans les notes
• Utilisez les tâches automatiques pour ne rien oublier`,
          example: 'Groupe Vallois : Prospect depuis le 01/03 → RDV le 15/03 → Négociation le 22/03 → Signature le 05/04',
          tip: 'Utilisez le drag & drop pour déplacer les établissements entre les colonnes.'
        },
        {
          id: 'phase-deploiement',
          title: 'Phase Déploiement',
          content: 'De Contractuel à Go-Live : une fois le contrat signé, suivez les étapes de mise en conformité, déploiement technique et formation des utilisateurs.',
          detailedContent: `Le déploiement transforme un client signé en client opérationnel. C\\'est une phase critique pour la satisfaction client.\n\n**Les 5 étapes du déploiement :**\n\n1. **Cadrage** (1-2 semaines)\n   - Réunion de lancement\n   - Identification des interlocuteurs\n   - Planification du projet\n\n2. **Conformité** (2-4 semaines)\n   - Vérifications techniques\n   - Conformité RGPD\n   - Validation des prérequis\n\n3. **Déploiement technique** (1-3 semaines)\n   - Installation\n   - Paramétrage\n   - Intégration de l\\'outil metier du client\n\n4. **Formation** (1-2 semaines)\n   - Formation administrateurs\n   - Formation utilisateurs\n   - Documentation\n\n5. **Go-Live** (1 semaine)\n   - Mise en production\n   - Support renforcé\n   - Validation client`,
          example: 'Durée moyenne de déploiement : 6-8 semaines pour un établissement de taille moyenne',
          tip: 'Les tâches sont générées automatiquement à chaque changement de phase.'
        },
        {
          id: 'phase-production',
          title: 'Phase Production',
          content: 'Les clients actifs en production. Surveillez leur santé (score de santé, NPS, tickets support) pour anticiper les risques de churn.',
          detailedContent: `La phase production est celle où vous générez de la valeur et devez maintenir la satisfaction client.

**Indicateurs de suivi :**

• **Score de santé (0-100)** : Synthèse de l\'adoption, satisfaction et engagement
  - > 80 : Client ambassadeur
  - 60-80 : Client satisfait
  - 40-60 : Client à risque
  - < 40 : Intervention urgente

• **NPS (Net Promoter Score)** : Mesure la recommandation
  - Promoteurs (9-10) : Vos meilleurs clients
  - Passifs (7-8) : Satisfaits mais pas loyaux
  - Détracteurs (0-6) : Risque de churn

• **Taux d\'adoption** : % d\'utilisateurs actifs / formés

**Actions CSM recommandées :**

• QBR (Quarterly Business Review) tous les 3 mois
• Check-in mensuel pour les clients à risque
• Alertes automatiques sur baisse d\'utilisation`,
          example: 'Un client avec un score de santé de 45 et 3 tickets ouverts depuis 2 semaines nécessite un appel prioritaire',
          warning: 'Ne négligez pas les clients "verts" - ils peuvent basculer rapidement sans attention.'
        }
      ]
    },
    {
      id: 'actions-rapides',
      title: 'Actions rapides',
      description: 'Accédez rapidement aux informations importantes',
      steps: [
        {
          id: 'taches-urgentes',
          title: 'Tâches urgentes',
          content: 'La liste des tâches prioritaires qui nécessitent votre attention immédiate. Cliquez sur une tâche pour accéder à son détail.',
          detailedContent: `Les tâches urgentes sont filtrées automatiquement selon plusieurs critères :

**Critères de priorisation :**

• Échéance dépassée (en retard)
• Échéance aujourd\'hui
• Priorité "Haute" avec échéance dans 3 jours
• Tâches bloquantes pour d\'autres

**Couleurs des indicateurs :**

• 🔴 Rouge : En retard
• 🟠 Orange : Aujourd\'hui
• 🟡 Jaune : Cette semaine
• ⚪ Gris : Plus tard

**Actions disponibles :**

• Clic : Ouvrir le détail de la tâche
• Check : Marquer comme terminée
• Flèche : Reporter l\'échéance`,
          example: 'Tâche "Appeler Dr Martin pour validation" en retard de 2 jours → Priorité critique',
          tip: 'Vous pouvez marquer une tâche comme terminée directement depuis cette liste.'
        },
        {
          id: 'hub-email',
          title: 'Hub Email intelligent',
          content: 'Accédez rapidement à vos emails non lus classés par priorité. L\'IA classifie automatiquement les emails par établissement et par urgence.',
          detailedContent: `Le hub email utilise l\'IA pour trier et prioriser vos emails automatiquement.

**Classification IA :**

• **Établissement détecté** : L\'IA reconnaît le domaine de l\'expéditeur et associe l\'email à un établissement
• **Catégorie** : Commercial, Support, Administratif, Formation
• **Priorité** : Haute, Normale, Basse

**Indicateurs visuels :**

• Badge coloré : Catégorie de l\'email
• Pastille établissement : Lien direct vers la fiche
• Icône flamme : Email urgent détecté par l\'IA

**Fonctionnalités :**

• Réponse rapide avec templates
• Création de tâche depuis l\'email
• Association manuelle à un établissement`,
          example: 'Email de contact@groupe-vallois.example.org → Automatiquement associé au Groupe Vallois, catégorie Support',
          tip: 'Configurez les mappings de domaines dans les paramètres pour améliorer la précision.'
        },
        {
          id: 'flux-activites',
          title: 'Flux d\'activités',
          content: 'Suivez en temps réel les actions de votre équipe : nouveaux contacts, tâches complétées, emails envoyés, etc.',
          detailedContent: `Le flux d\'activités est un journal chronologique de toutes les actions importantes sur la plateforme.

**Types d\'activités tracées :**

• 📧 Emails envoyés/reçus
• ✅ Tâches complétées
• 📝 Notes ajoutées
• 🔄 Changements de statut
• 👤 Nouveaux contacts créés
• 📅 Rendez-vous planifiés

**Filtres disponibles :**

• Par utilisateur (Moi / Équipe)
• Par établissement
• Par type d\'activité
• Par période

**Utilisation :**

• Reprendre le contexte après une absence
• Suivre l\'activité d\'un commercial
• Identifier les établissements les plus actifs`,
          example: 'Marie a envoyé 3 emails et complété 5 tâches ce matin sur le dossier Groupe Vallois',
          tip: 'Le flux se rafraîchit automatiquement toutes les 30 secondes.'
        }
      ]
    }
  ]
}
