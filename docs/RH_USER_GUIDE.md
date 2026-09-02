# 📘 Guide Utilisateur - Module RH

> **Version** : 1.9.0  
> **Dernière mise à jour** : Mars 2026
> **Public cible** : Gestionnaires RH, Managers, Administrateurs

---

## 📑 Table des matières

1. [Introduction](#introduction)
2. [Accès au module](#accès-au-module)
3. [Vue d'ensemble](#vue-densemble)
4. [Gestion des salaires](#gestion-des-salaires)
5. [Objectifs CA](#objectifs-ca)
6. [Planning des absences](#planning-des-absences)
7. [Fiches employés](#fiches-employés)
8. [Exports](#exports)
9. [Raccourcis clavier](#raccourcis-clavier)
10. [FAQ](#faq)

---

## 🎯 Introduction

Le module **Ressources Humaines** vous permet de gérer l'ensemble du cycle de paie, de définir des objectifs commerciaux par employé, de planifier les absences et d'exporter les données vers votre logiciel de comptabilité.

### Fonctionnalités principales

✅ **Gestion complète des salaires** : Calcul automatique des cotisations  
✅ **Objectifs CA trimestriels** : Suivi de la performance commerciale  
✅ **Planification des absences** : Calendrier intégré avec taux d'absentéisme  
✅ **Fiches employés** : Vue consolidée par personne  
✅ **Exports automatisés** : CSV et Excel pour la paie  
✅ **Synchronisation trésorerie** : Les salaires créent automatiquement des dépenses

---

## 🔐 Accès au module

### URL directe
```
https://votre-app.com/rh
```

### Navigation
1. Connexion à l'application
2. Menu principal → **Ressources Humaines**

### Permissions requises
- **Administrateur** : Accès complet (lecture, écriture, suppression)
- **Manager RH** : Lecture et écriture (pas de suppression)
- **Employé** : Lecture seule de sa propre fiche

---

## 📊 Vue d'ensemble

L'onglet **Vue d'ensemble** affiche les indicateurs clés en temps réel.

### KPIs affichés

#### 1. Effectif actif
- **Calcul** : Nombre d'employés avec le statut "Actif"
- **Mise à jour** : Temps réel
- **Exemple** : 4 employés actifs

#### 2. Masse salariale
- **Masse salariale mensuelle** : Somme des salaires bruts du mois courant
- **Masse salariale annuelle** : Total mensuel × 12
- **Format** : Affiché en euros avec séparateurs de milliers
- **Exemple** : 14,000€/mois → 168,000€/an

#### 3. Taux d'atteinte des objectifs CA
- **Calcul** : (CA réalisé / CA objectif) × 100
- **Période** : Trimestre en cours
- **Code couleur** :
  - 🟢 Vert : ≥ 100% (objectif atteint)
  - 🟠 Orange : 80-99% (proche)
  - 🔴 Rouge : < 80% (à améliorer)

#### 4. Taux d'absentéisme
- **Calcul** : (Jours d'absence / (Effectif × 22 jours ouvrés)) × 100
- **Période** : Mois en cours
- **Benchmark** : Moyenne nationale ≈ 5%

### Widgets intégrés

#### Widget Trésorerie
Affiche le solde de trésorerie actuel avec un lien direct vers le module Trésorerie.

**Utilité** : Vérifier l'impact des salaires sur la trésorerie en un coup d'œil.

#### Widget Réconciliation RH ↔ Trésorerie
Indique si les salaires RH sont bien synchronisés avec les dépenses de trésorerie.

**Statuts possibles** :
- ✅ **Synchronisé** : Tout est à jour
- ⚠️ **Écarts détectés** : Cliquer sur "Détails" pour voir les incohérences
- 🔄 **Synchronisation en cours** : Attendre quelques secondes

**Action** : Bouton "Synchroniser maintenant" pour forcer la sync si nécessaire.

---

## 💰 Gestion des salaires

L'onglet **Salaires** permet de visualiser, créer, modifier et supprimer les salaires mensuels.

### Visualisation du tableau

Le tableau affiche une ligne par salaire avec les colonnes suivantes :

| Colonne | Description |
|---------|-------------|
| **Employé** | Prénom + Nom |
| **Salaire brut** | Montant avant déduction des cotisations |
| **Cotisations patronales** | 45% du brut (charges employeur) |
| **Cotisations salariales** | 24% du brut (charges employé) |
| **Primes** | Primes exceptionnelles |
| **Heures supp.** | Rémunération des heures supplémentaires |
| **Salaire net** | Montant versé à l'employé |
| **Actions** | Éditer / Supprimer |

### Sélection du mois

**En haut à droite** : Liste déroulante pour choisir le mois à afficher.

**Par défaut** : Mois courant (ex: Janvier 2025)

**Navigation rapide** : Les 12 derniers mois sont accessibles.

---

### ✏️ Modifier un salaire

#### Méthode 1 : Édition inline (recommandée)

1. **Double-cliquer** sur un champ éditable (Salaire brut, Primes, Heures supp.)
2. Le champ devient bleu (mode édition)
3. **Saisir la nouvelle valeur**
4. **Appuyer sur Entrée** ou **Tab** pour sauvegarder
5. Les cotisations se **recalculent automatiquement**

#### Méthode 2 : Mode édition global

1. Cliquer sur l'icône **Crayon** à droite de la ligne
2. Tous les champs deviennent éditables
3. Modifier les valeurs souhaitées
4. Cliquer sur **Sauvegarder** (icône disquette)
5. Ou **Annuler** (icône X) pour revenir en arrière

#### Calculs automatiques

Lorsque vous modifiez le **salaire brut**, les champs suivants se mettent à jour automatiquement :

```
Cotisations patronales = Salaire brut × 45%
Cotisations salariales = Salaire brut × 24%
Salaire net = Salaire brut - Cotisations salariales + Primes + Heures supp.
```

**Exemple** :
```
Salaire brut : 4,200€
→ Cotisations patronales : 1,890€ (45%)
→ Cotisations salariales : 1,008€ (24%)
→ Salaire net : 3,192€ (76%)
```

---

### ➕ Ajouter un nouveau salaire

1. Cliquer sur le bouton **"Ajouter un salaire"** en haut du tableau
2. Remplir le formulaire :
   - **Employé** : Sélectionner dans la liste déroulante
   - **Mois** : Choisir la période (format AAAA-MM)
   - **Salaire brut** : Saisir le montant
   - **Primes** (optionnel) : Montant des primes exceptionnelles
   - **Heures supplémentaires** (optionnel) : Rémunération des heures supp.
3. Les cotisations se calculent en temps réel pendant la saisie
4. Cliquer sur **"Créer"**

**Résultat** :
- ✅ Toast de confirmation : "Salaire créé avec succès"
- Le tableau se met à jour avec la nouvelle ligne
- Une dépense est **automatiquement créée** dans le module Trésorerie

---

### 🗑️ Supprimer un salaire

1. Cliquer sur l'icône **Poubelle** à droite de la ligne
2. **Confirmation demandée** : "Êtes-vous sûr ?"
3. Cliquer sur **"Confirmer"**

**⚠️ Attention** :
- La suppression est **irréversible**
- La dépense associée dans Trésorerie sera également supprimée
- L'historique de l'employé sera affecté

**Cas d'usage** : Corriger une erreur de saisie (doublon, mauvais mois, etc.)

---

### 📄 Détail d'un salaire

1. **Cliquer sur une ligne** du tableau
2. Une **modal** s'ouvre avec les détails complets :

**Informations affichées** :
- Nom complet de l'employé
- Mois concerné
- Salaire brut
- Ventilation des cotisations :
  - Patronales : montant + pourcentage
  - Salariales : montant + pourcentage
- Primes (si applicable)
- Heures supplémentaires (si applicable)
- Salaire net final
- Date de création de l'enregistrement
- Dernière modification

**Actions disponibles** :
- Éditer directement depuis la modal
- Imprimer la fiche (bouton en haut à droite)
- Fermer (ESC ou bouton X)

---

## 🎯 Objectifs CA

L'onglet **Objectifs CA** permet de définir des objectifs de chiffre d'affaires trimestriels par employé.

### Utilité

- **Motivation commerciale** : Fixer des targets claires
- **Suivi de performance** : Comparer réalisé vs objectif
- **Primes au mérite** : Base de calcul pour les bonus

### Créer un objectif trimestriel

1. Cliquer sur **"Ajouter un objectif"**
2. Remplir le formulaire :
   - **Employé** : Sélectionner la personne concernée
   - **Année** : 2025
   - **Trimestre** : Q1, Q2, Q3 ou Q4
   - **Objectif CA** : Montant en euros (ex: 50,000€)
   - **CA réalisé** (optionnel) : Si déjà connu, sinon laisser vide
3. Cliquer sur **"Créer"**

**Exemple** :
```
Employé : Sophie Martin
Année : 2025
Trimestre : Q1
Objectif CA : 50,000€
CA réalisé : 45,000€
→ Taux d'atteinte : 90%
```

### Mise à jour du CA réalisé

**Méthode automatique** (recommandée) :
- Le CA réalisé se met à jour automatiquement depuis les recettes de trésorerie
- Filtré par établissement/client assigné à l'employé

**Méthode manuelle** :
1. Cliquer sur l'icône **Crayon** de l'objectif
2. Modifier le champ "CA réalisé"
3. Sauvegarder

### Interprétation des résultats

| Taux d'atteinte | Couleur | Signification |
|-----------------|---------|---------------|
| **≥ 100%** | 🟢 Vert | Objectif dépassé |
| **80-99%** | 🟠 Orange | Proche de l'objectif |
| **< 80%** | 🔴 Rouge | En retard sur l'objectif |

### Filtres

**Par année** : Sélectionner l'année fiscale (2023, 2024, 2025...)  
**Par trimestre** : Affiner par Q1, Q2, Q3, Q4  
**Par employé** : Voir les objectifs d'une seule personne

### Export

**Bouton "Exporter"** → Télécharge un fichier Excel avec :
- Tous les objectifs de la période sélectionnée
- Graphique de performance par employé
- Moyennes et totaux

---

## 📅 Planning des absences

L'onglet **Planning** affiche un calendrier interactif avec toutes les absences (congés, maladie, etc.).

### Vue calendrier

**Type de vue** : Mensuel (par défaut)  
**Navigation** : Flèches < > pour changer de mois  
**Aujourd'hui** : Surligné en bleu

### Types d'absence

| Type | Couleur | Description |
|------|---------|-------------|
| **Congés payés** | 🟢 Vert | Vacances planifiées |
| **Maladie** | 🔴 Rouge | Arrêt maladie |
| **RTT** | 🟣 Violet | Réduction du temps de travail |
| **Formation** | 🔵 Bleu | Formation professionnelle |
| **Absence non justifiée** | 🟠 Orange | Sans justificatif |

### Déclarer une nouvelle absence

1. Cliquer sur **"Ajouter une absence"** ou **double-cliquer sur une date** du calendrier
2. Remplir le formulaire :
   - **Employé** : Sélectionner la personne
   - **Date de début** : Premier jour d'absence (inclus)
   - **Date de fin** : Dernier jour d'absence (inclus)
   - **Type** : Choisir dans la liste déroulante
   - **Motif** (optionnel) : Raison de l'absence (texte libre)
3. Cliquer sur **"Enregistrer"**

**Exemple** :
```
Employé : Jean Dupont
Date début : 15/02/2025
Date fin : 17/02/2025
Type : Congés payés
Motif : Vacances d'hiver
→ Durée : 3 jours
```

**Résultat** :
- L'absence apparaît sur le calendrier avec la bonne couleur
- Le **taux d'absentéisme** se met à jour dans le dashboard
- Un email de notification est envoyé au manager (si activé)

### Modifier une absence

1. **Cliquer sur l'absence** dans le calendrier
2. Modal de détail s'ouvre
3. Cliquer sur **"Modifier"**
4. Changer les dates ou le type
5. Sauvegarder

### Supprimer une absence

1. Ouvrir la modal de détail
2. Cliquer sur **"Supprimer"**
3. Confirmer

**⚠️ Note** : La suppression est irréversible.

### Calcul du taux d'absentéisme

**Formule** :
```
Taux = (Nombre total de jours d'absence / (Effectif × 22 jours ouvrés)) × 100
```

**Exemple** :
```
4 employés × 22 jours = 88 jours ouvrés total
15 jours d'absence cumulés
→ Taux = (15 / 88) × 100 = 17%
```

### Export du planning

**Bouton "Exporter"** → Télécharge un fichier PDF ou iCal :
- **PDF** : Planning imprimable pour affichage
- **iCal** : Importable dans Outlook/Google Calendar

---

## 👤 Fiches employés

L'onglet **Fiches employés** affiche une vue consolidée de chaque personne.

### Sélection d'un employé

**Liste déroulante en haut** : Choisir parmi les employés actifs.

### Informations affichées

#### 1. Informations personnelles
- Photo de profil (si disponible)
- Nom complet
- Email professionnel
- Téléphone
- Poste occupé
- Date d'entrée dans l'entreprise
- Statut : Actif / Inactif

#### 2. Historique des salaires
**Tableau avec** :
- Mois
- Salaire brut
- Salaire net
- Évolution (↗️ ↘️)

**Graphique** : Évolution du salaire brut sur 12 mois.

#### 3. Objectifs CA
**Liste des objectifs** :
- Trimestre
- Objectif fixé
- CA réalisé
- Taux d'atteinte
- Tendance

#### 4. Historique des absences
**Tableau avec** :
- Période (du X au Y)
- Durée (en jours)
- Type
- Motif

**Total annuel** : Nombre de jours d'absence sur l'année.

#### 5. Documents attachés
**Liste des fichiers** :
- Contrat de travail
- Bulletins de paie
- Certificats de formation
- Autres documents

**Actions** :
- Télécharger
- Ajouter un nouveau document

### Imprimer la fiche

**Bouton "Imprimer"** en haut à droite → Génère un PDF complet.

**Contient** :
- Toutes les sections ci-dessus
- Mise en forme professionnelle
- Logo de l'entreprise

---

## 📤 Exports

L'onglet **Exports** permet de générer des fichiers pour la paie et la comptabilité.

### Export CSV

**Format** : Comma-Separated Values (compatible Excel)

**Contenu** :
- Employé
- Mois
- Salaire brut
- Salaire net
- Cotisations patronales
- Cotisations salariales
- Primes
- Heures supplémentaires

**Utilisation** :
1. Sélectionner le **mois** dans la liste déroulante
2. Cliquer sur **"Exporter CSV"**
3. Fichier téléchargé : `salaires_janvier_2025.csv`
4. Ouvrir avec Excel ou LibreOffice
5. Transmettre au comptable

**Astuce** : Le fichier utilise le point-virgule (`;`) comme séparateur pour compatibilité Excel français.

### Export Excel avancé

**Format** : .xlsx (Excel natif)

**Contient 2 feuilles** :
1. **Détail des salaires** : Même contenu que le CSV
2. **Récapitulatif mensuel** : Totaux et graphiques

**Feuille 2 - Récapitulatif** :
- Total masse salariale brute
- Total masse salariale nette
- Total cotisations patronales
- Total cotisations salariales
- Graphique en barres : Brut vs Net
- Répartition par employé (graphique circulaire)

**Utilisation** :
1. Cliquer sur **"Exporter Excel"**
2. Fichier téléchargé : `salaires_janvier_2025.xlsx`
3. Ouvrir avec Excel
4. Les formules et graphiques sont automatiquement calculés

### Export SEPA (virement bancaire)

**Format** : XML SEPA (ISO 20022)

**Contenu** :
- Références bancaires de chaque employé (IBAN, BIC)
- Montant net à virer
- Date de virement
- Libellé : "Salaire [Mois] [Année]"

**Utilisation** :
1. Cliquer sur **"Générer SEPA"**
2. Fichier téléchargé : `sepa_janvier_2025.xml`
3. Importer dans votre banque en ligne
4. Valider les virements en masse

**⚠️ Prérequis** : Les IBAN doivent être renseignés dans les fiches employés.

### Récapitulatif mensuel

**Widget en bas de page** affiche :
- **Nombre d'employés** payés ce mois
- **Masse salariale brute** totale
- **Masse salariale nette** totale
- **Total des cotisations** (patronales + salariales)

**Cohérence** : Vérifier que ces totaux correspondent aux exports.

---

## ⌨️ Raccourcis clavier

Gagnez du temps avec les raccourcis clavier intégrés !

### Navigation entre onglets

| Raccourci | Action |
|-----------|--------|
| **Alt + 1** | Vue d'ensemble |
| **Alt + 2** | Salaires |
| **Alt + 3** | Objectifs CA |
| **Alt + 4** | Planning |
| **Alt + 5** | Fiches employés |
| **Alt + 6** | Exports |

### Navigation séquentielle

| Raccourci | Action |
|-----------|--------|
| **Ctrl + Tab** | Onglet suivant |
| **Ctrl + Shift + Tab** | Onglet précédent |

### Actions rapides (à venir)

| Raccourci | Action |
|-----------|--------|
| **Ctrl + N** | Nouveau salaire |
| **Ctrl + E** | Éditer la ligne sélectionnée |
| **Ctrl + S** | Sauvegarder |
| **Esc** | Annuler / Fermer la modal |

**💡 Astuce** : Survoler le bouton **"Raccourcis"** en haut à droite pour afficher la liste complète.

---

## ❓ FAQ

### 1. Comment importer l'historique de salaires ?

**Réponse** : Utilisez le script Python fourni :
```bash
cd scripts
python3 import_excel_tresorerie.py
```

Ou saisissez manuellement via l'onglet **Salaires**.

**Guide détaillé** : Voir la section Import dans [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#phase-4--import-initial-des-données)

---

### 2. Les cotisations sont-elles calculées automatiquement ?

**Oui** ! Dès que vous saisissez le salaire brut, les cotisations se calculent :
- **Patronales** : 45% du brut
- **Salariales** : 24% du brut
- **Net** : Brut - Cotisations salariales + Primes

**Personnalisation** : Ces taux sont modifiables dans les paramètres (Admin uniquement).

---

### 3. Comment corriger une erreur de saisie ?

**Méthode 1** : Double-cliquer sur le champ et modifier.  
**Méthode 2** : Supprimer la ligne et la recréer.

**⚠️ Important** : Si vous modifiez un salaire déjà payé, la dépense dans Trésorerie sera aussi mise à jour.

---

### 4. Puis-je gérer les primes annuelles ?

**Oui** ! Deux options :
1. **Ajouter une prime au salaire mensuel** : Champ "Primes" dans le tableau
2. **Créer un 13ème mois** : Ajouter une ligne de salaire pour le mois de décembre avec le montant de la prime

**Astuce** : Pour un bonus de 1,000€ en décembre :
```
Salaire normal : 4,200€
+ Prime : 1,000€
= Salaire brut : 5,200€
```

---

### 5. Comment suivre les heures supplémentaires ?

**Champ dédié** : "Heures supp." dans le tableau des salaires.

**Calcul** :
1. Saisir le nombre d'heures × taux horaire
2. Ce montant s'ajoute au salaire net
3. Les cotisations sont recalculées sur le total

**Exemple** :
```
Salaire de base : 4,200€
+ 10h × 15€/h = 150€
= Salaire brut total : 4,350€
```

---

### 6. Le taux d'absentéisme semble élevé, que faire ?

**Étapes de diagnostic** :
1. Vérifier que toutes les absences sont justifiées
2. Supprimer les doublons éventuels
3. Analyser les types d'absence (maladie récurrente ?)
4. Comparer au benchmark national (≈ 5%)

**Actions correctives** :
- Entretien avec les employés concernés
- Amélioration des conditions de travail
- Programme de prévention santé

---

### 7. Comment gérer un départ d'employé ?

**Étapes** :
1. **Fiche employé** → Changer le statut à "Inactif"
2. **Dernière paie** : Ajouter le salaire du dernier mois + indemnités
3. **Solde de tout compte** : Utiliser le champ "Primes" pour les congés payés non pris
4. **Archivage** : Les données restent consultables mais l'employé n'apparaît plus dans les listes actives

**⚠️ Important** : Ne pas supprimer l'employé pour conserver l'historique.

---

### 8. La synchronisation RH ↔ Trésorerie a échoué

**Causes possibles** :
- Salaire créé manuellement dans Trésorerie (source différente)
- Problème de connexion réseau lors de la création
- Migration de données incomplète

**Solution** :
1. Onglet **Vue d'ensemble**
2. Widget **Réconciliation**
3. Cliquer sur **"Synchroniser maintenant"**
4. Si l'erreur persiste : Contacter l'administrateur

---

### 9. Puis-je modifier un salaire déjà payé ?

**Oui**, mais avec précautions :
1. Modifier la ligne dans l'onglet **Salaires**
2. La dépense dans Trésorerie sera mise à jour
3. Le solde de trésorerie sera recalculé
4. Un email de notification sera envoyé au comptable (si activé)

**⚠️ Cas particulier** : Si le virement a déjà été effectué, créer un **avoir** ou un **rattrapage** sur le mois suivant plutôt que de modifier l'historique.

---

### 10. Les raccourcis clavier ne fonctionnent pas

**Vérifications** :
1. Votre navigateur supporte-t-il les raccourcis ? (Chrome, Firefox, Edge : ✅ | Safari ancien : ❌)
2. Avez-vous un champ de saisie actif ? (ESC pour quitter le champ)
3. Extension tierce qui bloque les raccourcis ? (Désactiver temporairement)

**Test** : Survoler le bouton **"Raccourcis"** en haut à droite → Si la tooltip s'affiche, c'est que le système fonctionne.

---

## 📞 Support

**Besoin d'aide ?**

- 📧 **Email** : support@votre-entreprise.com
- 💬 **Chat** : Bouton en bas à droite de l'interface
- 📚 **Documentation technique** : `docs/RH_TECH_GUIDE.md`
- 🎥 **Vidéos tutorielles** : [lien vers plateforme vidéo]

**Heures de support** : Lundi-Vendredi, 9h-18h (heure de Paris)

---

## 📝 Changelog

### Version 1.0 (Janvier 2025)
- ✅ Lancement initial du module RH
- ✅ Gestion complète des salaires
- ✅ Objectifs CA trimestriels
- ✅ Planning des absences
- ✅ Exports CSV/Excel/SEPA
- ✅ Raccourcis clavier
- ✅ Synchronisation avec Trésorerie

### Version 1.1 (Prévue Février 2025)
- 🚧 Import de fichiers Excel pour les salaires
- 🚧 Calcul automatique des congés payés
- 🚧 Historique des modifications (audit trail)
- 🚧 Notifications par email configurables

---

**© 2025 - Votre Entreprise - Tous droits réservés**
