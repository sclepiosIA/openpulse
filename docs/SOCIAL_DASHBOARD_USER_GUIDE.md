# Guide utilisateur — Social Dashboard

Module dédié aux équipes **Commercial** et **Marketing/Communication** pour piloter les réseaux sociaux des 4 marques OpenPulse.

## Marques pilotées

| Marque | Réseaux |
|---|---|
| OpenPulse | LinkedIn |
| Produit B | Facebook, LinkedIn, TikTok |
| OpenPulse Mobile | Facebook, Instagram, LinkedIn |
| L'Urgentiste Masqué | Instagram, Facebook, (TikTok option) |

## Accès

| Page | Route | Qui peut accéder |
|---|---|---|
| Cockpit | `/social` | commercial, marketing, direction, admin, copil |
| Composer | `/social/composer` | marketing, direction, admin |
| Calendrier éditorial | `/social/calendrier` | marketing, direction, admin |
| Inbox commentaires | `/social/inbox` | commercial, marketing, direction, admin |
| Paramètres connexions | `/parametres/social` | direction, admin |

Le commercial dispose d'un accès **lecture/proposition**, la publication est réservée marketing/direction/admin.

## Connecter un compte (direction/admin)

1. Aller dans `/parametres/social`
2. Choisir une marque puis cliquer **Connecter** sur la plateforme voulue (Facebook, Instagram, LinkedIn, TikTok)
3. S'authentifier sur la plateforme et autoriser OpenPulse
4. Le compte apparaît dans la liste avec statut `connected`. En cas de souci : bouton **Reconnecter**

Les jetons sont stockés chiffrés côté serveur, jamais accessibles au navigateur.

## Cockpit `/social`

- **Sélecteur de marque** (toutes / une marque) en haut
- **KPI Grid** : followers, engagement, reach par plateforme
- **Timeline des derniers posts** toutes plateformes
- Bouton **Synchroniser maintenant** pour forcer une remontée

Synchronisation auto :
- `social-sync-hot` toutes les 2 min (posts + commentaires récents)
- `social-sync-cold` toutes les 30 min (followers, insights)

## Publier un post `/social/composer`

1. Choisir la marque
2. Sélectionner les comptes cibles (un ou plusieurs)
3. Rédiger le contenu, ajouter une URL média si besoin
4. **Publier maintenant** OU **Planifier** (date/heure)

Limites par plateforme appliquées automatiquement (lues depuis `app_config → social.platform_limits`).

## Calendrier éditorial `/social/calendrier`

- Liste filtrable par marque et statut : `scheduled`, `processing`, `published`, `failed`
- Suppression d'un post planifié
- Badge couleur par marque

Le scheduler tourne chaque minute. Un post marqué `failed` affiche l'erreur retournée par la plateforme.

## Inbox commentaires `/social/inbox`

- Filtres par marque et statut (À traiter / Tous)
- Réponse inline aux commentaires Facebook/Instagram
- Masquage d'un commentaire FB
- Marquage manuel "Traité" / "Non traité"

## Alertes santé

CRON `social-health-alerts` quotidien (8h15) :
- Connexions en erreur OAuth
- Syncs échoués dans les 24h
- Posts planifiés en échec dans les 24h

→ Notification interne aux admins et direction avec lien `/parametres/social`.

## Sécurité

- Tokens jamais exposés côté frontend (table `social_connection_secrets` accessible service_role uniquement)
- RLS strictes par rôle sur toutes les tables
- Webhooks Meta/TikTok vérifiés par HMAC
- L'Urgentiste Masqué : aucune info identifiante exposée au-delà du libellé "marque"

## Activation initiale (admin Supabase)

Les CRON doivent être planifiés une fois dans le SQL Editor (contenu user-spécifique, hors migrations) :

```sql
SELECT cron.schedule('social-scheduler', '* * * * *', $$
  SELECT net.http_post(
    url:='https://your-project-ref.supabase.co/functions/v1/social-scheduler',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'));
$$);

SELECT cron.schedule('social-refresh-tokens', '0 3 * * *', $$
  SELECT net.http_post(
    url:='https://your-project-ref.supabase.co/functions/v1/social-refresh-tokens',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'));
$$);

SELECT cron.schedule('social-health-alerts-daily', '15 8 * * *', $$
  SELECT net.http_post(
    url:='https://your-project-ref.supabase.co/functions/v1/social-health-alerts',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'));
$$);
```
