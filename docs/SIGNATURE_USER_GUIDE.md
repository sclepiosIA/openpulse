# ✍️ Guide utilisateur — Signature électronique

## À quoi ça sert
Envoyer un contrat à signer électroniquement (DocuSeal) et suivre son statut sans quitter l'outil.

## Accès
Depuis une fiche **Contrat** → bouton **« Envoyer à signer »**.

## Workflow
1. Le contrat (PDF généré) part automatiquement aux signataires renseignés.
2. Chaque signataire reçoit un email avec un lien sécurisé.
3. Le statut évolue : `envoyé` → `vu` → `signé` (ou `refusé`).
4. **Relances automatiques** à J+3 si pas signé.
5. Une fois 100% signé, le PDF final + hash SHA-256 sont archivés dans Storage.

## Suivre l'état
Onglet **Signature** de la fiche contrat : timeline visuelle des événements (envoi, ouverture, signature).

## Sécurité
- Webhook signé HMAC pour valider chaque événement DocuSeal.
- Hash SHA-256 du PDF stocké en base : preuve d'intégrité.
- Archivage permanent dans le bucket `contracts-signed`.

## En cas de problème
Si un signataire dit ne pas avoir reçu l'email : bouton **« Renvoyer »** dans la timeline.
