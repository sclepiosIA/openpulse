# ADR-20260723 — Appairage Gestion Drive Desktop avec MFA fraîche

- **Statut** : accepté, non déployé
- **Date** : 2026-07-23
- **Périmètre** : Gestion web, API Gestion Drive, Gestion Drive Desktop 0.1.11
- **Décideur** : OpenPulse

## Contexte

Le premier candidat échangeait un bearer Gestion AAL2 contre un JWT Drive court et, lorsque le client ajoutait `X-OpenPulse-Desktop-Handoff: 1`, contre un refresh Drive opaque de 30 jours. La PWA validait bien l’origine Tauri, `window.source` et un nonce avant de transmettre la session au shell natif.

Cette frontière navigateur protégeait la livraison des secrets, mais le header n’était pas une preuve serveur du contexte Tauri. Un détenteur d’un bearer AAL2 encore valide pouvait appeler directement l’API et prolonger une compromission temporaire en session Drive persistante.

Un nonce choisi par le client, CORS, `Origin` ou une clé partagée embarquée dans une application publique ne corrigent pas ce risque : ils sont reproductibles par un appelant qui contrôle son client.

## Décision

L’émission initiale d’un refresh Drive exige désormais une **nouvelle preuve TOTP après un challenge serveur** :

1. Tauri génère un nonce aléatoire et adresse la demande uniquement à l’iframe Gestion attendue.
2. La PWA valide origine, fenêtre source, schéma et nonce avant tout appel d’échange.
3. L’API valide le bearer auprès de Supabase, crée un challenge opaque à usage unique et ne persiste que les hashes du challenge et du nonce.
4. Le shell affiche une demande explicite de code TOTP.
5. La PWA appelle `supabase.auth.mfa.challengeAndVerify` ; le code TOTP et le refresh provider restent dans la frontière web Supabase et ne sont jamais transmis à Tauri ou à l’API Drive.
6. La PWA reprend l’échange avec le nouveau bearer AAL2, le même nonce et le challenge opaque.
7. L’API vérifie que le claim Supabase `amr` contient une preuve `totp` récente et appartenant à une seconde strictement postérieure à la création du challenge. En cas de désynchronisation d’horloge, l’appairage échoue sans émission de refresh.
8. PostgreSQL consomme atomiquement le challenge, révoque l’ancienne famille Desktop et crée la nouvelle famille refresh. Un challenge rejoué, expiré, lié à un autre utilisateur ou à un autre nonce est refusé.
9. Les refresh suivants restent opaques, hachés, rotatifs et protégés par détection de rejeu/révocation de famille.

Le nonce reste une **corrélation de livraison**, pas une attestation de binaire. La preuve d’autorisation serveur est la nouvelle MFA utilisateur liée temporellement au challenge.

## Choix de protection des refresh publics

RFC 9700 impose aux clients publics soit un refresh sender-constrained, soit la rotation. Le candidat conserve la rotation atomique avec révocation de famille au rejeu. Une liaison DPoP à une clé d’appareil peut être ajoutée ultérieurement pour réduire encore l’impact d’un vol du refresh, mais elle n’est pas requise pour fermer l’élévation silencieuse d’un ancien bearer : la MFA fraîche est la gate d’appairage.

## Conséquences

### Positives

- un bearer AAL2 ancien ou volé ne suffit plus à obtenir 30 jours de persistance ;
- aucune confiance n’est placée dans un header, CORS ou un secret embarqué ;
- aucune donnée TOTP, bearer provider ou refresh provider n’est stockée dans Drive ;
- l’utilisateur approuve explicitement le premier appairage et chaque réappairage après révocation ;
- une session native persistante existante n’est plus remplacée périodiquement par la PWA.

### Contraintes

- le premier appairage nécessite une interaction TOTP, même si la session web est déjà AAL2 ;
- le challenge expire après cinq minutes ;
- l’application 0.1.10 reste incompatible et reçoit `410` sur le login password legacy ;
- API, web et Desktop 0.1.11 doivent être promus comme un même lot protocolaire.

### Risque résiduel explicite

Un bearer capturé immédiatement après la nouvelle preuve MFA reste un bearer jusqu’à son expiration. La fenêtre d’échange est limitée par la fraîcheur `amr`, le challenge à usage unique, une seule famille active par utilisateur et la rotation. DPoP/mTLS ou une attestation matérielle seraient nécessaires pour prouver cryptographiquement un appareil particulier ; ce n’est pas simulé dans ce lot.

## Schéma et observabilité

La migration `0004_desktop_handoff_challenges.sql` ajoute une table dédiée contenant uniquement : hash du challenge, utilisateur, hash du nonce, dates de création/expiration/consommation. Aucun secret brut n’est journalisé.

`/readyz`, le runner de migrations et les contrats CI exigent cette table et la migration versionnée avant toute promotion.

## Gates

- challenge obligatoire avant émission du refresh ;
- `amr.totp` ancien, absent, futur ou situé dans la seconde du challenge refusé ;
- nonce/challenge croisés ou rejoués refusés ;
- consommation et création du refresh atomiques sur PostgreSQL ;
- deux appairages concurrents : un seul peut aboutir ;
- bearer/TOTP provider absents des réponses, logs, tables et IPC Tauri ;
- session native existante préservée sans réappairage périodique.

## Références

- Supabase — JWT claims (`aal`, `amr`, timestamp) : https://supabase.com/docs/guides/auth/jwt-fields
- Supabase — MFA : https://supabase.com/docs/guides/auth/auth-mfa
- RFC 8693 — OAuth 2.0 Token Exchange, notamment refresh offline : https://www.rfc-editor.org/rfc/rfc8693.html
- RFC 9700 — OAuth 2.0 Security BCP, rotation ou sender constraint des refresh publics : https://www.rfc-editor.org/rfc/rfc9700.html
- RFC 9449 — DPoP : https://www.rfc-editor.org/rfc/rfc9449.html
