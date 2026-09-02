# Synchronisation historique intelligente

## Problème résolu

Avant l'implémentation de la synchronisation historique intelligente, le système présentait plusieurs limitations :

- **Emails anciens non synchronisés** : Les emails de plus d'un an n'étaient pas synchronisés automatiquement
- **Inefficacité du full_resync** : Le mode `full_resync` retéléchargeait inutilement tous les emails, même ceux déjà en base
- **Appels IA redondants** : Les appels IA étaient relancés sur les emails existants, augmentant les coûts et le temps de traitement
- **Limites de synchronisation** : Pas de moyen efficace de récupérer l'historique complet sans impacter les performances

## Solution : Mode Historical Backfill

Le mode `historical_backfill` est une synchronisation intelligente qui :

1. **Cherche TOUS les emails** sur le serveur IMAP (sans limite de temps)
2. **Compare avec la base de données** : Récupère tous les UIDs déjà synchronisés
3. **Télécharge UNIQUEMENT les emails manquants** : Filtre les UIDs pour ne traiter que les nouveaux
4. **Déclenche l'IA uniquement sur les nouveaux threads** : Évite les analyses redondantes

### Avantages

✅ **Pas de doublons** : Filtre les UIDs déjà en base avant téléchargement  
✅ **Pas d'appels IA inutiles** : L'IA ne se déclenche que sur les nouveaux threads  
✅ **Performance optimale** : Ne télécharge que ce qui manque  
✅ **Historique complet** : Récupère TOUS les emails depuis l'origine  
✅ **Sécurisé** : Pas de risque de corruption ou de perte de données

## Architecture technique

### 1. Modification de `sync-emails/index.ts`

**Nouveau paramètre** :
```typescript
const { account_id, mode, full_resync = false, reconcile_only = false, historical_backfill = false } = await req.json();
```

**Logique de recherche des UIDs** (lignes 631-677) :
```typescript
if (historical_backfill) {
  // 1. Récupérer TOUS les UIDs du serveur
  const allUidsStr = await client.searchUids('ALL');
  const serverUids = allUidsStr.map(uid => parseInt(uid, 10)).sort((a, b) => a - b);
  
  // 2. Récupérer TOUS les UIDs déjà en base (sans limite de date)
  const { data: allDbMessages } = await supabase
    .from('email_messages')
    .select('imap_uid')
    .eq('user_email_account_id', account_id)
    .not('imap_uid', 'is', null);
  
  const dbUidsForBackfill = new Set(allDbMessages?.map(m => parseInt(m.imap_uid, 10)) || []);
  
  // 3. Ne garder QUE les UIDs manquants
  recentUids = serverUids.filter(uid => !dbUidsForBackfill.has(uid));
  
  console.log(`
