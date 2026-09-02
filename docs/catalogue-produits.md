# Catalogue produits & services

Module de référentiel central pour les produits, services, licences, formations et maintenances vendus par OpenPulse. Utilisé par les modules **Devis**, **Factures** et **Contrats**.

## Route & accès

- **Page** : `/catalogue-produits`
- **Sidebar** : section *Direction* → *Catalogue produits* (icône `Package`)
- **Accès** : équipes `direction` et `commercial` (RouteGuard)

## Modèle de données

Table `public.catalogue_produits`.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | uuid | Clé primaire |
| `code` | text | Code unique (ex `LIC-001`) |
| `nom` | text | Nom commercial |
| `description` | text | Description détaillée |
| `type` | enum | `service` / `produit` / `licence` / `formation` / `maintenance` |
| `categorie` | text | Regroupement libre (ex *Infrastructure*) |
| `recurrence` | enum | `none` / `monthly` / `quarterly` / `yearly` |
| `prix_unitaire_ht` | numeric | Prix de référence HT |
| `prix_min_ht`, `prix_max_ht` | numeric | Bornes de négociation |
| `remise_max_pct` | numeric | Remise maximale autorisée |
| `taux_tva` | numeric | Taux TVA en % |
| `unite` | text | Unité (`unité`, `heure`, `mois`, `session`…) |
| `notes_internes` | text | Notes commerciales internes |
| `ordre_affichage` | int | Ordre dans les listes |
| `est_actif` | bool | Visible dans les sélecteurs |

### RLS

- **Lecture** : tous les utilisateurs authentifiés.
- **Insert / Update** : `admin`, `direction`, `commercial`.
- **Delete** : `admin`, `direction` uniquement.

### RPC `get_catalogue_stats()`

Retourne pour chaque produit :
- `nb_devis`, `nb_factures` : nombre d'utilisations
- `ca_cumule_ht` : chiffre d'affaires cumulé (devis + factures)
- `derniere_utilisation` : date la plus récente

Utilisé par le hook `useCatalogueStats()`.

## Composants & hooks

| Élément | Rôle |
|---------|------|
| `useCatalogueProduits` | CRUD complet + duplicate/archive/reorder |
| `useCatalogueStats` | RPC stats utilisations (Map<id, stat>) |
| `useProduitImport` | Import/export CSV |
| `<ProduitSelector>` | Combobox autocomplete (debounce 300 ms) — réutilisable dans devis/factures/contrats |
| `<CatalogueProduitForm>` | Dialog create/edit (flex-col, ScrollArea) |
| `<CatalogueImportDialog>` | Import CSV avec preview + validation |
| `<CatalogueProduitTable>` | Vue desktop |
| `<CatalogueProduitCard>` | Vue mobile |

## Format CSV

```csv
code,nom,description,type,categorie,prix_unitaire_ht,taux_tva,unite,est_actif
LIC-001,Licence OpenPulse,Licence annuelle,licence,Logiciel,5000,20,unité,true
FOR-001,Formation initiale,Session 1 jour,formation,Conseil,1500,20,session,true
```

Types valides : `service`, `produit`, `licence`, `formation`, `maintenance`.

## Branchement existant

- **Devis** (`DevisFormDialog`) et **Factures** (`FactureFormDialog`) : un `<ProduitSelector>` au-dessus du champ désignation pré-remplit nom + montant HT depuis le catalogue. Saisie libre toujours possible.
- **Contrats** : possibilité de lier des produits inclus.
- **Stats** : la RPC `get_catalogue_stats` agrège les utilisations devis + factures par produit.
- **Réordonnancement** : drag & drop disponible en vue table desktop quand aucun filtre ni recherche n'est actif (sinon l'ordre serait incohérent). Persistance via `reorderProduits` qui met à jour `ordre_affichage`.

## Sécurité

- Clés étrangères `produit_id` sur les tables `devis_lignes` / `factures_lignes` (sans cascade) : empêchent la suppression d'un produit utilisé.
- Recommandation côté UI : utiliser **Archiver** plutôt que **Supprimer** pour préserver l'historique.
