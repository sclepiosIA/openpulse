# Classification des Données — OpenPulse

> Document de conformité RGPD et sécurité pour la base de données Supabase.

---

## Données personnelles (RGPD)

| Table | Type de données | Sensibilité | RLS | Notes |
|-------|----------------|-------------|-----|-------|
| `profiles` | Nom, prénom, email, avatar, téléphone | 🔴 Haute | SELECT: rôle-based, UPDATE: own profile | Liée à `auth.users` |
| `profiles_secrets` | Secrets 2FA (TOTP) | 🔴 Critique | Accès admin 2FA uniquement | Chiffré |
| `salaires` | Données salariales | 🔴 Critique | Admin/RH + 2FA obligatoire, audité | |
| `rh_absences` | Absences, congés | 🟠 Haute | Admin/RH/propre utilisateur | |
| `candidates` | CV, évaluations RH | 🟠 Haute | Rôle-based (admin, rh) | |
| `candidate_evaluations` | Notes d'entretien | 🟠 Haute | Rôle-based | |
| `contacts` | Contacts établissements (nom, email, tel) | 🟡 Moyenne | Rôle-based par établissement | B2B |
| `user_email_accounts` | Credentials email (chiffrés) | 🔴 Critique | RLS strict, mots de passe chiffrés AES | |
| `push_subscriptions` | Tokens push notification | 🟡 Moyenne | Own user only | |

## Données financières

| Table | Type de données | Sensibilité | RLS |
|-------|----------------|-------------|-----|
| `factures` | Factures clients | 🟠 Haute | Rôle-based |
| `devis` | Devis commerciaux | 🟠 Haute | Rôle-based |
| `contrats` | Contrats signés | 🟠 Haute | Rôle-based |
| `avoirs` | Avoirs et remboursements | 🟠 Haute | Rôle-based |
| `revenus` | Revenus enregistrés | 🟠 Haute | Rôle-based |
| `depenses` | Dépenses opérationnelles | 🟠 Haute | Rôle-based |
| `qonto_transactions` | Transactions bancaires Qonto | 🔴 Critique | Admin uniquement |
| `ca_forecasts` | Prévisions CA | 🟡 Moyenne | Rôle-based |

## Données métier CRM

| Table | Type de données | Sensibilité | RLS |
|-------|----------------|-------------|-----|
| `etablissements` | Hôpitaux, cliniques | 🟡 Moyenne | Rôle + assignation |
| `taches` | Tâches CRM | 🟡 Moyenne | Rôle + établissement |
| `email_threads` | Conversations email | 🟠 Haute | Compte email autorisé |
| `email_messages` | Messages email | 🟠 Haute | Compte email autorisé |
| `support_tickets` | Tickets support | 🟡 Moyenne | Authenticated |

## Données IA / Analytics

| Table | Type de données | Sensibilité | RLS |
|-------|----------------|-------------|-----|
| `ai_processing_log` | Logs traitement IA (tokens, coûts) | 🟡 Moyenne | Authenticated |
| `ai_analysis_log` | Analyses IA | 🟡 Moyenne | Authenticated |
| `ai_suggested_actions` | Suggestions IA | 🟡 Moyenne | Authenticated |
| `jarvis_conversations` | Conversations Jarvis | 🟡 Moyenne | Own user |
| `churn_predictions` | Prédictions de churn | 🟡 Moyenne | Via RPC uniquement |
| `proactive_alerts` | Alertes proactives | 🟡 Moyenne | Via RPC uniquement |

## Configuration et référence

| Table | Type de données | Sensibilité | RLS |
|-------|----------------|-------------|-----|
| `app_config` | Configuration applicative | 🟢 Faible | Authenticated (lecture) |
| `reference_data` | Données de référence | 🟢 Faible | Authenticated (lecture) |
| `system_config` | Configuration système | 🟡 Moyenne | Admin uniquement |
| `kb_result_metrics` | Métriques commerciales gouvernées | 🟢 Faible | Authenticated (published) / Admin (all) |
| `ai_agents_config` | Config agents Jarvis | 🟢 Faible | Authenticated (active) / Admin (all) |
| `ai_tools_config` | Config outils Jarvis | 🟢 Faible | Authenticated (active) / Admin (all) |

## Sécurité

| Table | Type de données | Sensibilité | RLS |
|-------|----------------|-------------|-----|
| `api_keys` | Clés API (hash uniquement) | 🔴 Critique | Admin uniquement |
| `api_logs` | Logs API | 🟡 Moyenne | Admin uniquement |
| `user_roles` | Rôles utilisateurs | 🔴 Critique | Via `has_role()` SECURITY DEFINER |
| `authorized_ips` | IPs autorisées | 🟠 Haute | Admin uniquement |
| `blocked_ips` | IPs bloquées | 🟠 Haute | Admin uniquement |
| `audit_logs` | Logs d'audit | 🟠 Haute | Admin 2FA uniquement |

---

## Principes de protection

1. **RLS activé** sur toutes les tables sans exception
2. **Fonctions SECURITY DEFINER** pour les vérifications de rôle (évite récursion RLS)
3. **Chiffrement** des credentials email (AES via `EMAIL_ENCRYPTION_KEY`)
4. **2FA obligatoire** pour accès aux données salariales et suppressions critiques
5. **Audit trail** sur les modifications d'établissements sensibles
6. **Sanitisation** des erreurs dans les Edge Functions (`error-sanitizer.ts`)
7. **Pas de `select('*')`** en production — sélections explicites de colonnes
8. **Chiffres commerciaux** gouvernés via `kb_result_metrics` (source, validité, publication)
