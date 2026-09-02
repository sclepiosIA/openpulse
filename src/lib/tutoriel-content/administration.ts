import { TutorielModule } from '@/types/tutoriel'

export const administrationModule: TutorielModule = {
  id: 'administration',
  title: 'Administration',
  description: 'Configurez et sécurisez votre application',
  icon: 'Settings',
  category: 'administration',
  estimatedTime: '20 min',
  level: 'avance',
  sections: [
    {
      id: 'gestion-utilisateurs',
      title: 'Gestion des utilisateurs',
      description: 'Administrez les comptes utilisateurs',
      steps: [
        {
          id: 'creer-utilisateur',
          title: 'Créer un utilisateur',
          content: 'Cliquez sur "Nouvel utilisateur" pour créer un compte. Renseignez l\'email, le nom, le prénom et le rôle. Un email d\'invitation est envoyé automatiquement.',
          warning: 'Assurez-vous que l\'email est correct, l\'utilisateur recevra son lien d\'activation dessus.'
        },
        {
          id: 'attribuer-role',
          title: 'Attribuer un rôle',
          content: 'Les rôles disponibles : Admin (tous accès), Commercial (prospects, établissements), Chef de projet (déploiement), CSM (production), RH (people). Chaque rôle a des permissions spécifiques.'
        },
        {
          id: 'activer-desactiver',
          title: 'Activer/Désactiver',
          content: 'Désactivez un compte pour bloquer l\'accès sans le supprimer. L\'utilisateur ne peut plus se connecter mais son historique est conservé.',
          tip: 'Privilégiez la désactivation à la suppression pour conserver la traçabilité.'
        }
      ]
    },
    {
      id: 'securite',
      title: 'Sécurité',
      description: 'Renforcez la sécurité de l\'application',
      steps: [
        {
          id: '2fa-admin',
          title: 'Authentification 2FA',
          content: 'L\'authentification à deux facteurs est obligatoire pour les comptes administrateurs. Configurez-la dans les paramètres de sécurité avec une application comme Google Authenticator.',
          warning: 'Conservez vos codes de récupération en lieu sûr en cas de perte du téléphone.'
        },
        {
          id: 'logs-connexion',
          title: 'Logs de connexion',
          content: 'Consultez l\'historique des connexions : date, heure, IP, navigateur, succès/échec. Identifiez les tentatives suspectes.'
        },
        {
          id: 'ips-autorisees',
          title: 'IPs autorisées',
          content: 'Restreignez l\'accès à certaines adresses IP pour un niveau de sécurité supplémentaire. Utile pour limiter l\'accès aux réseaux de l\'entreprise.',
          tip: 'Attention à ne pas vous bloquer vous-même. Testez avant d\'activer les restrictions.'
        }
      ]
    },
    {
      id: 'configuration-systeme',
      title: 'Configuration système',
      description: 'Paramétrez le système',
      steps: [
        {
          id: 'parametres-generaux',
          title: 'Paramètres généraux',
          content: 'Configurez les paramètres globaux : nom de l\'organisation, fuseau horaire, langue par défaut, format de date.'
        },
        {
          id: 'secrets-api',
          title: 'Secrets et clés API',
          content: 'Gérez les clés API pour les intégrations externes : Qonto, services email, etc. Les secrets sont stockés de manière chiffrée.',
          warning: 'Ne partagez jamais vos clés API. Regénérez-les si vous suspectez une compromission.'
        },
        {
          id: 'logs-systeme',
          title: 'Logs système',
          content: 'Consultez les logs techniques de l\'application : erreurs, performances, événements système. Utile pour le diagnostic de problèmes.'
        }
      ]
    }
  ]
}