📊 HISTORICAL BACKFILL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Server emails:    ${serverUids.length}
💾 Database emails:  ${dbUidsForBackfill.size}
📥 Missing emails:   ${recentUids.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}
```

**Filtrage des UIDs à synchroniser** (lignes 721-738) :
```typescript
if (historical_backfill) {
  // Les UIDs ont déjà été filtrés (UIDs manquants uniquement)
  uidsToSync = recentUids;
  console.log(`📥 Historical backfill: ${uidsToSync.length} missing emails to sync`);
} else {
  // Mode normal ou full_resync : filtrer par last_uid_synced
  const lastSynced = full_resync ? 0 : lastSyncedNum;
  uidsToSync = recentUids.filter(uid => uid > lastSynced);
}
```

### 2. Modification de `hourly-email-sync-and-analysis/index.ts`

**Accepter le paramètre** :
```typescript
const { mode = 'auto', historical_backfill = false } = await req.json();
```

**Propager le paramètre** à `sync-emails` :
```typescript
const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-emails', {
  body: { 
    account_id: account.id,
    historical_backfill: historical_backfill  // ✅ Propager le flag
  },
});
```

### 3. Interface utilisateur - `ManualSyncButton.tsx`

**Nouveau bouton** :
- Bouton violet distinctif avec icône `History`
- Confirmation avec avertissement détaillé
- Feedback de progression avec toast
- Affichage des statistiques après synchronisation

**Handler `handleHistoricalBackfill`** :
- Vérification des synchronisations concurrentes (soft lock)
- Appel à `hourly-email-sync-and-analysis` avec `historical_backfill: true`
- Gestion des erreurs et feedback utilisateur
- Mise à jour de l'état et affichage du résumé

## Utilisation

### Depuis l'interface utilisateur

1. **Aller dans la page Emails** → Cliquer sur l'icône de paramètres
2. **Cliquer sur "Sync historique complète"**
3. **Confirmer l'opération** dans la boîte de dialogue
4. **Attendre la fin** (5-15 minutes pour plusieurs milliers d'emails)
5. **Vérifier les statistiques** affichées après la synchronisation

### Depuis l'API

```typescript
const { data, error } = await supabase.functions.invoke(
  'hourly-email-sync-and-analysis',
  {
    body: {
      mode: 'manual',
      historical_backfill: true
    }
  }
);
```

## Comparaison des modes de synchronisation

| Mode | Fenêtre de recherche | Emails téléchargés | Appels IA | Utilisation |
|------|---------------------|-------------------|-----------|-------------|
| **Sync rapide** | Depuis la dernière synchronisation | Nouveaux emails uniquement | Sur nouveaux threads | Vérification quotidienne |
| **Sync complète** | Dernière année | Tous les emails de l'année | Sur nouveaux threads | Après interruption prolongée |
| **Sync historique** | Depuis l'origine | **Uniquement les manquants** | **Uniquement sur nouveaux threads** | Première synchronisation ou récupération d'historique |

## Tests et validation

### Test 1 : Vérifier le nombre d'emails manquants

1. Consulter les logs de la fonction edge lors de l'appel avec `historical_backfill: true`
2. Vérifier le message : `"📥 X missing emails to download"`
3. S'assurer que X correspond aux emails réellement manquants

### Test 2 : Vérifier qu'aucun email n'est retéléchargé

1. Lancer un historical backfill
2. Vérifier dans les logs qu'aucun email déjà en base n'est retéléchargé
3. Comparer le nombre d'emails avant/après dans la table `email_messages`

### Test 3 : Vérifier qu'aucun appel IA n'est relancé

1. Lancer un historical backfill
2. Vérifier dans les logs de `hourly-email-sync-and-analysis` le nombre d'appels IA
3. S'assurer qu'il correspond uniquement aux nouveaux threads créés

### Test 4 : Vérifier la cohérence finale

1. Après le backfill, compter les emails en base
2. Comparer avec le nombre sur le serveur IMAP (via logs)
3. Vérifier qu'ils correspondent

## Logs de diagnostic

Le mode `historical_backfill` génère des logs détaillés pour faciliter le diagnostic :

```
🔄 Historical backfill mode: searching ALL emails on server
Found 5234 total emails on IMAP server
Database has 266 emails already synced
📥 4968 missing emails to download

📊 HISTORICAL BACKFILL SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Server emails:    5234
💾 Database emails:  266
📥 Missing emails:   4968
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Monitoring et alertes

### Vérification de l'intégrité

Pour vérifier que tous les emails sont bien synchronisés :

```sql
-- Compter les emails en base par compte
SELECT 
  uea.email_address,
  COUNT(em.id) as total_emails,
  MAX(em.sent_date) as last_email_date,
  MIN(em.sent_date) as first_email_date
FROM user_email_accounts uea
LEFT JOIN email_messages em ON em.user_email_account_id = uea.id
WHERE uea.is_active = true
GROUP BY uea.id, uea.email_address;
```

### Indicateurs de santé

- **Dernier email synchronisé** : Vérifier que `MAX(sent_date)` est récent (< 24h)
- **Premier email synchronisé** : Vérifier que `MIN(sent_date)` correspond à l'historique attendu
- **Nombre total d'emails** : Comparer avec le nombre attendu sur le serveur IMAP

## Résolution de problèmes

### Problème : La synchronisation historique ne trouve aucun email manquant

**Cause** : Tous les emails sont déjà synchronisés  
**Solution** : Vérifier dans les logs que `Database emails` correspond bien au nombre total d'emails sur le serveur

### Problème : La synchronisation historique prend trop de temps

**Cause** : Trop d'emails à télécharger (> 10 000)  
**Solution** : La synchronisation s'effectue par lots. Attendre la fin ou relancer plusieurs fois jusqu'à ce que tous les emails soient récupérés

### Problème : Des appels IA sont relancés sur des threads existants

**Cause** : Bug dans la logique de détection des nouveaux threads  
**Solution** : Vérifier que `ai_last_processed_at` est bien mis à jour après chaque traitement IA

## Roadmap et améliorations futures

1. **Indicateur de progression en temps réel** : Afficher un compteur pendant la synchronisation
2. **Synchronisation par période** : Permettre de synchroniser uniquement une période spécifique (ex: 2020-2022)
3. **Mode "vérification d'intégrité"** : Comparer automatiquement le nombre d'emails en base avec le serveur IMAP
4. **Dashboard de diagnostic** : Page dédiée montrant l'état de synchronisation de chaque compte
5. **Alerte automatique** : Notification si des emails manquent après une synchronisation historique

## Conclusion

Le mode `historical_backfill` résout efficacement le problème de synchronisation d'historique complet tout en optimisant les performances et les coûts. Il offre une solution robuste et intelligente pour récupérer tous les emails manquants sans impacter les données existantes ni générer d'appels IA redondants.
