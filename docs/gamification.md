# Gamification commerciale (P10)

Module de gamification basé sur points, badges et leaderboard pour la
direction et les commerciaux.

## Portée

- Route : `/gamification`
- Accès : `direction`, `admin`
- Livré : ✅ (cf. `docs/MODULES.md` table principale)

## Composants front

- Pages : `src/pages/Gamification.tsx`
- Widgets dashboard : `MyGamificationWidget`, `MiniLeaderboardWidget`
- Realtime UI : `BadgeUnlockToast` (confetti tier-coloré au déblocage)

## Backend

### Tables

- `gamification_points` — points cumulés par profil (catégorie, période)
- `gamification_badges` — catalogue des badges (nom, tier, critères JSON)
- `gamification_user_badges` — déblocages utilisateur (profile_id, badge_id, unlocked_at)

Toutes en RLS : lecture par le propriétaire + direction/admin via `has_role`.

### RPC

- `get_leaderboard(p_period text, p_limit int)` — classement points (direction-only)
- `get_user_gamification(p_profile_id uuid)` — fiche perso (owner ou direction)
- `compute_gamification_points(p_profile_id uuid)` — recalcul points d'un profil
- `unlock_badges(p_profile_id uuid)` — évalue critères + insère déblocages

### Edge function & cron

- `recompute-gamification` — recalcul global (points + badges)
- Cron `recompute-gamification-hourly` — déclenché à HH:15 chaque heure,
  parcourt les profils actifs et appelle les 2 RPC ci-dessus.

## Sources de points

Le scoring s'appuie sur les évènements métier déjà persistés (tâches
terminées, prospects gagnés, contrats signés, NPS, etc.). Les coefficients
vivent dans la table `app_config` clé `gamification.coefficients` pour
permettre l'ajustement sans déploiement.

## Mémoire associée

Pas de fichier mémoire dédié — ce document fait foi. Voir `mem://index.md`
section Features pour le rattachement P10.
