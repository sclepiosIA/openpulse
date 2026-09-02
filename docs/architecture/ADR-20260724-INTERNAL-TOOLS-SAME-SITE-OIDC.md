# ADR-20260724 — Outils internes Gestion en iframe via origine same-site et OIDC natif

- **Statut :** proposé, activation live suspendue
- **Périmètre :** Gestion Web Azure, Gestion Drive Desktop, Gitea, Penpot, Authentik
- **Décisionnaire :** OpenPulse

## Contexte

Gestion Drive charge Gestion Web dans une WebView Tauri. Gestion Web charge ensuite les outils internes. Avec le domaine Azure ou `gestion.exploitant.example.org` comme parent et les outils sous `*.openpulse.example.org`, Gitea/Penpot restent cross-site avec Gestion.

`nip.io` n’est pas une frontière de site inscrite dans la Public Suffix List : utiliser ses sous-domaines comme périmètre same-site ferait aussi confiance aux sous-domaines `nip.io` contrôlés par des tiers. Les hôtes `nip.io` existants restent donc des alias de transition, jamais les origines canoniques autorisées par le runtime iframe.

Le modèle historique qui place une signature, un grant ou un lien de session dans l’URL n’est pas acceptable pour Gitea/Penpot. Une CSP parent permissive ne constitue pas non plus une authentification.

## Décision

1. Le shell Desktop utilise comme origine Gestion canonique `https://espace.exploitant.example.org`.
2. Les origines canoniques sont `https://forge.exploitant.example.org` pour Gitea, `https://design.exploitant.example.org` pour Penpot et `https://sso.exploitant.example.org` pour Authentik. Caddy les reverse-proxy vers les services Azure ; les hôtes historiques `nip.io` restent seulement des alias externes de transition.
3. Gestion, Gitea et Penpot utilisent leurs flux OAuth/OIDC Authentik natifs. Aucun mot de passe, cookie, token, signature ou grant n’est transmis par le frontend Gestion.
4. Gitea démarre son flux via `/user/oauth2/authentik`.
5. Penpot démarre son flux par un bootstrap local qui effectue `POST /api/auth/oidc?provider=oidc`, valide strictement l’origine de redirection Authentik puis remplace la navigation de l’iframe.
6. L’intégration reste fail-closed. Une iframe n’est exposée que si toutes les conditions suivantes sont vraies :
   - flag build `VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED=true` ;
   - URL HTTPS canonique ;
   - `embed=true` ;
   - `ssoMode=authentik-oidc` ;
   - `readiness=verified` ;
   - origine parent Gestion same-site autorisée ;
   - URL de lancement exacte attendue.
7. Gitea et Penpot restent réservés aux administrateurs dans ce lot. La navigation et le viewer appliquent cette règle, mais la frontière d’autorisation est la policy d’application Authentik : une policy groupe/rôle administrateur doit être liée à chaque provider avant `readiness=verified`.
8. Les CSP emploient uniquement des origines exactes. Tous les ancêtres de la chaîne imbriquée, y compris les origines Tauri, doivent être autorisés par les enfants.
9. Tant que la recette live n’est pas complète, l’état reste `pending`/`blocked` avec fallback externe explicite ; aucune configuration ne doit annoncer `verified`.

## Alternatives rejetées

- jeton, signature, magic link ou recovery link dans l’URL ;
- injection de cookie ou de credential depuis le navigateur Gestion ;
- `postMessage('*')` ou redistribution d’un token de session ;
- CSP large (`https:`, wildcard d’origines) comme substitut au SSO ;
- iframe cross-site reposant sur des cookies `SameSite=Lax` ;
- activation frontend sans preuve des headers, cookies et callbacks live.

## Gates d’activation

L’activation live exige simultanément :

1. enregistrements DNS contrôlés pour `espace`, `forge`, `design` et `sso.exploitant.example.org` vers l’entrée Azure attendue ;
2. TLS valide sur les quatre origines canoniques ;
3. provider Gestion configuré dans Authentik/GoTrue, policies administrateur Authentik liées à Gitea/Penpot et session Gestion obtenue par SSO ;
4. URLs publiques/callbacks Gitea, Penpot et Authentik migrées vers les origines canoniques ;
5. `frame-src` Gestion déployé pour Gitea, Penpot et Authentik ;
6. `frame-ancestors` déployé côté Gitea/Penpot/Authentik pour Gestion et Tauri ;
7. premier login, rechargement, logout/révocation et WebSocket testés dans Gestion Web puis dans le paquet Desktop ;
8. `tool_urls` activé avec les URL canoniques et `readiness=verified` seulement après ces preuves ;
9. provenance SHA/image/déploiement et registre Gestion réconciliés.

## Retour arrière

- remettre `VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED=false` ;
- replacer `readiness` à `blocked` ou `pending` ;
- conserver les liens externes sûrs ;
- retirer le proxy `espace` uniquement après retour du Desktop vers l’ancienne origine ;
- ne jamais supprimer les configurations précédentes sans archive et manifeste.

## Conséquences

Cette décision ajoute un proxy et une configuration OIDC Gestion, mais évite un BFF de distribution de secrets et réutilise les sessions natives des produits. Elle ne garantit rien tant que la campagne live n’a pas validé les comportements réels de WebKit, Authentik, Gitea et Penpot.
