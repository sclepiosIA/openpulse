# ✅ CHECKLIST DE VALIDATION FINALE

## Données en base
- [ ] `rh_salaires_mensuels` : ≥12 enregistrements
- [ ] `tresorerie_recettes_mensuelles` : ≥180 enregistrements
- [ ] `tresorerie_depenses` : ≥50 enregistrements
- [ ] `tresorerie_solde` : ≥1 enregistrement pour le mois courant

## Fonctionnalités RH
- [ ] Affichage des KPIs RH
- [ ] CRUD salaires fonctionne
- [ ] Calcul automatique cotisations
- [ ] Exports CSV/Excel
- [ ] Synchronisation RH → Trésorerie

## Fonctionnalités Trésorerie
- [ ] Affichage des KPIs trésorerie
- [ ] CRUD dépenses/recettes
- [ ] Prévisions sur 12 mois
- [ ] Graphiques d'évolution
- [ ] Edge Functions opérationnelles

## Performance
- [ ] Chargement dashboard < 2s
- [ ] Édition inline < 500ms
- [ ] Pas de chargement infini
- [ ] Pas d'erreurs console

## Sécurité
- [ ] RLS policies testées
- [ ] Seuls les admins accèdent à l'onglet Admin
- [ ] Logs d'erreur ne contiennent pas de données sensibles

## Tests fonctionnels détaillés

### Page RH

#### Onglet "Vue d'ensemble"
- [ ] Les 4 KPI cards affichent des valeurs (pas de 0)
- [ ] "Effectif actif" ≥ 4
- [ ] "Masse salariale" > 10,000€
- [ ] Widget Trésorerie affiche un solde
- [ ] Widget Réconciliation = "Synchronisé ✅"
- [ ] **Pas d'erreur dans la console**

#### Onglet "Salaires"
- [ ] Le tableau affiche 4+ lignes (salaires du mois)
- [ ] Clic sur "Éditer" → modification inline fonctionne
- [ ] Modification d'un salaire brut → recalcul automatique du net
- [ ] Sauvegarde → toast "Salaire mis à jour avec succès"
- [ ] Sélection d'un autre mois → affiche les salaires de ce mois

#### Onglet "Objectifs CA"
- [ ] Formulaire de création visible
- [ ] Création d'un objectif pour Q1 2025 → succès
- [ ] Tableau se met à jour avec le nouvel objectif
- [ ] Modification du CA réalisé → taux d'atteinte recalculé

#### Onglet "Planning"
- [ ] Calendrier s'affiche (même vide)
- [ ] Création d'une absence → apparaît dans le planning
- [ ] Filtre par type d'absence fonctionne

#### Onglet "Fiches employés"
- [ ] Liste déroulante affiche 4+ employés
- [ ] Sélection d'un employé → fiche complète affichée
- [ ] Historique des salaires visible
- [ ] Graphique d'évolution (si données sur plusieurs mois)

#### Onglet "Exports"
- [ ] Sélection du mois fonctionne
- [ ] "Exporter CSV" → télécharge un fichier
- [ ] Le CSV contient les colonnes attendues
- [ ] Récapitulatif affiche les totaux corrects

### Page Trésorerie

#### Onglet "Vue d'ensemble"
- [ ] 4 KPI cards avec valeurs réelles
- [ ] "Solde actuel" > 0 (ex: 50,000€)
- [ ] "Solde projeté" calculé
- [ ] Graphique "Évolution solde" affiche une courbe
- [ ] Top 5 dépenses affiche 5 lignes
- [ ] **Pas de chargement infini**

#### Onglet "Tréso Jour"
- [ ] Liste des dépenses 30 prochains jours
- [ ] Filtres par statut fonctionnent
- [ ] Ajout d'une dépense manuelle → apparaît dans la liste
- [ ] Changement de statut "En attente" → "Payé" fonctionne
- [ ] Total des dépenses affiché en bas

#### Onglet "Recettes"
- [ ] Timeline affiche les recettes par mois
- [ ] 180+ recettes affichées (pagination)
- [ ] Clic sur une recette → ouvre le détail
- [ ] Marquage "Payé" met à jour le solde
- [ ] Filtres par établissement fonctionnent

#### Onglet "Prévi Tréso"
- [ ] Tableau Excel-style avec ≥3 mois
- [ ] Chaque mois affiche : recettes, dépenses, solde
- [ ] Solde cumule correctement mois après mois
- [ ] Édition inline d'une prévision fonctionne
- [ ] Bouton "Charger 12 mois" affiche plus de données
- [ ] **Pas de duplicate key errors**

#### Onglet "Analyse"
- [ ] Graphique barres recettes vs dépenses
- [ ] Données cohérentes avec dashboard
- [ ] Filtres par période fonctionnent

#### Onglet "Banque"
- [ ] Import CSV fonctionne
- [ ] Template téléchargeable
- [ ] Opérations importées s'affichent

#### Onglet "Qonto"
- [ ] Affiche "Non connecté" (normal si pas de token)
- [ ] Bouton "Se connecter" présent
- [ ] Instructions claires affichées

#### Onglet "Admin"
- [ ] 2 boutons visibles (si admin)
- [ ] Stats affichent les bons nombres
- [ ] Bouton "Actualiser" recharge les stats

## Critères de succès

✅ **Validation réussie si :**
- Toutes les checkboxes "Données en base" sont cochées
- Au moins 90% des tests fonctionnels passent
- Aucune erreur critique en console
- Performance acceptable (< 3s de chargement)
- Solde de trésorerie **POSITIF**
