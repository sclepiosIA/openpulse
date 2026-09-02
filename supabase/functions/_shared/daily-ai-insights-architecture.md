# 🏗️ Architecture des Insights IA Quotidiens

## Vue d'ensemble

Système d'analyse IA automatique qui génère 4 types d'insights tous les matins à 9h :
- 📈 **Tendances** : Évolution des métriques clés et patterns émergents
- 🚨 **Alertes** : Situations nécessitant une attention immédiate
- 💡 **Recommandations** : Actions suggérées pour optimiser les performances
- 🔍 **Anomalies** : Déviations inhabituelles par rapport aux normes

## Flux de données

### 1. Cron quotidien (9h UTC)
```
daily-ai-insights-analysis (edge function)
  ↓
Pour chaque utilisateur actif
  ↓
4 analyses en parallèle (trends, alerts, recommendations, anomalies)
  ↓
Appel à analyze-rapports-insights pour chaque type
```

### 2. Sauvegarde en base de données
```
analyze-rapports-insights
  ↓
Génération via Azure GPT-5
  ↓
INSERT INTO ai_analysis_log
  ↓
insights_data (JSONB) stocke les insights complets
```

### 3. Récupération frontend
```
useAIInsights hook
  ↓
SELECT insights_data FROM ai_analysis_log
WHERE user_id = X AND analysis_type = 'trends'
ORDER BY created_at DESC LIMIT 1
  ↓
Affichage instantané (pas de régénération)
```

### 4. Actualisation manuelle
```
Bouton "Actualiser"
  ↓
Appel direct analyze-rapports-insights
  ↓
Sauvegarde en DB
  ↓
Rechargement UI
```

## Table `ai_analysis_log`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Utilisateur concerné |
| `analysis_type` | TEXT | 'trends' \| 'alerts' \| 'recommendations' \| 'anomalies' |
| `insights_data` | **JSONB** | **Contenu complet des insights** |
| `has_insights` | BOOLEAN | Succès de l'analyse (true si insights > 0) |
| `insights_count` | INTEGER | Nombre d'insights générés |
| `filters` | JSONB | Filtres appliqués lors de l'analyse |
| `created_at` | TIMESTAMPTZ | Date de l'analyse |

### Structure de `insights_data`

```json
{
  "trends": [
    {
      "title": "string",
      "description": "string",
      "impact": "positive" | "negative" | "neutral",
      "metric": "string",
      "value": "string"
    }
  ],
  "alerts": [
    {
      "title": "string",
      "description": "string",
      "severity": "high" | "medium" | "low",
      "etablissement": "string"
    }
  ],
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "high" | "medium" | "low",
      "action": "string"
    }
  ],
  "anomalies": [
    {
      "title": "string",
      "description": "string",
      "type": "string",
      "deviation": "string"
    }
  ]
}
```

## Avantages de cette architecture

### ✅ Performance
- **Pas de régénération inutile** : Les insights sont récupérés depuis la DB, pas régénérés via GPT-5
- **Affichage instantané** : Temps de chargement < 100ms au lieu de 10-30s
- **Cache efficace** : `staleTime: 1h` car les données changent seulement à 9h

### ✅ Coûts optimisés
- **Génération unique par jour** : 1 analyse par type par utilisateur (vs. N fois par jour actuellement)
- **Économie de crédits Azure GPT-5** : ~80% de réduction des appels API
- **Prédictibilité** : Coûts fixes quotidiens

### ✅ Expérience utilisateur
- **Pas de rate limit frustrant** : Les insights sont toujours disponibles
- **Actualisation manuelle possible** : Si besoin urgent entre 2 analyses automatiques
- **Historique complet** : Toutes les analyses passées sont conservées

### ✅ Fiabilité
- **Analyse en arrière-plan** : Pas d'impact sur les performances frontend
- **Gestion d'erreurs robuste** : Les échecs n'affectent pas l'UI
- **Retry automatique** : Le cron réessaie le lendemain si échec

## Cron schedule

```toml
schedule = "0 9 * * *"
```

**Signification** : Tous les jours à 9h00 UTC (10h en hiver, 11h en été en France)

## Edge functions impliquées

