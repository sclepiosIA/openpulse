import { TutorielModule } from '@/types/tutoriel'

export const emailsModule: TutorielModule = {
  id: 'emails',
  title: 'Emails',
  description: 'Gérez vos emails professionnels avec l\'aide de l\'intelligence artificielle',
  icon: 'Mail',
  category: 'principal',
  estimatedTime: '20 min',
  level: 'intermediaire',
  sections: [
    {
      id: 'configuration',
      title: 'Configuration du compte email',
      description: 'Connectez votre boîte mail professionnelle',
      steps: [
        {
          id: 'connexion-imap',
          title: 'Connexion IMAP/SMTP',
          content: 'Accédez aux paramètres email et configurez votre compte avec les serveurs IMAP (réception) et SMTP (envoi). Utilisez vos identifiants de messagerie professionnelle.',
          detailedContent: `La configuration IMAP/SMTP permet de synchroniser vos emails avec OpenPulse sans changer votre messagerie habituelle.

**Paramètres IMAP (réception) :**

• Serveur : imap.votrefournisseur.com
• Port : 993 (SSL) ou 143 (STARTTLS)
• Sécurité : SSL/TLS recommandé

**Paramètres SMTP (envoi) :**

• Serveur : smtp.votrefournisseur.com
• Port : 465 (SSL) ou 587 (STARTTLS)
• Authentification : Identique à IMAP

**Configurations courantes :**
| Fournisseur | IMAP | SMTP |
|-------------|------|------|
| Gmail | imap.gmail.com:993 | smtp.gmail.com:587 |
| Microsoft 365 | outlook.office365.com:993 | smtp.office365.com:587 |
| OVH | smtp.example.org:993 | smtp.example.org:587 |`,
          example: 'Pour Gmail avec 2FA : créez un "mot de passe d\'application" dans les paramètres de sécurité Google',
          warning: 'Utilisez un mot de passe d\'application si votre fournisseur email l\'exige (Google, Microsoft 365).',
          tip: 'Testez la connexion avant de valider pour vérifier que les paramètres sont corrects.'
        },
        {
          id: 'synchronisation',
          title: 'Synchronisation automatique',
          content: 'Une fois configuré, vos emails se synchronisent automatiquement toutes les 5 minutes. Les nouveaux emails apparaissent dans votre boîte de réception.',
          detailedContent: `La synchronisation automatique fonctionne en arrière-plan pour maintenir vos emails à jour.

**Fréquence de synchronisation :**

• Comptes personnels : toutes les 5 minutes
• Comptes partagés (support@) : toutes les 2 minutes
• Synchronisation manuelle : bouton "Actualiser"

**Ce qui est synchronisé :**

• Nouveaux emails entrants
• Statut lu/non lu
• Pièces jointes (jusqu\'à 25 Mo)

**Ce qui n\'est PAS synchronisé :**

• Dossiers personnalisés (seule INBOX)
• Emails supprimés côté serveur
• Brouillons

**Première synchronisation :**
Lors de la première configuration, les 500 derniers emails sont importés. Cela peut prendre quelques minutes selon le volume.`,
          example: 'Un compte avec 10 000 emails synchronise ~500 emails initialement, puis les nouveaux en continu',
          tip: 'La synchronisation consomme peu de bande passante grâce à la récupération incrémentale.'
        }
      ]
    },
    {
      id: 'boite-reception',
      title: 'Boîte de réception',
      description: 'Consultez et gérez vos emails',
      steps: [
        {
          id: 'lecture-emails',
          title: 'Lire les emails',
          content: 'Cliquez sur un email pour l\'ouvrir dans le panneau de lecture. Les emails non lus sont marqués en gras avec un indicateur visuel.',
          detailedContent: `L\'interface de lecture est optimisée pour une consultation rapide et efficace.

**Panneau de liste (gauche) :**

• Sujet de l\'email (tronqué si trop long)
• Expéditeur avec avatar
• Aperçu du contenu (2 lignes)
• Heure ou date de réception
• Badges : établissement détecté, catégorie, pièces jointes

**Panneau de lecture (droite) :**

• En-tête complet (De, À, Cc, Date)
• Corps de l\'email avec mise en forme
• Liste des pièces jointes
• Actions : Répondre, Transférer, Archiver

**Raccourcis clavier :**

• ↑/↓ : Naviguer entre les emails
• Entrée : Ouvrir l\'email sélectionné
• R : Répondre
• F : Transférer
• E : Archiver`,
          example: 'Un email non lu de "Dr Martin" avec 2 pièces jointes apparaît en gras avec une pastille bleue et une icône trombone',
          tip: 'Double-cliquez sur un email pour l\'ouvrir en plein écran.'
        },
        {
          id: 'filtres',
          title: 'Filtres rapides',
          content: 'Utilisez les boutons de filtre pour afficher : Tous les emails, Non lus, Importants. Le compteur de chaque filtre affiche le nombre d\'emails correspondants.',
          detailedContent: `Les filtres rapides permettent de trier instantanément votre boîte de réception.

**Filtres disponibles :**

| Filtre | Description | Raccourci |
|--------|-------------|-----------|
| Tous | Tous les emails | Alt+1 |
| Non lus | Emails non consultés | Alt+2 |
| Importants | Priorité haute (IA) | Alt+3 |
| Avec PJ | Pièces jointes | Alt+4 |

**Filtres combinables :**
Vous pouvez combiner plusieurs filtres. Par exemple :

• Non lus + Important = Emails urgents à traiter
• Avec PJ + Cette semaine = Documents récents

**Compteurs dynamiques :**
Les badges sur chaque filtre affichent le nombre d\'emails correspondants en temps réel.`,
          example: 'Le filtre "Non lus" affiche (12) → 12 emails attendent votre attention',
          tip: 'Le filtre "Importants" affiche les emails classés en priorité haute par l\'IA.'
        },
        {
          id: 'recherche',
          title: 'Recherche',
          content: 'Utilisez la barre de recherche pour trouver des emails par sujet, expéditeur ou contenu. La recherche s\'effectue dans tous les champs.',
          detailedContent: `La recherche full-text indexe tous vos emails pour une recherche instantanée.

**Champs recherchés :**

• Sujet de l\'email
• Corps du message (texte brut)
• Nom et adresse de l\'expéditeur
• Noms des pièces jointes

**Syntaxe avancée :**

• "phrase exacte" : Recherche la phrase exacte
• from:nom : Filtrer par expéditeur
• to:nom : Filtrer par destinataire
• has:attachment : Avec pièces jointes
• before:2024-01-01 : Avant une date
• after:2024-01-01 : Après une date

**Opérateurs :**

• AND : Les deux termes (par défaut)
• OR : L\'un ou l\'autre
• - : Exclure un terme`,
          example: 'Recherche "from:groupe contrat after:2024-01" → Emails du Groupe contenant "contrat" depuis janvier 2024',
          tip: 'La recherche est instantanée dès 2 caractères tapés.'
        }
      ]
    },
    {
      id: 'classification-ia',
      title: 'Classification IA',
      description: 'Laissez l\'IA organiser vos emails automatiquement',
      steps: [
        {
          id: 'classification-auto',
          title: 'Classification automatique',
          content: 'L\'IA GPT-5 analyse chaque email et le classifie automatiquement par catégorie (Commercial, Support, Administratif) et établissement associé.',
          detailedContent: `L\\'IA Azure GPT-5 analyse le contenu de chaque email pour l\\'enrichir automatiquement.\n\n**Ce que l\\'IA détecte :**\n\n1. **Catégorie principale :**\n   • Commercial : Prospection, négociation, renouvellement\n   • Support : Demandes d\\'aide, bugs, problèmes\n   • Administratif : Factures, contrats, documents légaux\n   • Formation : Sessions, inscriptions, certificats\n   • Autre : Non classifiable\n\n2. **Établissement associé :**\n   • Détection par domaine email (@groupe-vallois.example.org → Groupe Vallois)\n   • Analyse du contenu (mention du nom, références)\n   • Correspondance avec les contacts connus\n\n3. **Tags automatiques :**\n   • Urgence détectée\n   • Contrat mentionné\n   • RDV proposé\n   • Pièce jointe importante\n\n**Précision moyenne : 92%** pour les établissements connus.`,
          example: 'Email de support@cabinet-abc.example.org avec "erreur login" → Catégorie: Support, Établissement: Cabinet ABC',
          tip: 'Vous pouvez corriger manuellement une classification, l\'IA apprend de vos corrections.'
        },
        {
          id: 'categories',
          title: 'Catégories d\'emails',
          content: 'Les emails sont classés en catégories : Commercial (prospection, négociation), Support (demandes d\'assistance), Admin (facturation, contrats), Formation, et Autre.',
          detailedContent: `Chaque catégorie a un code couleur et des comportements spécifiques.

**Commercial (bleu) 🔵**

• Suivi pipeline automatique
• Création de tâches de relance
• Liaison avec l\'historique prospect

**Support (rouge) 🔴**

• Création automatique de ticket (si configuré)
• Priorité haute si mots-clés urgents
• Liaison avec l\'historique support client

**Administratif (gris) ⚪**

• Archivage documents
• Alertes échéances contrats
• Suivi facturation

**Formation (vert) 🟢**

• Liaison sessions de formation
• Suivi inscriptions
• Rappels automatiques

**Autre (jaune) 🟡**

• À classifier manuellement
• Souvent des newsletters ou notifications`,
          example: 'Un email contenant "facture" et "échéance" sera classé en Administratif avec un tag "Facturation"',
          tip: 'Les badges colorés indiquent la catégorie de chaque email dans la liste.'
        },
        {
          id: 'attribution-etablissement',
          title: 'Attribution d\'établissement',
          content: 'L\'IA détecte automatiquement l\'établissement concerné par l\'email grâce à l\'analyse du domaine de l\'expéditeur et du contenu du message.',
          detailedContent: `L\\'attribution d\\'établissement suit une logique en cascade pour maximiser la précision.\n\n**Ordre de priorité :**\n\n1. **Mapping spécifique** (100% précis)\n   • Email exact → Établissement\n   • Ex: clara.martin@groupe-vallois.example.org → Groupe Vallois\n\n2. **Mapping de domaine** (95% précis)\n   • Domaine email → Établissement\n   • Ex: *@cabinet-renard.example.org → Cabinet Renard\n\n3. **Analyse du contenu** (85% précis)\n   • Mentions du nom de l\\'établissement\n   • Références internes\n   • Historique de conversation\n\n4. **Suggestion IA** (70% précis)\n   • Quand aucun mapping ne correspond\n   • Basé sur le contexte global\n   • Propose avec niveau de confiance\n\n**Configuration des mappings :**\nParamètres → Emails → Domaines et mappings`,
          example: 'contact@groupe-xyz.fr peut être mappé au niveau Groupe, tous les établissements du groupe seront concernés',
          tip: 'Les mappings configurés s\'appliquent aux emails futurs et peuvent être appliqués rétroactivement.'
        }
      ]
    },
    {
      id: 'redaction-reponse',
      title: 'Rédaction et réponse',
      description: 'Composez et répondez aux emails efficacement',
      steps: [
        {
          id: 'composer',
          title: 'Composer un email',
          content: 'Cliquez sur "Nouveau message" pour ouvrir le compositeur. Remplissez les destinataires, le sujet et le corps du message.',
          detailedContent: `Le compositeur d\'email offre une expérience de rédaction moderne et assistée.

**Interface du compositeur :**

• À : Destinataires principaux (autocomplétion)
• Cc : Copie carbone
• Cci : Copie cachée
• Sujet : Titre de l\'email
• Corps : Éditeur riche avec mise en forme

**Autocomplétion intelligente :**
Tapez le début d\'un nom ou email, le système suggère :

• Contacts de la base (établissements)
• Emails récemment utilisés
• Membres de votre équipe

**Mise en forme disponible :**

• Gras, italique, souligné
• Listes à puces et numérotées
• Liens hypertexte
• Tableaux simples
• Images intégrées`,
          example: 'Tapez "mar" dans le champ À → Suggestions: Marie Dupont, Marc Martin, contact@mairie-sainte-colombe.fr',
          tip: 'Utilisez Ctrl+Entrée pour envoyer rapidement.'
        },
        {
          id: 'templates',
          title: 'Templates prédéfinis',
          content: 'Utilisez les templates email pour gagner du temps sur les réponses fréquentes : accusé de réception, proposition de RDV, envoi de documentation.',
          detailedContent: `Les templates sont des modèles d\'emails personnalisables qui s\'adaptent au contexte.

**Templates disponibles :**

1. **Accusé de réception**
   • "Nous avons bien reçu votre demande..."
   • Variables : {nom_contact}, {etablissement}

2. **Proposition de RDV**
   • Propose 3 créneaux
   • Variables : {date_1}, {date_2}, {date_3}

3. **Envoi de documentation**
   • Message standard + pièces jointes prédéfinies
   • Variables : {nom_produit}, {lien_documentation}

4. **Relance devis**
   • Rappel de proposition commerciale
   • Variables : {montant_devis}, {date_validite}

**Créer un template :**
Paramètres → Emails → Templates → Nouveau`,
          example: 'Template "Proposition de RDV" : "Bonjour {nom_contact}, suite à notre échange..."',
          tip: 'Les templates sont personnalisables par catégorie dans les paramètres.'
        },
        {
          id: 'assistant-ia',
          title: 'Assistant IA de rédaction',
          content: 'L\'assistant IA vous aide à rédiger vos emails. Utilisez les boutons pour : corriger l\'orthographe, reformuler le texte, traduire dans une autre langue, ou obtenir des suggestions de réponse.',
          detailedContent: `L\'assistant IA GPT-5 améliore vos emails en un clic.

**Fonctions disponibles :**

🔤 **Corriger l\'orthographe**

• Corrige fautes et grammaire
• Améliore la ponctuation
• Conserve le sens original

✏️ **Reformuler**

• Rend le texte plus professionnel
• Simplifie les phrases complexes
• Adapte le ton (formel/informel)

🌍 **Traduire**

• Français ↔ Anglais
• Autres langues sur demande
• Préserve la mise en forme

💡 **Suggérer une réponse**

• Analyse l\'email reçu
• Propose 2-3 réponses types
• Adapte au contexte établissement

**Temps de traitement : 2-5 secondes**`,
          example: 'Texte: "sa serais bien de faire une reunion" → Corrigé: "Ce serait bien de faire une réunion."',
          tip: 'L\'assistant utilise le contexte de la conversation pour proposer des réponses pertinentes.'
        },
        {
          id: 'pieces-jointes',
          title: 'Pièces jointes',
          content: 'Attachez des fichiers jusqu\'à 25 Mo par email. Les formats courants sont pris en charge : PDF, images, documents Office.',
          detailedContent: `La gestion des pièces jointes est optimisée pour les documents professionnels.

**Limites techniques :**

• Taille maximale par fichier : 25 Mo
• Taille totale par email : 50 Mo
• Nombre de pièces jointes : Illimité

**Formats supportés :**
| Type | Extensions |
|------|------------|
| Documents | .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx |
| Images | .jpg, .png, .gif, .webp |
| Texte | .txt, .csv, .rtf |
| Compressés | .zip, .rar |

**Fonctionnalités :**

• Glisser-déposer depuis le bureau
• Aperçu des images
• Téléchargement groupé des PJ reçues
• Stockage dans le dossier établissement`,
          example: 'Joignez le contrat.pdf (2 Mo) + logo.png (500 Ko) = 2.5 Mo utilisés sur 25 Mo disponibles',
          tip: 'Les fichiers lourds peuvent être partagés via un lien de téléchargement.'
        }
      ]
    },
    {
      id: 'maintenance',
      title: 'Maintenance et configuration',
      description: 'Optimisez la classification et la gestion des emails',
      steps: [
        {
          id: 'classification-masse',
          title: 'Classification en masse',
          content: 'Lancez une classification en masse pour traiter les emails non classifiés. Choisissez entre : Rapide (50 emails), Standard (100), ou Complète (jusqu\'à 10 000).',
          detailedContent: `La classification en masse permet de rattraper un retard de traitement ou de reclassifier des emails après une mise à jour des mappings.

**Modes disponibles :**

| Mode | Emails traités | Durée estimée |
|------|----------------|---------------|
| Rapide | 50 derniers | ~30 secondes |
| Standard | 100 emails | ~1 minute |
| Complète | Jusqu\'à 10 000 | ~5 minutes |

**Cas d\'utilisation :**

• Après configuration initiale du compte
• Après ajout de nouveaux mappings de domaines
• Après correction manuelle de classifications (apprentissage)

**Priorité de traitement :**

1. Emails non classifiés (sans catégorie)
2. Emails sans établissement détecté
3. Emails avec faible confiance IA`,
          example: 'Classification complète : 8 542 emails traités, 7 892 (92%) attribués à un établissement',
          warning: 'La classification complète peut prendre jusqu\'à 5 minutes. Évitez de quitter la page.'
        },
        {
          id: 'domaines-mappings',
          title: 'Domaines et mappings',
          content: 'Configurez les mappings de domaines pour associer automatiquement les emails d\'un domaine à un établissement spécifique.',
          detailedContent: `Les mappings de domaines automatisent l\\'attribution des emails aux établissements.\n\n**Types de mappings :**\n\n1. **Mapping de domaine**\n   • @groupe-vallois.example.org → Groupe Vallois\n   • Tous les emails de ce domaine → même établissement\n\n2. **Mapping de sous-domaine**\n   • @*.entreprise.fr → Groupe Entreprise\n   • Wildcard pour les sous-domaines\n\n3. **Mapping d\\'email spécifique**\n   • contact@consultant.fr → Client spécifique\n   • Override du mapping de domaine\n\n**Ordre de priorité :**\nEmail spécifique > Domaine exact > Sous-domaine wildcard\n\n**Bonnes pratiques :**\n• Mappez d\\'abord les domaines des clients actifs\n• Utilisez les wildcards pour les groupes multi-sites\n• Vérifiez régulièrement les emails non mappés`,
          example: 'Mapping @*.ap-hp.fr → Groupe AP-HP (couvre tous les hôpitaux du groupe)',
          tip: 'Les mappings configurés s\'appliquent aux emails futurs et peuvent être appliqués rétroactivement.'
        },
        {
          id: 'nettoyage',
          title: 'Nettoyage des suggestions',
          content: 'Utilisez la fonction de nettoyage pour supprimer les suggestions obsolètes et améliorer les performances de la classification.',
          detailedContent: `Le nettoyage régulier maintient la qualité du système de classification.

**Ce qui est nettoyé :**

• Suggestions IA refusées ou expirées
• Contacts dupliqués
• Threads email cassés (messages orphelins)
• Cache de classification obsolète

**Fréquence recommandée :**

• Nettoyage léger : Chaque semaine (automatique)
• Nettoyage complet : Chaque mois (manuel)

**Impact du nettoyage :**

• Améliore les performances de recherche
• Libère de l\'espace de stockage
• Rafraîchit les statistiques IA

**Durée estimée :**

• < 1000 emails : Instantané
• 1000-10000 emails : ~30 secondes
• > 10000 emails : ~2 minutes`,
          example: 'Nettoyage terminé : 234 suggestions obsolètes supprimées, 12 contacts dédupliqués',
          tip: 'Le nettoyage automatique hebdomadaire est activé par défaut dans les paramètres.'
        }
      ]
    }
  ]
}
