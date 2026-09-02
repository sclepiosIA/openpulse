import { TutorielModule } from '@/types/tutoriel'

export const contratsModule: TutorielModule = {
  id: 'contrats',
  title: 'Gestion des Contrats',
  description: 'Maîtrisez la création, le suivi et le renouvellement des contrats clients',
  icon: 'FileText',
  category: 'operations',
  estimatedTime: '10 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'creation-contrats',
      title: 'Création de contrats',
      description: 'Comment créer et configurer un nouveau contrat',
      steps: [
        {
          id: 'nouveau-contrat',
          title: 'Créer un nouveau contrat',
          content: 'Accédez à la fiche établissement et cliquez sur "Nouveau contrat" dans l\'onglet Contrats.',
          detailedContent: `Pour créer un contrat:

1. Ouvrez la fiche de l\'établissement concerné
2. Allez dans l\'onglet "Contrats"
3. Cliquez sur "Nouveau contrat"
4. Renseignez les informations obligatoires:
   - Type de contrat (SaaS, Licence, Maintenance)
   - Date de début et durée
   - Montant et conditions de facturation`,
          tip: 'Vous pouvez dupliquer un contrat existant pour gagner du temps.'
        },
        {
          id: 'documents-contrat',
          title: 'Joindre les documents',
          content: 'Uploadez le contrat signé et les annexes pour un dossier complet.',
          detailedContent: `Les documents associables à un contrat:

- Contrat signé (PDF)
- Annexes techniques
- Conditions générales de vente
- Devis accepté
- Bon de commande`,
          warning: 'Assurez-vous que le contrat signé est bien uploadé avant de passer le statut en "Actif".'
        }
      ]
    },
    {
      id: 'suivi-echeances',
      title: 'Suivi des échéances',
      description: 'Ne manquez jamais une date importante',
      steps: [
        {
          id: 'alertes-renouvellement',
          title: 'Alertes de renouvellement',
          content: 'Le système vous alerte automatiquement 90, 60 et 30 jours avant l\'échéance d\'un contrat.',
          detailedContent: `Le système d\'alertes automatiques:

- **J-90**: Notification préparatoire (email + dashboard)
- **J-60**: Alerte de suivi (tâche créée automatiquement)
- **J-30**: Alerte urgente (notification push)
- **J-0**: Échéance atteinte (escalade manager)`,
          example: 'Contrat Groupe Vallois - Échéance le 15/06 - Alerte J-60 envoyée le 16/04'
        },
        {
          id: 'tacite-reconduction',
          title: 'Gérer la tacite reconduction',
          content: 'Configurez le comportement à l\'échéance: reconduction tacite, alerte simple ou fin automatique.',
          tip: 'La reconduction tacite peut être configurée par défaut dans les paramètres.'
        }
      ]
    },
    {
      id: 'renouvellement',
      title: 'Renouvellement de contrat',
      description: 'Processus de renouvellement et négociation',
      steps: [
        {
          id: 'processus-renouvellement',
          title: 'Lancer le renouvellement',
          content: 'Cliquez sur "Renouveler" pour créer une nouvelle version du contrat avec les conditions actualisées.',
          detailedContent: `Le renouvellement crée un nouveau contrat qui:

- Reprend les informations du contrat précédent
- Permet de modifier le montant et les conditions
- Conserve l\'historique lié au contrat parent
- Génère automatiquement un avenant si nécessaire`,
          example: 'Renouvellement avec augmentation de 3% → Nouveau montant calculé automatiquement'
        }
      ]
    }
  ]
}
