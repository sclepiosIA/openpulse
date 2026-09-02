import { TutorielModule } from '@/types/tutoriel'

export const visioModule: TutorielModule = {
  id: 'visio',
  title: 'Visioconférence',
  description: 'Planifiez et gérez vos réunions vidéo directement depuis l\'application',
  icon: 'Video',
  category: 'principal',
  estimatedTime: '8 min',
  level: 'debutant',
  sections: [
    {
      id: 'planifier-visio',
      title: 'Planifier une visioconférence',
      description: 'Créer et configurer une réunion vidéo',
      steps: [
        {
          id: 'creation-reunion',
          title: 'Créer une réunion',
          content: 'Créez une visio depuis le calendrier ou depuis une fiche établissement.',
          detailedContent: `Pour planifier une visio:

1. Cliquez sur "Nouvelle réunion" dans le calendrier
2. Sélectionnez "Visioconférence" comme type
3. Ajoutez les participants (internes et externes)
4. Définissez la date et la durée
5. Le lien de visio est généré automatiquement`,
          tip: 'Les invitations avec le lien sont envoyées automatiquement aux participants.'
        },
        {
          id: 'options-reunion',
          title: 'Options de la réunion',
          content: 'Configurez les paramètres: salle d\'attente, enregistrement, partage d\'écran.',
          detailedContent: `Options disponibles:

- **Salle d\'attente**: Les participants attendent votre validation
- **Enregistrement**: Activez l\'enregistrement automatique
- **Partage d\'écran**: Autorisez tous ou uniquement l\'hôte
- **Chat**: Activez ou désactivez le chat textuel`
        }
      ]
    },
    {
      id: 'rejoindre-reunion',
      title: 'Rejoindre une réunion',
      description: 'Comment participer à une visio',
      steps: [
        {
          id: 'acces-reunion',
          title: 'Accéder à la réunion',
          content: 'Rejoignez depuis la notification, le calendrier ou le lien reçu par email.',
          detailedContent: `Plusieurs façons de rejoindre:

- Cliquez sur la notification de rappel
- Depuis l\'événement dans votre calendrier
- Via le lien dans l\'email d\'invitation
- Depuis la fiche de l\'établissement concerné`,
          tip: 'Testez votre caméra et micro avant de rejoindre via le bouton "Vérifier l\'équipement".'
        },
        {
          id: 'interface-visio',
          title: 'Interface de la visio',
          content: 'Découvrez les commandes: micro, caméra, partage d\'écran, chat, participants.',
          detailedContent: `Les contrôles principaux:

- **Micro**: Coupez/activez votre micro (raccourci: M)
- **Caméra**: Coupez/activez votre vidéo (raccourci: V)
- **Partage**: Partagez votre écran ou une fenêtre
- **Chat**: Envoyez des messages aux participants
- **Main levée**: Signalez que vous souhaitez parler`
        }
      ]
    },
    {
      id: 'partage-ecran',
      title: 'Partage d\'écran',
      description: 'Présenter votre écran aux participants',
      steps: [
        {
          id: 'demarrer-partage',
          title: 'Démarrer le partage',
          content: 'Cliquez sur "Partager" et sélectionnez ce que vous voulez montrer.',
          detailedContent: `Options de partage:

- **Écran entier**: Tout votre bureau est visible
- **Fenêtre**: Une application spécifique uniquement
- **Onglet navigateur**: Un onglet avec le son
- **Tableau blanc**: Espace collaboratif de dessin`,
          warning: 'Fermez les applications sensibles avant de partager votre écran entier.'
        },
        {
          id: 'annotations',
          title: 'Annoter le partage',
          content: 'Utilisez les outils d\'annotation pour surligner, dessiner ou pointer.',
          detailedContent: `Outils d\'annotation:

- Pointeur laser virtuel
- Surligneur
- Formes géométriques
- Zone de texte
- Effaceur`
        }
      ]
    }
  ]
}
