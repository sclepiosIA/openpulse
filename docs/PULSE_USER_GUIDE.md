# Guide Utilisateur - Module Pulse

## Introduction

Pulse est le module de messagerie instantanée interne de OpenPulse. Il permet à l'équipe de communiquer en temps réel, de collaborer sur des projets et de lier les discussions aux tâches et établissements.

### Objectif

- Communication en temps réel entre collaborateurs
- Organisation des discussions par canaux thématiques
- Liaison avec le CRM et les tâches
- Recherche dans l'historique des conversations

### Prérequis

- Compte utilisateur OpenPulse actif
- Navigateur moderne avec support des WebSockets

---

## Premiers Pas

### Accès au Module

1. Dans la navigation, cliquez sur **Pulse**
2. La liste des conversations s'affiche à gauche
3. Sélectionnez une conversation pour voir les messages

### Interface

| Zone | Description |
|------|-------------|
| Panneau gauche | Liste des conversations |
| Zone centrale | Messages de la conversation active |
| Zone de saisie | Composeur de message en bas |
| Panneau droit | Détails de la conversation (optionnel) |

---

## Fonctionnalités

### 1. Types de Conversations

#### Messages Directs (DM)

Conversations privées entre deux utilisateurs.

1. Cliquez sur **+ Nouveau message**
2. Recherchez un collègue
3. Sélectionnez pour démarrer la conversation

#### Groupes

Conversations entre plusieurs utilisateurs.

1. Cliquez sur **+ Nouveau groupe**
2. Donnez un nom au groupe
3. Ajoutez les membres
4. Cliquez sur **Créer**

#### Canaux

Espaces de discussion thématiques ouverts à tous.

| Canal | Usage |
|-------|-------|
| #général | Annonces et discussions générales |
| #support | Questions et entraide |
| #commercial | Équipe commerciale |
| #tech | Discussions techniques |

### 2. Envoi de Messages

#### Texte Simple

1. Tapez votre message dans la zone de saisie
2. Appuyez sur **Entrée** ou cliquez sur **Envoyer**

#### Formatage

| Syntaxe | Résultat |
|---------|----------|
| `*texte*` | *Italique* |
| `**texte**` | **Gras** |
| `` `code` `` | `Code inline` |
| ` ```code``` ` | Bloc de code |

#### Mentions

- `@nom` : Mentionner un utilisateur
- `@tous` : Notifier tout le groupe/canal
- L'utilisateur mentionné reçoit une notification push

#### Émojis

1. Cliquez sur 😊 à côté du champ de saisie
2. Sélectionnez un émoji
3. Ou tapez `:nom_emoji:` (ex: `:thumbsup:`)

### 3. Médias et Fichiers

#### Partager une Image

1. Cliquez sur 📎 (trombone)
2. Sélectionnez une image
3. Ajoutez un commentaire (optionnel)
4. Envoyez

#### Partager un Fichier

1. Glissez-déposez le fichier dans la zone de message
2. Ou cliquez sur 📎 et sélectionnez
3. Formats supportés : PDF, documents Office, images

#### Limite de Taille

- Images : 10 Mo max
- Fichiers : 25 Mo max

### 4. Réactions

Réagissez rapidement aux messages sans répondre :

1. Survolez un message
2. Cliquez sur l'icône 😊
3. Sélectionnez une réaction
4. Les réactions s'affichent sous le message

### 5. Threads (Réponses)

Organisez les discussions complexes :

1. Survolez un message
2. Cliquez sur **💬 Répondre en thread**
3. La conversation s'ouvre dans un panneau latéral
4. Les réponses sont groupées sous le message parent

### 6. Liaison avec le CRM

#### Lier une Tâche

1. Cliquez sur **+ Action** dans le composeur
2. Sélectionnez **Lier une tâche**
3. Recherchez et sélectionnez la tâche
4. Le message affiche un aperçu de la tâche

#### Créer une Tâche depuis un Message

1. Survolez le message
2. Cliquez sur **⋮** (menu)
3. Sélectionnez **Créer une tâche**
4. Pré-rempli avec le contenu du message
5. Complétez et enregistrez

