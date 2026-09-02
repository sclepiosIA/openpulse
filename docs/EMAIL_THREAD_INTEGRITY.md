# Intégrité des Threads Email

## Vue d'ensemble

Le système de gestion des threads email maintient automatiquement l'intégrité des compteurs et des dates pour garantir une expérience utilisateur fiable.

## Architecture

### Compteurs de threads

Chaque thread email (`email_threads`) maintient deux compteurs critiques :
- **`message_count`** : Nombre total de messages dans le thread
- **`unread_count`** : Nombre de messages non lus
- **`last_message_date`** : Date du message le plus récent

Ces compteurs doivent toujours être synchronisés avec les données réelles dans `email_messages`.

## Mécanismes de protection

### 1. Insertion transactionnelle (sync-emails)

La logique de synchronisation a été corrigée pour garantir la cohérence :

```typescript
// ✅ CORRECT : Insérer le message AVANT de mettre à jour les compteurs
const { data: message, error: insertError } = await supabase
  .from('email_messages')
  .insert({...});

if (insertError) {
  // Pas de mise à jour des compteurs si l'insertion échoue
  continue;
}

// ✅ Mettre à jour les compteurs SEULEMENT après succès
await supabase
  .from('email_threads')
  .update({
    message_count: currentCount + 1,
    unread_count: currentUnread + 1,
    last_message_date: messageDate
  })
  .eq('id', threadId);
```

**Avantages** :
- Pas d'incrémentation si l'insertion échoue
- Cohérence garantie entre messages et compteurs
- Pas de threads orphelins avec `message_count > 0` mais aucun message

### 2. Fonction de correction automatique

Une edge function `fix-thread-counters` s'exécute quotidiennement pour :

#### Recalcul des compteurs
- Compare `message_count` avec le nombre réel de messages
- Recalcule `last_message_date` basé sur le message le plus récent
- Met à jour automatiquement les valeurs incorrectes

#### Nettoyage des threads orphelins
- Détecte les threads sans aucun message
- Supprime ceux créés il y a plus de 7 jours
- Conserve les threads récents pour permettre la synchronisation

#### Logs détaillés
```json
{
  "summary": {
    "total_threads": 2531,
    "threads_fixed": 12,
    "threads_deleted": 8,
    "threads_ok": 2511
  },
  "fixedThreads": [
    {
      "thread_id": "uuid",
      "old_message_count": 5,
      "new_message_count": 3,
      "old_last_date": "2025-11-15T10:00:00Z",
      "new_last_date": "2025-11-15T12:30:00Z"
    }
  ]
}
```

### 3. Monitoring automatique

Un workflow GitHub Actions (`.github/workflows/daily-thread-check.yml`) :
- S'exécute chaque jour à 2h UTC
- Appelle `fix-thread-counters`
- Crée une issue GitHub en cas d'échec
- Log les résultats dans les actions

## Utilisation manuelle

### Déclencher une vérification immédiate

Via l'interface Supabase :
```sql
-- Vérifier les incohérences
SELECT 
  et.id,
  et.message_count as recorded,
  COUNT(em.id) as actual,
  et.last_message_date as recorded_date,
  MAX(em.sent_date) as actual_date
FROM email_threads et
LEFT JOIN email_messages em ON em.thread_id = et.id
GROUP BY et.id, et.message_count, et.last_message_date
HAVING et.message_count != COUNT(em.id)
   OR et.last_message_date != MAX(em.sent_date);
```

Via cURL :
```bash
curl -X POST "$SUPABASE_URL/functions/v1/fix-thread-counters" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

### Interpréter les résultats

- **threads_fixed** : Threads avec compteurs corrigés
- **threads_deleted** : Threads orphelins supprimés (>7 jours sans messages)
- **threads_ok** : Threads déjà cohérents

## Cas d'usage

### Problème : Threads vides dans l'interface

**Symptôme** : Un thread s'affiche dans la liste mais ne montre aucun message au clic.

**Cause** : `message_count > 0` mais aucun message réel dans `email_messages`.

**Solution** :
1. Le workflow quotidien corrige automatiquement
2. OU déclencher manuellement `fix-thread-counters`
3. Le thread sera soit corrigé, soit supprimé si trop ancien

### Problème : Messages manquants

**Symptôme** : Un email reçu il y a 2 jours n'apparaît pas dans le thread.

**Causes possibles** :
1. Échec d'insertion pendant la synchronisation (non lié aux compteurs)
2. Thread marqué comme supprimé (`is_deleted = true`)
3. Message classé dans un autre thread (mauvais `thread_id`)

**Solution** :
1. Vérifier les logs de `sync-emails` pour des erreurs d'insertion
2. Lancer une synchronisation complète (bouton "Sync complète")
3. Si le problème persiste, vérifier manuellement :
```sql
SELECT * FROM email_messages 
WHERE from_address = 'lemoine@example.com'
  AND sent_date > NOW() - INTERVAL '3 days'
ORDER BY sent_date DESC;
```

## Métriques de santé

### Indicateurs à surveiller

```sql
-- Threads avec incohérences
SELECT COUNT(*) as mismatched_threads
FROM (
  SELECT et.id
  FROM email_threads et
  LEFT JOIN email_messages em ON em.thread_id = et.id
  GROUP BY et.id, et.message_count
  HAVING et.message_count != COUNT(em.id)
) t;
-- Objectif : 0

-- Threads orphelins (créés il y a >7 jours)
SELECT COUNT(*) as old_orphans
FROM email_threads et
WHERE NOT EXISTS (
  SELECT 1 FROM email_messages WHERE thread_id = et.id
)
AND created_at < NOW() - INTERVAL '7 days';
-- Objectif : 0

-- Threads récents orphelins (normale pendant la sync)
SELECT COUNT(*) as recent_orphans
FROM email_threads et
WHERE NOT EXISTS (
  SELECT 1 FROM email_messages WHERE thread_id = et.id
)
AND created_at >= NOW() - INTERVAL '7 days';
-- Acceptable : <50
```

## Fréquence de maintenance

| Action | Fréquence | Automatique |
|--------|-----------|-------------|
| Vérification intégrité | Quotidienne (2h UTC) | ✅ Oui |
| Correction compteurs | Quotidienne (2h UTC) | ✅ Oui |
| Suppression orphelins | Quotidienne (2h UTC) | ✅ Oui |
| Audit manuel | Mensuel | ❌ Non |

## Limitations connues

1. **Threads créés mais jamais synchronisés** : Conservés 7 jours avant suppression automatique
2. **Correction manuelle** : Nécessite les permissions service_role
3. **Performance** : Le scan de tous les threads prend ~5-10 minutes pour 10k threads

## Évolutions futures

- [ ] Fonction PostgreSQL `check_thread_integrity()` pour vérifications SQL rapides
- [ ] Trigger PostgreSQL pour empêcher l'incrémentation sans insertion
- [ ] Dashboard Supabase pour visualiser les métriques
- [ ] Alertes Slack/email en cas de dérive >1%
