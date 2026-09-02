# Guide Utilisateur - Module Email

## Introduction

Le module Email de OpenPulse centralise toutes vos communications email professionnelles avec une classification IA automatique et une intégration native avec le CRM.

### Objectif

- Centraliser les emails de l'équipe
- Classification automatique par IA
- Lier les conversations aux établissements/partenaires
- Améliorer la productivité avec des suggestions IA

### Prérequis

- Compte email professionnel configuré
- Accès IMAP/SMTP activé sur votre messagerie

---

## Premiers Pas

### Accès au Module

1. Dans la navigation, cliquez sur **Emails**
2. La boîte de réception s'affiche par défaut

### Configuration du Compte Email

1. Cliquez sur **⚙️ Paramètres** (en haut à droite)
2. Sélectionnez **Comptes Email**
3. Cliquez sur **+ Ajouter un compte**
4. Renseignez :
   - Adresse email
   - Mot de passe (chiffré)
   - Serveur IMAP / Port
   - Serveur SMTP / Port
5. Testez la connexion
6. Cliquez sur **Enregistrer**

---

## Fonctionnalités

### 1. Boîte de Réception

#### Vue Liste

Les emails sont organisés par **conversation (thread)** regroupant tous les messages d'un même échange.

| Indicateur | Signification |
|------------|---------------|
| 🔵 Point bleu | Message non lu |
| 📎 Trombone | Pièce jointe |
| 🏷️ Tags | Classification IA |
| 🏥 Logo | Établissement associé |

#### Filtres Disponibles

| Filtre | Options |
|--------|---------|
| Boîte | Réception, Envoyés, Tous |
| Catégorie | Commercial, Support, Technique, Admin |
| Priorité | Haute, Moyenne, Basse |
| Non lus | Oui / Non |

#### Recherche

Recherchez dans :
- Sujet
- Expéditeur
- Résumé IA
- Contenu

### 2. Lecture des Emails

#### Panneau de Détail

1. Cliquez sur une conversation pour l'ouvrir
2. Le panneau de détail affiche :
   - En-tête (expéditeur, destinataires, date)
   - Corps du message
   - Pièces jointes
   - Historique de la conversation

#### Actions Disponibles

| Action | Description |
|--------|-------------|
| Répondre | Ouvrir le composeur de réponse |
| Transférer | Transférer le message |
| Archiver | Déplacer vers les archives |
| Spam | Marquer comme indésirable |
| Supprimer | Supprimer le message |

### 3. Rédaction d'Email

#### Nouveau Message

1. Cliquez sur **+ Nouveau message**
2. Le composeur s'ouvre

#### Champs du Composeur

| Champ | Description |
|-------|-------------|
| De | Sélectionnez le compte expéditeur |
| À | Destinataires (autocomplete) |
| Cc | Copie carbone |
| Objet | Sujet du message |
| Corps | Éditeur riche (TipTap) |

#### Éditeur Riche

Fonctionnalités disponibles :
- **Gras** / *Italique* / Souligné
- Listes à puces / numérotées
- Liens hypertexte
- Images
- Citations

#### Pièces Jointes

1. Cliquez sur 📎 ou glissez-déposez
2. Taille maximale : 25 Mo par fichier
3. Formats supportés : PDF, images, documents Office

### 4. Fonctionnalités IA

#### Classification Automatique

Chaque email entrant est automatiquement :
- Catégorisé (Commercial, Support, Technique, Administratif)
- Taggé avec des mots-clés pertinents
- Lié à un établissement/partenaire (si détecté)
- Résumé en une phrase

#### Correction Orthographique

1. Dans le composeur, cliquez sur **🔤 Corriger**
2. L'IA corrige automatiquement les fautes
3. Révisez les corrections suggérées
4. Cliquez sur **Appliquer**

#### Reformulation

1. Sélectionnez le texte à reformuler
2. Cliquez sur **✨ Reformuler**
3. Choisissez le ton :
   - Professionnel
   - Amical
   - Formel
   - Concis