### `daily-ai-insights-analysis` (nouveau)
- **Rôle** : Orchestrateur du cron quotidien
- **Déclenchement** : Automatique via cron à 9h
- **Authentification** : `verify_jwt = false` (service role)
- **Fonctionnement** :
  1. Récupère tous les utilisateurs actifs
  2. Pour chaque utilisateur, lance 4 analyses en parallèle
  3. Retourne un rapport d'exécution

### `analyze-rapports-insights` (modifié)
- **Rôle** : Génération des insights via Azure GPT-5
- **Déclenchement** : Appelé par le cron OU manuellement par l'utilisateur
- **Authentification** : `verify_jwt = true` (sauf si appelé par service role)
- **Nouveauté** : Sauvegarde les insights complets dans `insights_data`

## Monitoring et logs

### Logs Supabase Edge Functions
```bash
# Vérifier les exécutions du cron
supabase functions logs daily-ai-insights-analysis

# Vérifier les analyses individuelles
supabase functions logs analyze-rapports-insights
```

### Métriques à surveiller
- Nombre d'utilisateurs analysés par jour
- Taux de succès/échec par type d'analyse
- Durée d'exécution totale du cron
- Consommation de tokens Azure GPT-5

## Migration depuis l'ancien système

### Avant
```
Frontend → analyze-rapports-insights → GPT-5 → Réponse JSON
  ↓
Affichage direct (pas de sauvegarde)
  ↓
Rate limit 24h frustrant
```

### Après
```
Cron 9h → daily-ai-insights-analysis → analyze-rapports-insights → GPT-5
  ↓
Sauvegarde dans ai_analysis_log.insights_data
  ↓
Frontend → SELECT insights_data → Affichage instantané
  ↓
Actualisation manuelle possible si besoin
```

## Sécurité et permissions

### RLS (Row Level Security)
- Les utilisateurs ne voient que **leurs propres insights**
- Les admins peuvent voir tous les insights (fonction `is_admin()`)
- Le cron utilise le **service role** pour contourner RLS

### Rate limiting
- **Cron** : Pause de 2s entre chaque utilisateur (évite les rate limits Azure)
- **Manuel** : Rate limit 24h maintenu si analyse réussie existe
- **Échec** : Pas de rate limit (permet de réessayer immédiatement)

## Déploiement

### Étapes
1. ✅ Appliquer la migration SQL (`insights_data` column)
2. ✅ Déployer `daily-ai-insights-analysis` edge function
3. ✅ Modifier `analyze-rapports-insights` (sauvegarde insights)
4. ✅ Configurer le cron dans `config.toml`
5. ✅ Mettre à jour `useAIInsights` hook (récupération DB)
6. ✅ Mettre à jour composant UI `RapportsAIInsights`

### Rollback
Si problème, il suffit de :
1. Désactiver le cron dans `config.toml`
2. Revenir à l'ancienne version de `useAIInsights` (régénération à la demande)
3. Les données `insights_data` restent en base (pas de perte)

## Tests recommandés

### Test du cron
```bash
# Déclencher manuellement le cron
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/daily-ai-insights-analysis \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Test de l'affichage
1. Ouvrir l'interface Rapports
2. Vérifier que les insights s'affichent instantanément
3. Vérifier la date "Analysé le XX/XX à XX:XX"
4. Cliquer sur "Actualiser" et vérifier le comportement

### Test du rate limit
1. Actualiser manuellement
2. Vérifier le message "Analyse déjà effectuée"
3. Attendre 24h ou le lendemain 9h
4. Vérifier que l'actualisation fonctionne à nouveau

## Support et dépannage

### Problème : Le cron ne s'exécute pas
- Vérifier les logs : `supabase functions logs daily-ai-insights-analysis`
- Vérifier la config : `supabase/config.toml` ligne cron
- Vérifier que l'edge function est bien déployée

### Problème : Insights vides
- Vérifier `ai_analysis_log.insights_data IS NOT NULL`
- Vérifier les logs de `analyze-rapports-insights`
- Vérifier les crédits Azure GPT-5

### Problème : Affichage "Aucune analyse disponible"
- Normal si première utilisation (attendre 9h le lendemain)
- Sinon, cliquer sur "Lancer l'analyse maintenant"
- Vérifier que l'utilisateur a bien des établissements associés
