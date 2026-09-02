# API DPI — Intégration des enquêtes OpenPulse

Cette API permet à un DPI (Hôpital Manager, Résurgence, Mediboard…) d'afficher une pop-up d'enquête à ses utilisateurs en ouvrant un lien sécurisé OpenPulse.

## Endpoint

```
POST https://your-project-ref.functions.supabase.co/dpi-enquete-api
```

## Authentification

Header obligatoire :

```
X-API-Key: <clé fournie par OpenPulse>
```

La clé est scopée à un établissement. Elle est révocable à tout moment.

## Requête

```json
{
  "type": "ces",
  "etablissement_external_id": "EXT-12345",
  "user_email": "dr.martin@chu-exemple.example.org",
  "user_external_id": "U-9876"
}
```

| Champ | Type | Requis | Description |
|---|---|---|---|
| `type` | enum | oui | `post_formation` \| `ces` \| `satisfaction` \| `suivi_csm` |
| `etablissement_external_id` | string | non* | Identifiant de l'établissement côté DPI (mapping via `client_external_ids`). Inutile si la clé est déjà scopée à l'établissement. |
| `user_email` | string | non | Email de l'utilisateur, sert au pré-remplissage et au mapping. |
| `user_external_id` | string | non | Identifiant utilisateur côté DPI. |

## Réponse 200

```json
{
  "url": "https://gestion.exploitant.example.org/enquete/ces/abcd1234...",
  "token": "abcd1234...",
  "expires_at": "2026-07-22T10:00:00Z"
}
```

Le DPI ouvre ensuite `url` dans une pop-up / iframe / onglet.

## Codes d'erreur

| Code | Cause |
|---|---|
| 401 | Clé API manquante, invalide ou expirée |
| 400 | `type` inconnu ou établissement non identifié |
| 500 | Erreur serveur (réessayer) |

## Exemple cURL

```bash
curl -X POST https://your-project-ref.functions.supabase.co/dpi-enquete-api \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MARQUE_DPI_KEY" \
  -d '{"type":"ces","user_email":"dr.martin@chu.fr"}'
```

## Quand déclencher chaque enquête ?

| Enquête | Moment |
|---|---|
| `post_formation` | Juste après l'émargement formation (J+0) |
| `ces` | 3 semaines après la formation (J+21) |
| `satisfaction` | 2 mois après go-live, puis tous les 6 mois |
| `suivi_csm` | 2 fois par an (début mai, mi-novembre) |
