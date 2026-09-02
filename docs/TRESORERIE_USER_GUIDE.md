# Guide Utilisateur - Module Trésorerie

## Vue d'ensemble

Le module Trésorerie permet de gérer et prévoir les flux financiers de l'entreprise. Il inclut des fonctionnalités d'import Excel, de génération automatique des dépenses récurrentes, et d'analyse en temps réel.

## Navigation rapide

### Raccourcis clavier
- **Alt+1 à Alt+8** : Accès direct aux onglets
- **Ctrl+Tab** : Onglet suivant
- **Ctrl+Shift+Tab** : Onglet précédent

Survolez le bouton "Raccourcis" en haut à droite pour voir tous les raccourcis disponibles.

## Onglets principaux

### 1. Vue d'ensemble (Dashboard)
Tableau de bord avec indicateurs clés :
- **Solde actuel** : Position de trésorerie en temps réel
- **Prévisions** : Projections sur 3, 6 et 12 mois
- **Alertes** : Notifications des soldes négatifs prévus
- **Graphiques** : Évolution visuelle de la trésorerie

### 2. Tréso Jour
Consultation du solde bancaire actuel et des mouvements récents.

### 3. Recettes
Gestion des recettes mensuelles par établissement :
- **Montant prévu** : Calculé automatiquement selon les contrats
- **Montant facturé** : À saisir manuellement
- **Montant payé** : À saisir après réception du paiement
- **Statut** : Prévue, Facturée, Payée, En retard

**Actions disponibles** :
- Éditer les montants et dates
- Filtrer par établissement ou période
- Exporter vers Excel

### 4. Prévi Tréso
Tableau de prévisions de trésorerie :
- **Affichage mensuel** : Recettes, charges fixes, charges variables, solde
- **Catégories détaillées** : Salaires, loyers, télécoms, etc.
- **Ajustements** : Modifiez les prévisions directement dans le tableau
- **Export Excel** : Bouton en haut à droite

**Paramètres** :
- **Date de début** : Premier mois affiché
- **Nombre de mois** : 3, 6, 12, 18 ou 24 mois

### 5. Analyse
Graphiques et analyses approfondies :
- Évolution des recettes par établissement
- Répartition des charges par catégorie
- Tendances sur périodes personnalisées
- Comparaisons année/année

### 6. Banque
Historique des mouvements bancaires synchronisés.

### 7. Qonto
Configuration de l'intégration bancaire Qonto pour la synchronisation automatique des transactions.

### 8. Admin (Administrateurs uniquement)
Outils d'administration :
- **Import Excel** : Importer les données depuis un fichier Excel
- **Génération automatique** : Lancer les Edge Functions
  - Génération des recettes prévisionnelles
  - Génération des dépenses récurrentes
- **Validation des données** : Vérifier l'intégrité des données

## Import de données

### Préparer le fichier Excel

Votre fichier doit contenir 4 feuilles obligatoires :

#### 1. Feuille "Recettes"
| Colonne | Description | Exemple |
|---------|-------------|---------|
| etablissement_id | UUID de l'établissement | abc123... |
| mois | Format YYYY-MM-01 | 2025-01-01 |
| montant_prevu | Nombre | 5000 |
| montant_facture | Nombre (optionnel) | 5000 |
| montant_paye | Nombre (optionnel) | 5000 |
| date_paiement_prevue | Format YYYY-MM-DD | 2025-01-15 |
| statut | prevue/facturee/payee | prevue |

#### 2. Feuille "Categories"
| Colonne | Description | Exemple |
|---------|-------------|---------|
| nom | Nom de la catégorie | Salaires |
| type_flux | entree/sortie | sortie |
| est_recurrent | TRUE/FALSE | TRUE |
| ordre | Nombre pour tri | 1 |

#### 3. Feuille "Depenses"
| Colonne | Description | Exemple |
|---------|-------------|---------|
| categorie_id | UUID de la catégorie | def456... |
| mois | Format YYYY-MM-01 | 2025-01-01 |
| montant_prevu | Nombre | 50000 |
| montant_reel | Nombre (optionnel) | 48500 |
| description | Texte descriptif | Masse salariale janvier |

