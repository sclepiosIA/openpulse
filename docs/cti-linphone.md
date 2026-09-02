# CTI / Téléphonie SIP — Architecture OpenPulse

> Module Click-to-call et journal d'appels intégré, basé sur **JsSIP** (open source MIT) + WebRTC. Aucun coût d'usage côté OpenPulse — chaque utilisateur connecte son propre trunk SIP.

## Choix technique : JsSIP vs Linphone SDK

Le plan initial visait `linphone-sdk-js`. À l'implémentation, ce SDK n'a pas de package npm officiellement publié et stable. **JsSIP** (MIT, 4 k★, maintenu par OnSIP) couvre tous les besoins :

- Pile SIP/SDP complète + WebRTC media
- DTMF, mute, transfert, registrations, multi-account
- Codecs négociés par le navigateur (Opus, G.711)
- ICE/STUN intégré (TURN configurable)

L'architecture du module est isolée derrière le hook `useSipClient` : un éventuel pivot vers Linphone SDK (si publication d'une release npm) ou un autre moteur ne nécessiterait que de remplacer ce fichier.

## Stack

| Couche | Technologie | Coût |
|--------|-------------|------|
| Signalisation SIP + WebRTC | `jssip` (npm) | 0 € |
| Trunk SIP (numéro, terminaison) | OVH Telecom / Keyyo / Voxbone / Asterisk perso | ~1 €/mois + 0,01 €/min FR |
| STUN | Google STUN public | 0 € |
| Stockage enregistrements | Supabase Storage (bucket privé) | inclus |

## Architecture

```
Frontend
├─ contexts/CallContext.tsx       — état global (open/close + target)
├─ hooks/useSipClient.ts          — wrapper JsSIP (lazy import)
├─ hooks/useCalls.ts              — accès journal + storage signed URLs
├─ components/cti/
│   ├─ CallButton.tsx             — bouton "Appeler" partout
│   ├─ CallWidget.tsx             — softphone flottant global desktop
│   ├─ CallHistoryTab.tsx         — historique par entité
│   ├─ CallRecordingPlayer.tsx    — lecteur audio inline (signed URL 5 min)
│   └─ SipSettingsForm.tsx        — config trunk SIP utilisateur
└─ pages/Appels.tsx               — journal global + KPIs + filtres

Backend (Edge Functions)
├─ sip-credentials                — RPC get_sip_credentials sécurisé
├─ call-log                       — événements start/answer/end/fail
└─ call-recording-upload          — multipart vers bucket privé

Database
├─ calls                          — journal appels (RLS user-scoped + admin/direction/CSM)
├─ user_phone_settings            — credentials chiffrés (réutilise EMAIL_ENCRYPTION_KEY)
├─ get_sip_credentials()          — RPC SECURITY DEFINER — déchiffrement
├─ set_sip_credentials(...)       — RPC SECURITY DEFINER — chiffrement
└─ purge_old_call_recordings()    — cron quotidien, purge > 90 jours
```

## Points d'intégration UI

| Endroit | Composant | Comportement |
|---------|-----------|--------------|
| `App.tsx` (provider global) | `CallProvider` + `<CallWidget />` lazy | Widget flottant desktop, monté à côté de `PulseFloatingChat` |
| Sidebar (section Communication) | Entrée "Appels" (icône Phone) | Visible direction/commercial/csm/technique |
| Route `/appels` | `pages/Appels.tsx` | Journal global filtrable + KPIs (total, aboutis, durée moyenne, taux de réponse) |
| Fiche établissement → onglet "Communication > Appels" | `CallHistoryTab etablissementId` | Historique scoped + lecteur audio inline |
| `EtablissementInfo` (champ Téléphone) | `CallButton iconOnly` | Lance un appel via le softphone |
| `EtablissementContacts` (table desktop + cards mobile) | `CallButton` + dropdown "Appeler" | Remplace tous les anciens `tel:` |
| `/parametres` (onglet général) | `SipSettingsForm` | Configuration trunk SIP + bouton suppression RGPD |


## Flux d'un appel sortant

