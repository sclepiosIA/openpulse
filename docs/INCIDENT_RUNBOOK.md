# 🚨 Runbook de Réponse aux Incidents

## OpenPulse - Procédures d'Urgence Production

> **Version** : 1.9.1 | **Vérifié le** : 2026-06-03 | **Prochaine revue** : 2026-09-03

---

## 📋 Table des Matières

1. [Niveaux de Sévérité](#niveaux-de-sévérité)
2. [Contacts d'Urgence](#contacts-durgence)
3. [Incidents Authentification](#incidents-authentification)
4. [Incidents Base de Données](#incidents-base-de-données)
5. [Incidents Edge Functions](#incidents-edge-functions)
6. [Incidents Email/IMAP](#incidents-emailimap)
7. [Incidents Performance](#incidents-performance)
8. [Incidents Sécurité](#incidents-sécurité)
9. [Post-Mortem Template](#post-mortem-template)

---

## Niveaux de Sévérité

| Niveau | Description | Temps de Réponse | Escalade |
|--------|-------------|------------------|----------|
| **P0 - Critique** | Service totalement indisponible | < 15 min | Immédiate |
| **P1 - Majeur** | Fonctionnalité critique dégradée | < 1h | 30 min |
| **P2 - Modéré** | Fonctionnalité secondaire impactée | < 4h | 2h |
| **P3 - Mineur** | Anomalie sans impact utilisateur | < 24h | 8h |

---

## Contacts d'Urgence

| Rôle | Contact | Disponibilité |
|------|---------|---------------|
| Directeur de publication / Lead Technique | Dr Andréï Durand — contact@exploitant.example.org | 24/7 pour P0/P1 |
| DPO / Sécurité | contact@exploitant.example.org (objet : `[SECURITE]`) | 24/7 pour incidents sécurité |
| Support Supabase | support@supabase.io · https://supabase.com/dashboard/support | Heures ouvrées |
| Support Microsoft Azure (France Central) | Portail Azure → Support + ticket | 24/7 (selon plan) |
| Sentry (monitoring) | https://sentry.io/organizations/marque-ia/ | Alertes auto |

> Pour toute escalade externe (CNIL, ANSSI, hébergeur), passer obligatoirement par le directeur de publication.

---

## Incidents Authentification

### Symptôme : Utilisateurs ne peuvent pas se connecter

**Diagnostic rapide :**
```sql
-- Vérifier les logs auth récents
SELECT timestamp, event_message, level 
FROM auth_logs 
ORDER BY timestamp DESC 
LIMIT 50;
```

**Actions immédiates :**

1. **Vérifier le statut Supabase**
   - Dashboard : https://supabase.com/dashboard/project/YOUR_PROJECT_REF
   - Status page : https://status.supabase.com

2. **Vérifier les tokens JWT**
   ```bash
   # Dans la console navigateur
   localStorage.getItem('sb-YOUR_PROJECT_REF-auth-token')
   ```

3. **Forcer la déconnexion globale (dernier recours)**
   ```sql
   -- Invalider toutes les sessions
   DELETE FROM auth.sessions WHERE created_at < NOW() - INTERVAL '1 hour';
   ```

**Rollback :**
- Revenir à la version précédente de l'AuthProvider si modification récente
- Vérifier les migrations RLS récentes

---

## Incidents Base de Données

### Symptôme : Requêtes lentes ou timeouts

**Diagnostic rapide :**
```sql
-- Requêtes actives longues
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND query_start < now() - interval '30 seconds';

-- Tables les plus volumineuses
SELECT relname, n_live_tup 
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC 
LIMIT 10;
```

**Actions immédiates :**

1. **Identifier les requêtes bloquantes**
   ```sql
   SELECT blocked_locks.pid AS blocked_pid,
          blocking_locks.pid AS blocking_pid,
          blocked_activity.query AS blocked_query
   FROM pg_locks blocked_locks
   JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
   JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
   JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
   WHERE NOT blocked_locks.granted;
   ```

2. **Terminer une requête bloquante**
   ```sql
   SELECT pg_terminate_backend(PID);
   ```

3. **Vérifier les index manquants**
   ```sql
   SELECT schemaname, tablename, indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public';
   ```

**Prévention :**
- Ajouter `.limit()` sur toutes les requêtes hooks (voir memory architecture)
- Utiliser les index sur les colonnes fréquemment filtrées

---

## Incidents Edge Functions

### Symptôme : Edge Function retourne 500 ou timeout

**Diagnostic rapide :**
```bash
# Via Supabase Dashboard
# Project > Functions > [function-name] > Logs
```

**Actions immédiates :**

1. **Vérifier les logs récents**
   - Dashboard : https://supabase.com/dashboard/project/YOUR_PROJECT_REF/functions

2. **Vérifier les secrets**
   - Settings > Edge Functions > Secrets
   - S'assurer que `AZURE_OPENAI_ENDPOINT` et `AZURE_OPENAI_API_KEY` sont définis

3. **Tester manuellement**
   ```bash
   curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/[function-name]' \
     -H 'Authorization: Bearer [ANON_KEY]' \
     -H 'Content-Type: application/json' \
     -d '{}'
   ```

4. **Redéployer la fonction**
   - Modifier légèrement le code et sauvegarder pour forcer un redéploiement

**Pattern obligatoire GPT-5 :**
```typescript
// Timeout 90s obligatoire
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 90000);

// Paramètres AU PREMIER NIVEAU (pas imbriqués)
{
  max_completion_tokens: 3000,
  reasoning_effort: "minimal",
  verbosity: "low"
}
```

---

## Incidents Email/IMAP

### Symptôme : Synchronisation emails échoue

**Diagnostic rapide :**
```sql
-- Comptes avec erreurs récentes
SELECT email, last_sync_at, last_sync_error, sync_enabled
FROM user_email_accounts
WHERE last_sync_error IS NOT NULL
ORDER BY last_sync_at DESC;
```

**Actions immédiates :**

1. **Vérifier la connectivité IMAP**
   - Host/port corrects dans `user_email_accounts`
   - Mot de passe valide (peut avoir expiré)

2. **Forcer une re-synchronisation**
   ```sql
   UPDATE user_email_accounts 
   SET last_sync_at = NULL, last_sync_error = NULL 
   WHERE id = '[account_id]';
   ```

3. **Vérifier les logs de la fonction**
   - Dashboard > Functions > `sync-emails` > Logs

4. **Débloquer un compte verrouillé**
   ```sql
   UPDATE user_email_accounts 
   SET sync_enabled = true, sync_in_progress = false 
   WHERE id = '[account_id]';
   ```

---

## Incidents Performance

### Symptôme : Application lente ou UI freeze

**Diagnostic rapide :**

1. **Vérifier les Core Web Vitals**
   - Chrome DevTools > Lighthouse
   - Cibles : LCP < 2.5s, FID < 100ms, CLS < 0.1

2. **Identifier les re-renders excessifs**
   - React DevTools > Profiler
   - Chercher les composants avec > 10 renders/interaction

**Actions immédiates :**

1. **Vider les caches Service Worker**
   ```javascript
   // Console navigateur
   caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
   navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
   ```

2. **Désactiver temporairement le SW**
   ```
   ?no-sw=1  // Ajouter à l'URL
   ```

3. **Vérifier les requêtes N+1**
   - Network tab > filtrer par `rest/v1`
   - Identifier les patterns de requêtes répétitives

**Prévention :**
- Utiliser `queryPresets.standard` pour React Query
- Ajouter `useMemo`/`useCallback` sur les calculs coûteux
- Implémenter la virtualisation pour les listes > 100 éléments

---

## Incidents Sécurité

### Symptôme : Accès non autorisé détecté

**Actions IMMÉDIATES (P0) :**

1. **Isoler le compte compromis**
   ```sql
   UPDATE auth.users SET banned_until = '2099-12-31' WHERE id = '[user_id]';
   ```

2. **Invalider toutes les sessions**
   ```sql
   DELETE FROM auth.sessions WHERE user_id = '[user_id]';
   ```

3. **Vérifier les logs d'accès**
   ```sql
   SELECT * FROM rgpd_audit_logs 
   WHERE user_id = '[user_id]' 
   ORDER BY created_at DESC 
   LIMIT 100;
   ```

4. **Bloquer l'IP source**
   ```sql
   INSERT INTO blocked_ips (ip_address, reason, blocked_by)
   VALUES ('[IP]', 'Accès non autorisé détecté', '[admin_id]');
   ```

**Post-incident :**
- Audit complet des actions du compte
- Notification RGPD si données personnelles exposées (< 72h)
- Mise à jour des credentials compromis

---

## Post-Mortem Template

```markdown
# Post-Mortem : [Titre de l'incident]

## Résumé
- **Date** : YYYY-MM-DD
- **Durée** : Xh Xmin
- **Sévérité** : P0/P1/P2/P3
- **Impact** : [Description de l'impact utilisateur]

## Timeline
| Heure | Événement |
|-------|-----------|
| HH:MM | Première alerte |
| HH:MM | Diagnostic identifié |
| HH:MM | Correction appliquée |
| HH:MM | Service restauré |

## Cause Racine
[Description technique de la cause]

## Résolution
[Actions prises pour résoudre]

## Actions Préventives
- [ ] Action 1
- [ ] Action 2
- [ ] Action 3

## Leçons Apprises
[Ce qui a bien fonctionné, ce qui peut être amélioré]
```

---

## Checklist de Réponse Rapide

### Avant d'agir
- [ ] Identifier le niveau de sévérité
- [ ] Documenter l'heure de début
- [ ] Créer un canal de communication (Slack/Discord)
- [ ] Assigner un incident commander

### Pendant l'incident
- [ ] Communiquer régulièrement (toutes les 15 min pour P0)
- [ ] Documenter toutes les actions prises
- [ ] Ne pas faire de changements non documentés
- [ ] Prioriser la restauration du service

### Après l'incident
- [ ] Confirmer la résolution complète
- [ ] Notifier les utilisateurs impactés
- [ ] Planifier le post-mortem (< 48h)
- [ ] Créer les tickets d'actions préventives

---

*Document maintenu par l'équipe technique OpenPulse*
