# Guide Utilisateur - Module CRM

## Introduction

Le module CRM de OpenPulse permet de gérer l'ensemble du cycle de vie des établissements de santé, depuis la prospection jusqu'à la mise en production.

### Objectif

- Centraliser les informations sur les établissements clients
- Suivre le pipeline commercial
- Gérer les tâches et actions associées
- Collaborer efficacement entre équipes

### Prérequis

- Compte utilisateur OpenPulse actif
- Rôle approprié (commercial, chef de projet, CSM, admin)

---

## Premiers Pas

### Accès au Module

1. Connectez-vous à l'application
2. Dans la barre de navigation gauche, cliquez sur **Établissements**
3. Vous accédez à la vue liste des établissements

### Navigation

| Section | Description |
|---------|-------------|
| Établissements | Liste complète des établissements contractuels/production |
| Prospects | Pipeline des prospects (non encore contractuels) |
| Déploiement | Établissements en phase de déploiement |
| Production | Établissements en production active |

---

## Fonctionnalités

### 1. Gestion des Établissements

#### Créer un Établissement

1. Cliquez sur le bouton **+ Nouvel établissement**
2. Remplissez les informations obligatoires :
   - Nom de l'établissement
   - Ville
   - Région
   - Type (CHU, CH, Clinique, etc.)
   - Statut initial (Prospect par défaut)
3. Cliquez sur **Créer**

#### Modifier un Établissement

1. Cliquez sur une ligne du tableau pour ouvrir la fiche
2. Cliquez sur **Modifier** en haut à droite
3. Effectuez vos modifications
4. Cliquez sur **Enregistrer**

#### Informations Disponibles

| Champ | Description |
|-------|-------------|
| Nom | Nom officiel de l'établissement |
| Type | CHU, CH, Clinique, EHPAD, etc. |
| Ville/Région | Localisation géographique |
| Statut | Prospect, Contractuel, Déploiement, Production |
| Progression | Pourcentage d'avancement (0-100%) |
| Commercial | Responsable commercial assigné |
| Chef de projet | Chef de projet assigné |
| CSM | Customer Success Manager assigné |

### 2. Pipeline Commercial

#### Vue Kanban

1. Accédez à **Prospects**
2. Visualisez les prospects par phase :
   - Identifié
   - Contacté
   - Qualifié
   - Proposition
   - Négociation
   - Gagné / Perdu

#### Déplacer un Prospect

- **Drag & Drop** : Glissez la carte vers la colonne souhaitée
- **Via la fiche** : Modifiez le statut dans les détails

#### Valeur Pondérée

Le pipeline affiche la valeur pondérée automatiquement :
- Identifié : 10%
- Contacté : 20%
- Qualifié : 40%
- Proposition : 60%
- Négociation : 80%
- Gagné : 100%

### 3. Gestion des Tâches

#### Créer une Tâche

1. Ouvrez la fiche d'un établissement
2. Cliquez sur l'onglet **Tâches**
3. Cliquez sur **+ Nouvelle tâche**
4. Remplissez :
   - Titre
   - Catégorie
   - Priorité (Haute, Moyenne, Basse)
   - Date d'échéance
   - Responsable
5. Cliquez sur **Créer**

#### Statuts des Tâches

| Statut | Description |
|--------|-------------|
| À faire | Tâche planifiée non démarrée |
| En cours | Tâche en cours de réalisation |
| Terminée | Tâche complétée |
| Bloquée | Tâche en attente d'une action externe |

#### Actions Rapides

- ✓ Marquer comme terminée
- 📋 Dupliquer
- 🗄️ Archiver
- ✏️ Modifier
- 🗑️ Supprimer

### 4. Contacts

#### Ajouter un Contact

1. Dans la fiche établissement, onglet **Contacts**
2. Cliquez sur **+ Ajouter un contact**
3. Remplissez les informations :
   - Nom / Prénom
   - Fonction
   - Email
   - Téléphone
   - Rôle (Principal, Technique, Décisionnaire)
4. Cliquez sur **Enregistrer**

#### Contacter

- Cliquez sur l'email pour ouvrir le composeur d'email
- Cliquez sur le téléphone pour copier le numéro

### 5. Documents

#### Types de Documents

- Contrats
- Devis
- Propositions commerciales
- Notes de réunion
- Documents techniques

#### Télécharger un Document

1. Onglet **Documents** dans la fiche établissement
2. Cliquez sur **+ Ajouter un document**
3. Sélectionnez le fichier
4. Choisissez la catégorie
5. Cliquez sur **Télécharger**

### 6. Groupes et Partenaires

#### Groupes d'Établissements

Regroupez plusieurs établissements sous une même entité :
- GHT (Groupement Hospitalier de Territoire)
- Groupe privé
- Réseau de cliniques

#### Partenaires

Gérez les partenaires externes :
- Intégrateurs
- Revendeurs
- Consultants

---

## Filtres et Recherche

### Barre de Recherche

Recherchez par :
- Nom de l'établissement
- Ville
- Région
- Type

### Filtres Avancés

| Filtre | Options |
|--------|---------|
| Statut | Tous, Prospect, Contractuel, Déploiement, Production |
| Type | CHU, CH, Clinique, EHPAD, etc. |
| Région | Liste des régions |
| Responsable | Mes établissements / Tous |

### Mes Établissements

Cochez **Mes établissements** pour voir uniquement ceux qui vous sont assignés.

---

## FAQ

### Comment convertir un prospect en client ?

1. Ouvrez la fiche du prospect
2. Modifiez le statut vers "Contractuel"
3. Renseignez la date de signature
4. Le prospect bascule automatiquement vers les établissements

### Comment suivre l'avancement d'un déploiement ?

1. Consultez la barre de progression sur la fiche
2. L'avancement est calculé automatiquement selon :
   - Les tâches terminées
   - Les jalons validés
   - Les livrables acceptés

### Comment exporter les données ?

1. Cliquez sur le bouton **Exporter** en haut de la liste
2. Choisissez le format (Excel, CSV)
3. Sélectionnez les colonnes à exporter

---

## Troubleshooting

### Les modifications ne s'enregistrent pas

1. Vérifiez votre connexion internet
2. Actualisez la page (F5)
3. Si le problème persiste, déconnectez-vous et reconnectez-vous

### Je ne vois pas certains établissements

1. Vérifiez que le filtre "Mes établissements" est désactivé
2. Vérifiez vos permissions auprès de l'administrateur

### Les tâches ne se synchronisent pas

1. Attendez quelques secondes (synchronisation en temps réel)
2. Cliquez sur le bouton d'actualisation

---

## Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl + N` | Nouveau établissement |
| `Ctrl + F` | Recherche |
| `Escape` | Fermer le panneau/dialog |
| `Tab` | Navigation entre champs |

---

## Ressources Complémentaires

- [Architecture des Hooks](./HOOKS_ARCHITECTURE.md)
- [API Reference](./API_REFERENCE.md)
