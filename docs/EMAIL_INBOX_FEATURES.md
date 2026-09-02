# Fonctionnalités de la boîte de réception email

## Synchronisation

Le système propose trois modes de synchronisation pour répondre à différents besoins :

### Sync rapide
- **Fenêtre de recherche** : Depuis la dernière synchronisation
- **Emails téléchargés** : Nouveaux emails uniquement (non encore en base)
- **Utilisation** : Vérification quotidienne automatique (toutes les heures via GitHub Actions)
- **Durée** : < 1 minute
- **Appels IA** : Uniquement sur les nouveaux threads

### Sync complète
- **Fenêtre de recherche** : Dernière année
- **Emails téléchargés** : Tous les emails de la dernière année
- **Utilisation** : Si la synchronisation n'a pas fonctionné pendant longtemps ou après une interruption
- **Durée** : 2-5 minutes
- **Appels IA** : Sur tous les nouveaux threads créés
- **Note** : Peut retélécharger des emails déjà en base si `last_uid_synced` a été réinitialisé

### Sync historique complète (nouveau) 🆕
- **Fenêtre de recherche** : Depuis l'origine (TOUS les emails de la boîte mail)
- **Emails téléchargés** : **Uniquement les emails manquants** (filtrage intelligent)
- **Utilisation** : Première synchronisation ou récupération d'historique complet
- **Durée** : 5-15 minutes pour plusieurs milliers d'emails
- **Appels IA** : **Uniquement sur les nouveaux threads créés**
- **Avantages** :
  - ✅ Ne retélécharge pas les emails déjà synchronisés
  - ✅ Ne relance pas les appels IA sur les threads existants
  - ✅ Performance optimale (télécharge uniquement ce qui manque)
  - ✅ Récupération complète de l'historique sans limite de temps

Pour plus de détails sur la synchronisation historique, voir [EMAIL_HISTORICAL_BACKFILL.md](./EMAIL_HISTORICAL_BACKFILL.md).

### Intégrité des threads

Le système maintient automatiquement la cohérence entre les compteurs de threads et les messages réels :
- **Vérification quotidienne** : Recalcul automatique des `message_count` et `last_message_date`
- **Nettoyage automatique** : Suppression des threads orphelins (>7 jours sans messages)
- **Protection transactionnelle** : Les compteurs ne sont incrémentés qu'après insertion réussie des messages

Pour plus de détails, voir [EMAIL_THREAD_INTEGRITY.md](./EMAIL_THREAD_INTEGRITY.md).

## Recherche texte intégral

La recherche permet de trouver des emails en cherchant dans :
- Le sujet du thread
- Le résumé IA
- L'adresse de l'expéditeur
- Le nom et l'adresse des expéditeurs dans les messages
- Le contenu texte des messages (body_text et body_html)

### Implémentation technique

La recherche utilise une fonction PostgreSQL `search_email_threads(search_term TEXT)` qui :
- Utilise `pg_trgm` avec des index GIN pour des performances optimales
- Retourne les threads triés par pertinence (scoring basé sur les correspondances)
- Respecte la sécurité RLS (Row Level Security) - les utilisateurs ne peuvent chercher que dans leurs propres threads

### Utilisation

Dans l'interface, utilisez simplement la barre de recherche pour filtrer les emails. La recherche est instantanée et supporte :
- Recherche insensible à la casse
- Recherche par mots partiels
- Recherche dans tous les champs mentionnés ci-dessus

## Indicateurs CC/BCC

### Dans la liste des emails (EmailListItem)

#### Badge CC
- **Affichage** : Nombre de destinataires en copie
- **Couleur** : Bleu (`border-blue-500/50`, `text-blue-700`, `dark:text-blue-400`)
- **Icône** : `Users` (lucide-react)
- **Tooltip** : Liste complète des adresses CC au survol
- **Visible** : Desktop uniquement (`hidden lg:inline-flex`)
- **Format** : "CC: X" où X est le nombre de destinataires

#### Badge BCC
- **Affichage** : Nombre de destinataires en copie cachée
- **Couleur** : Violet (`border-purple-500/50`, `text-purple-700`, `dark:text-purple-400`)
- **Icône** : `UserCheck` (lucide-react)
- **Tooltip** : Liste complète des adresses BCC au survol
- **Visible** : Desktop uniquement, et seulement si l'utilisateur est expéditeur
- **Format** : "BCC: Y" où Y est le nombre de destinataires

### Dans le détail du thread (EmailThread)

#### Desktop
Affichage direct sous les destinataires TO :
- **CC** : Label en bleu avec liste des emails
  - Format : `CC: nom <email>, nom2 <email2>`
  - Si pas de nom : affiche uniquement l'email
  - Classe : `text-blue-600 dark:text-blue-400`
  
- **BCC** : Label en violet avec liste des emails
  - Format : `BCC: nom <email>, nom2 <email2>`
  - Si pas de nom : affiche uniquement l'email
  - Classe : `text-purple-600 dark:text-purple-400`

#### Mobile
Bouton compact "X CC, Y BCC" :
- Ouvre un Dialog au clic
- Affiche les listes complètes de CC et BCC
- Sections séparées avec titres colorés
- Format liste verticale pour une meilleure lisibilité

### Structure des données requises

```typescript
interface EmailMessage {
  cc_addresses?: Array<{ 
    email: string; 
    name?: string 
  }>;
  bcc_addresses?: Array<{ 
    email: string; 
    name?: string 
  }>;
}
```

### Composants utilisés

- `Badge` : Pour les indicateurs visuels
- `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` : Pour les infobulles
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger` : Pour l'affichage mobile
- `Button` : Pour le déclencheur du dialog mobile
- `Users`, `UserCheck` : Icônes de lucide-react

### Code couleur

| Type | Couleur | Usage |
|------|---------|-------|
| CC | Bleu | Copie visible par tous |
| BCC | Violet | Copie cachée (confidentielle) |

### Comportement responsive

| Breakpoint | EmailListItem | EmailThread |
|-----------|---------------|-------------|
| Mobile (< 1024px) | Badges masqués | Dialog avec bouton |
| Desktop (≥ 1024px) | Badges visibles avec tooltip | Affichage direct des listes |

## Fonctionnalités de réponse

### Répondre
- Bouton "Répondre" pour répondre uniquement à l'expéditeur
- Pré-remplit l'adresse TO avec l'expéditeur du dernier message

### Répondre à tous
- Bouton "Répondre à tous" pour inclure tous les participants
- Extrait automatiquement tous les participants du thread (TO et CC)
- Exclut l'utilisateur actuel de la liste des destinataires
- Supprime les doublons d'adresses email
- Support complet des CC dans la composition

### Fonctionnalités communes
- Auto-sauvegarde des brouillons toutes les 30 secondes
- Support des pièces jointes
- Éditeur de texte riche (TipTap)
- Gestion des erreurs d'envoi

## Actions en masse

Les actions suivantes peuvent être effectuées sur plusieurs emails sélectionnés :
- Marquer comme lu/non lu
- Archiver
- Marquer comme spam
- Supprimer

## Filtres disponibles

- Par catégorie (Interne, Établissement, etc.)
- Par statut de lecture
- Par présence de pièces jointes
- Par thread archivé
- Par spam
- Par ordre (date croissante/décroissante)
