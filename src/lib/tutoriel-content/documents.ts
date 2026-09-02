import { TutorielModule } from '@/types/tutoriel'

export const documentsModule: TutorielModule = {
  id: 'documents',
  title: 'Gestion Documentaire',
  description: 'Organisez, partagez et retrouvez facilement tous vos documents',
  icon: 'FolderOpen',
  category: 'administration',
  estimatedTime: '8 min',
  level: 'debutant',
  sections: [
    {
      id: 'organisation-fichiers',
      title: 'Organisation des fichiers',
      description: 'Structurer vos documents efficacement',
      steps: [
        {
          id: 'arborescence',
          title: 'Comprendre l\'arborescence',
          content: 'Les documents sont organisés par établissement, puis par catégorie (Contrats, Formations, Technique, etc.).',
          detailedContent: `L\'arborescence documentaire:

- **Par établissement**: Chaque établissement a son espace dédié
- **Par catégorie**: Contrats, Factures, Formations, Technique, Divers
- **Par date**: Classement chronologique automatique
- **Par type**: Filtrage par extension de fichier`,
          tip: 'Utilisez les tags personnalisés pour un classement transversal.'
        },
        {
          id: 'upload-documents',
          title: 'Uploader des documents',
          content: 'Glissez-déposez vos fichiers ou utilisez le bouton d\'upload.',
          detailedContent: `Formats supportés:

- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT
- Images: JPG, PNG, GIF
- Taille maximale: 25 Mo par fichier
- Upload multiple possible`,
          warning: 'Les fichiers sensibles doivent être uploadés avec l\'option "Confidentiel".'
        }
      ]
    },
    {
      id: 'partage-permissions',
      title: 'Partage et permissions',
      description: 'Contrôler l\'accès aux documents',
      steps: [
        {
          id: 'niveaux-acces',
          title: 'Niveaux d\'accès',
          content: 'Définissez qui peut voir, modifier ou supprimer chaque document.',
          detailedContent: `Les niveaux de permission:

- **Lecture**: Visualisation et téléchargement uniquement
- **Écriture**: Peut modifier et remplacer le fichier
- **Admin**: Peut supprimer et gérer les permissions
- **Confidentiel**: Accès restreint aux rôles autorisés`,
          example: 'Contrat signé → Lecture pour Commercial, Admin pour Direction'
        },
        {
          id: 'liens-partage',
          title: 'Liens de partage',
          content: 'Créez des liens de partage temporaires pour les parties externes.',
          detailedContent: `Les liens de partage permettent:

- Partage sans compte utilisateur
- Expiration configurable (1h à 30 jours)
- Protection par mot de passe optionnelle
- Traçabilité des accès`,
          tip: 'Les liens expirés sont automatiquement supprimés.'
        }
      ]
    },
    {
      id: 'recherche-avancee',
      title: 'Recherche avancée',
      description: 'Retrouver rapidement vos documents',
      steps: [
        {
          id: 'recherche-plein-texte',
          title: 'Recherche plein texte',
          content: 'Recherchez dans le contenu des documents PDF et Office.',
          detailedContent: `La recherche indexe:

- Nom du fichier
- Contenu textuel (OCR pour les PDF scannés)
- Tags et métadonnées
- Établissement et catégorie associés`,
          example: 'Recherche "formation janvier" → 12 documents trouvés'
        },
        {
          id: 'filtres-recherche',
          title: 'Filtres de recherche',
          content: 'Combinez les filtres pour affiner vos résultats.',
          detailedContent: `Filtres disponibles:

- Par type de document
- Par établissement
- Par date d\'upload
- Par auteur
- Par tag personnalisé`
        }
      ]
    }
  ]
}
