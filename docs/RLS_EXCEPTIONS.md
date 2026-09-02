# Documentation des Exceptions RLS Intentionnelles

> **Dernière mise à jour** : Mars 2026

## Vue d'Ensemble

Ce document recense les tables dont les politiques RLS (Row Level Security) sont intentionnellement permissives pour supporter des fonctionnalités publiques. Ces exceptions ne sont **pas** des vulnérabilités mais des choix architecturaux documentés.

---

## Tables avec RLS Publique

### 1. `bookings` - Réservations de RDV

**Raison** : Permet aux visiteurs anonymes de créer des réservations via les pages de booking publiques (Cal.com-like).

| Politique | Type | Condition |
|-----------|------|-----------|
| `bookings_insert_policy` | INSERT | `true` (permettre création anonyme) |
| `bookings_select_policy` | SELECT | `host_user_id = auth.uid() OR guest_email = utilisateur` |

**Mitigation** :
- Validation email obligatoire côté frontend
- Rate limiting sur l'Edge Function `create-booking`
- Confirmation par email requise

---

### 2. `booking_pages` - Pages de réservation publiques

**Raison** : Permet aux visiteurs anonymes de voir les pages de réservation et choisir un type de rendez-vous. Fonctionnalité similaire à Cal.com/Calendly.

| Politique | Type | Condition |
|-----------|------|-----------|
| `booking_pages_select` | SELECT | `true` (pages publiques lisibles par tous) |

**Mitigation** :
- Seules les informations de la page de booking sont exposées (titre, description, créneaux)
- Aucune donnée client sensible n'est stockée dans cette table
- Les données de réservation sensibles sont dans `bookings` avec des RLS strictes

---

### 3. `booking_availability_slots` - Créneaux de disponibilité

**Raison** : Permet aux visiteurs de voir les créneaux disponibles pour prendre rendez-vous.

| Politique | Type | Condition |
|-----------|------|-----------|
| `booking_availability_slots_select` | SELECT | `true` (créneaux lisibles par tous) |

**Mitigation** :
- Expose uniquement jour de la semaine, heure début/fin
- Pas de données personnelles identifiables
- Nécessaire pour le fonctionnement du système de réservation

---

### 4. `booking_exceptions` - Exceptions de disponibilité

**Raison** : Permet aux visiteurs de savoir quand un hôte n'est pas disponible (vacances, indisponibilités).

| Politique | Type | Condition |
|-----------|------|-----------|
| `booking_exceptions_select` | SELECT | `true` |

**Mitigation** :
- N'expose que la date et la raison optionnelle
- Nécessaire pour éviter les réservations sur des créneaux fermés

---

### 5. `booking_page_hosts` - Hôtes des pages de réservation

**Raison** : Permet de savoir quels collaborateurs sont disponibles pour les rendez-vous sur une page.

| Politique | Type | Condition |
|-----------|------|-----------|
| `booking_page_hosts_select` | SELECT | `true` |

**Mitigation** :
- N'expose que l'assignation hôte-page, pas de données personnelles

---

### 6. `booking_types` et `booking_page_types` - Types de rendez-vous

**Raison** : Permet aux visiteurs de choisir le type de rendez-vous souhaité.

| Politique | Type | Condition |
|-----------|------|-----------|
| `booking_types_select` | SELECT | `is_active = true` |
| `booking_page_types_select` | SELECT | `is_visible = true` |

**Mitigation** :
- Seuls les types actifs/visibles sont exposés
- Informations commerciales non sensibles (durée, nom du type)

---

### 7. `live_chat_sessions` - Sessions de chat widget

**Raison** : Permet aux visiteurs du site web d'initier des conversations de support sans authentification.

| Politique | Type | Condition |
|-----------|------|-----------|
| `live_chat_sessions_insert` | INSERT | `true` |
| `live_chat_sessions_select` | SELECT | `visitor_id = valeur fournie` |

**Mitigation** :
- `visitor_id` généré côté client (UUID unique par session navigateur)
- Données non sensibles (pas de PII collectées automatiquement)
- Sessions expirées après 24h d'inactivité

---

### 8. `live_chat_conversations` - Conversations de chat

**Raison** : Liées aux sessions, permettent aux visiteurs de voir leurs propres conversations.

| Politique | Type | Condition |
|-----------|------|-----------|
| `live_chat_conversations_insert` | INSERT | `visitor_id IS NOT NULL OR session_id IS NOT NULL` |
| `live_chat_conversations_select` | SELECT | Lié à `session_id` validé |

---

### 9. `live_chat_messages` - Messages du chat widget

**Raison** : Permet aux visiteurs d'envoyer et lire des messages dans leurs conversations.

| Politique | Type | Condition |
|-----------|------|-----------|
| `live_chat_messages_insert` | INSERT | `session_id` valide |
| `live_chat_messages_select` | SELECT | Lié à `session_id` validé |

**Mitigation** :
- Sanitization XSS via `SafeHtmlContent`
- Limite de taille des messages (5000 caractères)
- Rate limiting (10 messages/minute)

---

## Tables avec SELECT Permissif (Utilisateurs Authentifiés)

Ces tables permettent à tous les utilisateurs authentifiés de lire les données. C'est intentionnel pour les besoins métier internes.

### `catalogue_produits`
- **Raison** : Référentiel produits partagé pour devis/factures
- **Risque** : Aucun (données commerciales non sensibles)

### `contrats`
- **Raison** : Visibilité transversale des contrats pour coordination équipe
- **Risque** : Acceptable (utilisateurs internes uniquement)

---

## Tables Sécurisées (Non Publiques)

Les tables suivantes ont des RLS **strictes** et ne sont PAS des exceptions :

| Table | Restriction |
|-------|-------------|
| `avoirs` | Admins, créateur, ou assigné à l'établissement |
| `devis` | Admins, créateur, ou assigné à l'établissement |
| `profiles` | Propre profil, HR, ou Admin 2FA |
| `rh_salaires_mensuels` | HR ou employé concerné |
| `rh_documents_employes` | Via view `_safe`, signed URLs |
| `profiles_secrets` | Admin 2FA uniquement |
| `rgpd_*` | Admin 2FA uniquement |
| `candidates` | RH, Direction, Admin, ou assigné (depuis v2026.01.29) |
| `contacts` | Admin, Direction, ou assigné à l'établissement (depuis v2026.01.29) |
| `tresorerie_budgets` | Admin, Direction, RH, COPIL (depuis v2026.01.29) |

---

## Audit et Maintenance

### Vérification Régulière

```sql
-- Lister toutes les politiques SELECT permissives
SELECT schemaname, tablename, policyname, qual 
FROM pg_policies 
WHERE cmd = 'SELECT' AND qual::text = 'true';
```

### Processus de Revue

1. **Trimestriel** : Revue des politiques listées ici
2. **Lors d'ajout de table** : Documenter toute exception dans ce fichier
3. **Lors d'incident** : Vérifier si une exception est impliquée

---

## Références

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Memory: security/intentional-public-rls-exceptions](../.editeur/knowledge)
- [SECURITY.md](../SECURITY.md)

---

*Document maintenu par l'équipe OpenPulse*
