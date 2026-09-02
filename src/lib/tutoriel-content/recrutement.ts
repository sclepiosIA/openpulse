import { TutorielModule } from '@/types/tutoriel'

export const recrutementModule: TutorielModule = {
  id: 'recrutement',
  title: 'Recrutement',
  description: 'Gérez vos candidatures, entretiens et processus d\'embauche de A à Z',
  icon: 'UserPlus',
  category: 'finance',
  estimatedTime: '15 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'gestion-candidatures',
      title: 'Gestion des candidatures',
      description: 'Recevoir et organiser les candidatures',
      steps: [
        {
          id: 'kanban-recrutement',
          title: 'Vue Kanban des candidatures',
          content: 'Visualisez toutes vos candidatures dans un tableau Kanban avec les colonnes: Reçue, Présélection, Entretien, Offre, Embauché/Refusé.',
          detailedContent: `Le Kanban de recrutement permet de:

- Glisser-déposer les candidats entre les étapes
- Voir d\'un coup d\'œil l\'état du pipeline
- Filtrer par poste, date ou source
- Identifier les candidatures en attente depuis trop longtemps`,
          tip: 'Les candidatures sans action depuis 7 jours sont signalées en orange.'
        },
        {
          id: 'parsing-cv',
          title: 'Parsing IA des CV',
          content: 'L\'IA extrait automatiquement les informations clés des CV uploadés.',
          detailedContent: `Le parsing IA analyse:

- Informations personnelles (nom, email, téléphone)
- Expériences professionnelles avec dates
- Compétences techniques et soft skills
- Formations et certifications
- Score de correspondance avec le poste`,
          example: 'CV de Marie Dupont → 85% de correspondance pour le poste "Chef de projet e-santé"'
        }
      ]
    },
    {
      id: 'entretiens',
      title: 'Planification des entretiens',
      description: 'Organiser et suivre les entretiens',
      steps: [
        {
          id: 'planifier-entretien',
          title: 'Planifier un entretien',
          content: 'Créez un entretien en sélectionnant le candidat, les participants et le créneau horaire.',
          detailedContent: `Pour planifier un entretien:

1. Ouvrez la fiche du candidat
2. Cliquez sur "Nouvel entretien"
3. Sélectionnez le type (téléphonique, visio, présentiel)
4. Choisissez les participants internes
5. Proposez des créneaux au candidat`,
          tip: 'L\'intégration calendrier synchronise automatiquement les disponibilités.'
        },
        {
          id: 'grille-evaluation',
          title: 'Grille d\'évaluation',
          content: 'Utilisez la grille d\'évaluation standardisée pour noter objectivement chaque candidat.',
          detailedContent: `La grille d\'évaluation comprend:

- Compétences techniques (pondérées selon le poste)
- Soft skills et savoir-être
- Motivation et projet professionnel
- Adéquation culturelle
- Note globale et recommandation`,
          example: 'Score technique: 4/5 | Soft skills: 5/5 | Motivation: 4/5 → Recommandation: Offre'
        }
      ]
    },
    {
      id: 'onboarding',
      title: 'Onboarding',
      description: 'Préparer l\'arrivée du nouveau collaborateur',
      steps: [
        {
          id: 'checklist-onboarding',
          title: 'Checklist d\'onboarding',
          content: 'Une checklist automatique est générée pour chaque nouveau collaborateur.',
          detailedContent: `La checklist d\'onboarding inclut:

- Préparation du poste de travail
- Création des accès (email, outils)
- Documents RH à signer
- Formations obligatoires
- Rencontres avec l\'équipe`,
          tip: 'Personnalisez la checklist selon le type de poste dans les paramètres RH.'
        },
        {
          id: 'suivi-integration',
          title: 'Suivi de l\'intégration',
          content: 'Planifiez des points de suivi à J+7, J+30 et J+90 pour accompagner le nouveau collaborateur.',
          detailedContent: `Le suivi d\'intégration permet de:

- Détecter rapidement les difficultés
- Valider l\'acquisition des compétences
- Recueillir le feedback du collaborateur
- Ajuster la période d\'essai si nécessaire`
        }
      ]
    }
  ]
}