#### 4. Feuille "Depenses_Recurrentes"
| Colonne | Description | Exemple |
|---------|-------------|---------|
| categorie_id | UUID de la catégorie | ghi789... |
| nom | Nom descriptif | Loyer bureaux Paris |
| montant_mensuel | Nombre | 3500 |
| jour_prevu | Jour du mois (1-31) | 5 |
| date_debut | Format YYYY-MM-DD | 2024-01-01 |
| date_fin | Format YYYY-MM-DD (optionnel) | 2025-12-31 |
| est_actif | TRUE/FALSE | TRUE |

### Procédure d'import

1. **Aller dans l'onglet Admin**
2. **Cliquer sur "Import Excel"**
3. **Sélectionner votre fichier** (.xlsx ou .xls)
4. **Vérifier le résumé** affiché
5. **Confirmer l'import**

Le système vous indiquera :
- Nombre d'enregistrements importés par feuille
- Erreurs éventuelles à corriger

### Après l'import

1. **Vérifier les données** dans les onglets Recettes et Prévi Tréso
2. **Générer les dépenses récurrentes** :
   - Aller dans Admin → Génération automatique
   - Cliquer sur "Générer les dépenses récurrentes"
   - Choisir la période
3. **Générer les recettes prévisionnelles** si nécessaire

## Génération automatique

### Dépenses récurrentes
Génère automatiquement les dépenses mensuelles (loyers, abonnements, etc.) :
- **Période** : Choisir le nombre de mois à générer
- **Fréquence** : Une fois par mois recommandé
- **Vérification** : Les dépenses apparaissent dans Prévi Tréso

### Recettes prévisionnelles
Calcule automatiquement les recettes attendues par établissement :
- **Basé sur** : Statuts des établissements et dates de contrat
- **Mise à jour** : Après ajout/modification d'établissements
- **Visualisation** : Onglet Recettes

## Astuces et bonnes pratiques

### Mise à jour régulière
- **Quotidien** : Vérifier le Dashboard pour les alertes
- **Hebdomadaire** : Mettre à jour les recettes facturées et payées
- **Mensuel** : Ajuster les prévisions et générer les dépenses récurrentes

### Précision des données
- Saisir les dates de paiement réelles pour améliorer les prévisions
- Noter les retards de paiement pour un suivi optimal
- Comparer les montants réels aux prévisions régulièrement

### Export et archivage
- Exporter les données mensuellement pour archivage
- Utiliser l'export Excel pour les présentations
- Conserver les fichiers sources d'import

### Alertes
- Configurer des notifications pour les soldes négatifs
- Surveiller les recettes en retard
- Anticiper les gros mouvements de trésorerie

## Résolution de problèmes courants

### Les recettes ne s'affichent pas
✅ Vérifier que les établissements ont le statut "Production"
✅ Lancer la génération des recettes prévisionnelles
✅ Vérifier les dates de début de contrat

### Les dépenses récurrentes ne sont pas générées
✅ Vérifier que les dépenses récurrentes sont actives
✅ Vérifier que la période de génération est correcte
✅ Consulter les logs dans l'onglet Admin

### Incohérences dans les soldes
✅ Vérifier que toutes les catégories ont le bon type_flux
✅ S'assurer que les montants réels sont saisis correctement
✅ Exécuter la validation des données dans Admin

### Erreurs d'import Excel
✅ Vérifier que toutes les feuilles requises sont présentes
✅ Contrôler le format des dates (YYYY-MM-DD)
✅ S'assurer que les UUID correspondent aux données existantes
✅ Vérifier que les valeurs booléennes sont TRUE/FALSE

## Support

Pour toute question ou problème :
1. Consulter la documentation technique (TRESORERIE_TECH_GUIDE.md)
2. Vérifier les logs dans l'onglet Admin
3. Contacter l'équipe technique avec les détails de l'erreur

## Mises à jour

Ce guide est mis à jour régulièrement. Version actuelle : 1.9.0 (Mars 2026)
