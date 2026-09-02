import { TutorielModule } from '@/types/tutoriel'

export const groupesPartenairesModule: TutorielModule = {
  id: 'groupes-partenaires',
  title: 'Groupes & Partenaires',
  description: 'Gérez les groupes et les partenaires commerciaux',
  icon: 'Users',
  category: 'crm',
  estimatedTime: '15 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'gestion-groupes',
      title: 'Gestion des groupes',
      description: 'Organisez vos établissements en groupements',
      steps: [
        {
          id: 'creer-groupe',
          title: 'Créer un groupe',
          content: 'Cliquez sur "Nouveau groupe" et remplissez les informations : nom du groupe, type (Réseau, Groupe privé, Association), région, et description.',
          tip: 'Ajoutez un logo pour identifier visuellement le groupe dans les listes.'
        },
        {
          id: 'associer-etablissements',
          title: 'Associer des établissements',
          content: 'Depuis la fiche groupe, ajoutez des établissements existants. Définissez l\'établissement principal (siège) et le rôle de chaque établissement dans le groupe.'
        },
        {
          id: 'progression-groupe',
          title: 'Progression globale du groupe',
          content: 'Le dashboard du groupe affiche la progression agrégée : nombre d\'établissements par statut, valeur totale du groupe, indicateurs de santé combinés.',
          tip: 'La négociation avec un groupe impacte tous ses établissements. Suivez la progression globale pour vos prévisions.'
        }
      ]
    },
    {
      id: 'gestion-partenaires',
      title: 'Gestion des partenaires',
      description: 'Gérez vos partenaires commerciaux et techniques',
      steps: [
        {
          id: 'creer-partenaire',
          title: 'Créer un partenaire',
          content: 'Créez une fiche partenaire avec : nom, type de partenariat, domaine d\'activité, coordonnées et contacts clés.'
        },
        {
          id: 'types-partenaires',
          title: 'Types de partenaires',
          content: 'Catégorisez vos partenaires : Intégrateur technique, Revendeur, Prescripteur, Partenaire formation, Fournisseur. Le type détermine la nature de la relation.'
        },
        {
          id: 'contacts-partenaires',
          title: 'Contacts partenaires',
          content: 'Ajoutez les contacts clés de chaque partenaire. Définissez leur rôle et leur niveau dans l\'organisation du partenaire.'
        }
      ]
    },
    {
      id: 'relations-historique',
      title: 'Relations et historique',
      description: 'Suivez l\'historique de vos relations',
      steps: [
        {
          id: 'timeline-activites',
          title: 'Timeline d\'activités',
          content: 'Consultez l\'historique chronologique de toutes les interactions avec un groupe ou partenaire : réunions, appels, emails, décisions.'
        },
        {
          id: 'emails-associes',
          title: 'Emails associés',
          content: 'Les emails sont automatiquement associés aux groupes et partenaires grâce à la détection de domaines. Consultez-les depuis la fiche entité.',
          tip: 'Configurez les domaines email des partenaires pour une association automatique.'
        }
      ]
    }
  ]
}
