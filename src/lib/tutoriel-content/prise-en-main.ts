import { TutorielModule } from '@/types/tutoriel'

export const priseEnMainModule: TutorielModule = {
  id: 'prise-en-main',
  title: 'Prise en main',
  description: 'Découvrez les bases de OpenPulse et commencez à utiliser l\'application efficacement',
  icon: 'Rocket',
  category: 'debutant',
  estimatedTime: '15 min',
  level: 'debutant',
  sections: [
    {
      id: 'premiere-connexion',
      title: 'Première connexion',
      description: 'Connectez-vous et configurez votre compte',
      steps: [
        {
          id: 'connexion',
          title: 'Se connecter à l\'application',
          content: 'Accédez à l\'application via l\'URL fournie par votre administrateur. Entrez votre email professionnel et votre mot de passe pour vous connecter.',
          tip: 'Si vous avez oublié votre mot de passe, cliquez sur "Mot de passe oublié" pour recevoir un email de réinitialisation.'
        },
        {
          id: '2fa',
          title: 'Configurer l\'authentification à deux facteurs (2FA)',
          content: 'Pour sécuriser votre compte, activez l\'authentification à deux facteurs dans les paramètres de sécurité. Scannez le QR code avec une application d\'authentification comme Google Authenticator ou Authy.',
          warning: 'Conservez précieusement vos codes de récupération en cas de perte de votre téléphone.'
        },
        {
          id: 'profil',
          title: 'Compléter votre profil',
          content: 'Accédez à votre profil pour ajouter votre photo, vérifier vos informations personnelles et configurer vos préférences de notification.'
        }
      ]
    },
    {
      id: 'navigation',
      title: 'Navigation dans l\'interface',
      description: 'Apprenez à naviguer efficacement dans l\'application',
      steps: [
        {
          id: 'sidebar',
          title: 'La barre latérale (Sidebar)',
          content: 'La barre latérale à gauche contient tous les menus de navigation organisés par catégories : Principal, CRM, Opérations, Finance & RH, Formation, Analyses et Administration. Cliquez sur une entrée pour accéder à la page correspondante.',
          tip: 'Vous pouvez réduire la sidebar en cliquant sur le bouton en haut pour gagner de l\'espace.'
        },
        {
          id: 'fil-ariane',
          title: 'Le fil d\'Ariane',
          content: 'En haut de chaque page, le fil d\'Ariane affiche votre historique de navigation. Cliquez sur n\'importe quel élément pour revenir à cette page.',
          tip: 'Sur mobile, utilisez le menu déroulant pour voir les pages précédentes.'
        },
        {
          id: 'recherche',
          title: 'Recherche globale',
          content: 'Utilisez la barre de recherche disponible sur de nombreuses pages pour trouver rapidement des établissements, des tâches ou des contacts.'
        },
        {
          id: 'raccourcis',
          title: 'Raccourcis clavier',
          content: 'Des raccourcis clavier sont disponibles pour accélérer votre navigation. Appuyez sur "?" pour afficher la liste des raccourcis disponibles.',
          tip: 'Les raccourcis les plus utiles : Echap pour fermer les modales, / pour rechercher.'
        }
      ]
    },
    {
      id: 'personnalisation',
      title: 'Personnalisation',
      description: 'Adaptez l\'application à vos préférences',
      steps: [
        {
          id: 'theme',
          title: 'Choisir son thème',
          content: 'Basculez entre le mode clair et le mode sombre en cliquant sur le bouton dans le pied de page de la sidebar, ou dans les paramètres.',
          tip: 'Le mode sombre est recommandé pour réduire la fatigue oculaire lors d\'utilisation prolongée.'
        },
        {
          id: 'notifications',
          title: 'Configurer les notifications',
          content: 'Dans les paramètres, configurez vos préférences de notification pour recevoir des alertes sur les tâches importantes, les nouveaux emails ou les échéances.'
        }
      ]
    }
  ]
}