4. L'IA propose une version reformulée

#### Suggestions de Réponse

1. Ouvrez un email
2. Cliquez sur **💡 Suggérer une réponse**
3. L'IA génère 2-3 propositions de réponse
4. Sélectionnez et personnalisez

#### Traduction

1. Sélectionnez le texte
2. Cliquez sur **🌐 Traduire**
3. Choisissez la langue cible
4. Le texte traduit remplace la sélection

### 5. Liaison CRM

#### Association Automatique

L'IA détecte automatiquement les correspondants et lie les emails aux :
- Établissements
- Groupes
- Partenaires

#### Association Manuelle

1. Ouvrez un thread non associé
2. Cliquez sur **🔗 Lier à un établissement**
3. Recherchez et sélectionnez l'établissement
4. Cliquez sur **Associer**

#### Mapping de Domaines

Configurez des règles de mapping automatique :
- `@chu-paris.example.org` → CHU Paris
- `@groupe-hopital.fr` → Groupe Hôpital France

### 6. Comptes Partagés

#### Configuration

Les administrateurs peuvent configurer des comptes partagés (ex: support@, commercial@) accessibles par toute l'équipe.

#### Priorité de Synchronisation

Les comptes partagés sont synchronisés en priorité lors des mises à jour horaires.

---

## Synchronisation

### Synchronisation Automatique

- Les emails sont synchronisés **toutes les heures**
- Les comptes partagés sont traités en premier
- La dernière synchronisation est affichée dans les paramètres

### Synchronisation Manuelle

1. Cliquez sur **🔄 Actualiser** en haut de la liste
2. La synchronisation démarre immédiatement
3. Un indicateur de progression s'affiche

---

## FAQ

### Mes emails ne se synchronisent pas

1. Vérifiez les paramètres du compte (IMAP/mot de passe)
2. Testez la connexion dans les paramètres
3. Vérifiez que l'accès IMAP est activé chez votre fournisseur

### Comment exclure certains expéditeurs ?

1. Paramètres → Mappings de domaines
2. Ajoutez le domaine avec "Exclure" coché

### Les emails envoyés n'apparaissent pas

Les emails envoyés sont automatiquement copiés dans le dossier "Envoyés" IMAP. Si ce n'est pas le cas :
1. Vérifiez les paramètres SMTP
2. Le dossier Envoyés doit être synchronisé

### La classification IA est incorrecte

1. Ouvrez le thread
2. Cliquez sur le tag de catégorie
3. Sélectionnez la catégorie correcte
4. L'IA apprend de vos corrections

---

## Troubleshooting

### Erreur "Connexion IMAP refusée"

- Vérifiez que le port est correct (993 pour SSL, 143 pour STARTTLS)
- Activez l'accès aux "applications moins sécurisées" si nécessaire
- Générez un mot de passe d'application (Gmail, Office 365)

### Pièces jointes non téléchargeables

- Vérifiez votre connexion internet
- La pièce jointe peut être trop volumineuse
- Actualisez la page

### Emails anciens manquants

- La synchronisation initiale récupère les 30 derniers jours
- Pour un historique plus ancien, contactez l'administrateur

---

## Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `C` | Nouveau message |
| `R` | Répondre |
| `F` | Transférer |
| `E` | Archiver |
| `J` / `K` | Message suivant / précédent |
| `Ctrl + Enter` | Envoyer |
| `Escape` | Fermer le composeur |

---

## Bonnes Pratiques

1. **Répondez rapidement** aux emails prioritaires (étiquette rouge)
2. **Liez systématiquement** les emails aux établissements
3. **Utilisez les suggestions IA** pour gagner du temps
4. **Archivez** les conversations terminées
5. **Marquez comme spam** les emails indésirables pour entraîner l'IA

---

## Ressources Complémentaires

- [Architecture Email](./EMAIL_TECH_GUIDE.md)
- [Guide CRM](./CRM_USER_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