1. Clic sur `<CallButton phoneNumber="..." />` dans une fiche établissement / contact / prospect.
2. `CallContext.startCall(target)` → ouverture du `CallWidget`.
3. `useSipClient.connect()` → fetch `sip-credentials` (TTL court) → JsSIP UA → register WSS.
4. `call-log {action: 'start'}` → ligne `calls` créée avec status `initiating`.
5. JsSIP `ua.call(target)` → événements `progress` / `accepted` / `confirmed`.
6. À `confirmed` : `call-log {action: 'answer'}` + démarrage `MediaRecorder` sur le `remoteStream`.
7. UI : timer en temps réel, mute, DTMF, notes (textarea local).
8. Fin (`ended` / `failed`) : recorder.stop → `call-recording-upload` → mise à jour `calls` (`recording_path`, `notes`, `duration_sec`).
9. Trigger SQL `log_call_to_activities` ajoute une entrée dans la timeline `activites` de l'établissement lié.

## Sécurité & RGPD

| Aspect | Mesure |
|--------|--------|
| Mot de passe SIP | Chiffré AES via `pgp_sym_encrypt` côté DB, jamais retourné en clair sauf via `get_sip_credentials()` (auth.uid()) |
| Credentials côté front | Mémoire JS uniquement, **jamais en localStorage** |
| RLS `calls` | SELECT : owner OR admin/direction/CSM ; INSERT/UPDATE : owner uniquement |
| Bucket `call-recordings` | Privé. Accès via signed URL 5 min |
| Annonce vocale RGPD | Configurable dans `user_phone_settings.rgpd_announcement` |
| Rétention enregistrements | 90 jours max — cron `purge_old_call_recordings` quotidien à 03 h UTC |
| Suppression à la demande | Bouton "Supprimer mes enregistrements" dans `/parametres` |
| Audit | Trigger `log_call_to_activities` — chaque appel terminé crée une activité timeline |

## Configuration trunk SIP recommandée

### OVH Telecom (recommandé France)
- Domaine : `sip.ovh.fr`
- Proxy WSS : `wss://sip.ovh.fr:7443`
- Identifiant : numéro complet (ex `0033123456789`)
- Transport : `wss`

### Asterisk auto-hébergé
- Activer `chan_pjsip` avec WebRTC (`use_avpf=yes`, `media_encryption=dtls`, `dtls_*`)
- Proxy WSS : `wss://votre-asterisk.example.com:8089/ws`

### Keyyo / Voxbone
Compatibles WSS. Demander au support les paramètres exacts.

## Limitations connues

- iOS Safari : autoplay audio bloqué — la première lecture de `remoteStream` doit être déclenchée par interaction utilisateur (le clic `CallButton` suffit en pratique).
- Pare-feu d'entreprise : si le WSS est bloqué, configurer un STUN/TURN privé.
- Bundle JsSIP : ~120 ko, lazy-loadé au premier `connect`.

## Intégration moteur d'automatisations & Jarvis

- **Workflow trigger `call.completed`** : disponible dans le builder (`/automatisations`) via le sélecteur de trigger (`TRIGGER_LABELS['call.completed'] = "Appel téléphonique terminé"`). Le payload exposé contient `call_id`, `etablissement_id`, `prospect_id`, `contact_id`, `direction`, `duration_sec`, `status`, `notes`. Cas d'usage : créer une tâche de relance si `duration_sec < 30`, envoyer un email post-appel, notifier un CSM.
- **Outil Jarvis** : un futur outil `make_call({contact_id|phone, reason})` peut appeler `CallContext.startCall(...)` après validation explicite de l'utilisateur. **Jamais d'auto-dial** côté Jarvis : l'agent ne peut que pré-remplir le widget, l'utilisateur valide.
- **Appels entrants** : `useSipClient` écoute déjà l'événement JsSIP `newRTCSession` direction `inbound`. L'affichage d'un toast d'acceptation/refus reste à brancher (composant `IncomingCallToast` à créer en itération 2 dès qu'un trunk de terminaison entrante est configuré).

## Tests & validation

- Composants `CallButton`, `CallHistoryTab`, `CallRecordingPlayer` : testables sans serveur SIP réel (mock `useCallContext` + `useCalls`).
- Flux SIP réel : nécessite un compte trunk valide configuré via `/parametres → Téléphonie SIP`. Tester la connexion via le bouton dédié du `SipSettingsForm` (état `registered`).
- Edge functions : logs disponibles dans le dashboard Supabase (`call-log`, `call-recording-upload`, `sip-credentials`).