#### Mentionner un Établissement

1. Tapez `#` suivi du nom
2. L'autocomplete propose les établissements
3. Sélectionnez pour créer un lien cliquable

### 7. Recherche

#### Recherche Globale

1. Cliquez sur 🔍 en haut
2. Tapez votre recherche
3. Les résultats incluent :
   - Messages
   - Fichiers
   - Utilisateurs

#### Recherche dans une Conversation

1. Ouvrez une conversation
2. Cliquez sur 🔍 dans l'en-tête
3. Recherchez dans cette conversation uniquement

#### Filtres de Recherche

| Filtre | Syntaxe |
|--------|---------|
| De | `from:@jean` |
| Dans | `in:#général` |
| Avec fichier | `has:file` |
| Date | `before:2024-01-01` |

### 8. Notifications

#### Types de Notifications

| Type | Déclencheur |
|------|-------------|
| Mention | Quelqu'un vous @mentionne |
| Message direct | Nouveau DM |
| Thread | Réponse à votre message |

#### Paramètres

1. Cliquez sur votre avatar → **Paramètres**
2. Section **Notifications Pulse**
3. Configurez :
   - Push activées/désactivées
   - Horaires silencieux
   - Sons

---

## Temps Réel

### Indicateurs de Présence

| Indicateur | Signification |
|------------|---------------|
| 🟢 Vert | En ligne |
| 🟡 Orange | Absent (inactif > 5 min) |
| ⚫ Gris | Hors ligne |
| 🔴 Rouge | Ne pas déranger |

### Indicateur de Frappe

Quand un utilisateur tape un message, vous voyez "Jean est en train d'écrire..."

---

## FAQ

### Comment quitter un groupe ?

1. Ouvrez le groupe
2. Cliquez sur ⚙️ (paramètres du groupe)
3. Cliquez sur **Quitter le groupe**

### Comment modifier un message envoyé ?

1. Survolez votre message
2. Cliquez sur ✏️ (modifier)
3. Éditez le texte
4. Appuyez sur Entrée pour valider

L'indicateur "(modifié)" apparaît à côté du message.

### Comment supprimer un message ?

1. Survolez votre message
2. Cliquez sur 🗑️ (supprimer)
3. Confirmez la suppression

**Note** : Le message est masqué pour vous uniquement. Les autres peuvent toujours le voir (sauf si vous êtes admin).

### Les notifications ne fonctionnent pas

1. Vérifiez que les notifications sont autorisées dans votre navigateur
2. Paramètres → Notifications → Activez pour OpenPulse
3. Sur iOS : Installez l'app en PWA (Ajouter à l'écran d'accueil)

---

## Troubleshooting

### Messages non envoyés

1. Vérifiez votre connexion internet
2. Les messages en attente affichent ⏳
3. Ils s'envoient automatiquement dès la reconnexion

### Conversation non synchronisée

1. Actualisez la page (F5)
2. Les messages apparaissent en temps réel normalement
3. Si le problème persiste, déconnectez/reconnectez-vous

### Fichier non téléchargeable

1. Vérifiez que le fichier n'a pas été supprimé
2. Vérifiez vos permissions d'accès à la conversation
3. Essayez avec un autre navigateur

---

## Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl + K` | Recherche rapide |
| `Ctrl + N` | Nouvelle conversation |
| `Ctrl + /` | Aide raccourcis |
| `Escape` | Fermer le panneau actif |
| `↑` | Modifier le dernier message |

---

## Bonnes Pratiques

1. **Utilisez les threads** pour garder les discussions organisées
2. **Mentionnez précisément** pour éviter de notifier inutilement
3. **Liez les tâches** pour un suivi efficace
4. **Utilisez les réactions** pour acquiescer sans polluer la conversation
5. **Archivez les conversations** terminées

---

## Ressources Complémentaires

- [Guide Email](./EMAIL_USER_GUIDE.md)
- [Guide CRM](./CRM_USER_GUIDE.md)
- [API Pulse](./API_REFERENCE.md)
