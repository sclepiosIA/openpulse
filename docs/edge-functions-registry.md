# Edge Functions Registry

> Auto-generated audit — 218 Edge Functions total

## Status Legend

- ✅ **Active** — Used by frontend and/or scheduled via cron
- 🔗 **Internal** — Called by other Edge Functions only (not frontend)
- ⚠️ **Unreferenced** — Not called from frontend nor other functions (candidate for deprecation)
- 🔄 **v1/v2 coexistence** — Both versions exist

## Unreferenced Functions (Candidates for Deprecation)

| Function                        | Notes                                                          |
| ------------------------------- | -------------------------------------------------------------- |
| `call-recording-upload`         | No frontend or backend reference                               |
| `get-etablissements-emargement` | No reference — may be replaced by RPC/view                     |
| `jarvis-agents`                 | No reference — `jarvis-agent` (singular) is the active one     |
| `jarvis-objective-tracker`      | No reference                                                   |
| `migrate-to-jmap`               | One-time migration utility — can be archived                   |
| `oauth-google-init`             | No reference — OAuth uses `oauth-google-callback`              |
| `oauth-google-refresh`          | No reference — refresh may be handled inline                   |
| `recompute-prospect-scores`     | No reference — replaced by RPC `recompute_all_prospect_scores` |

## v1/v2 Coexistence

| v1                      | v2                                     | Status                                                                   |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `jarvis-proactive-scan` | `jarvis-proactive-scan-v2`             | Both used: v1 by JarvisAssistantPanel + cron, v2 by JarvisUnifiedContext |
| `sync-emails`           | `sync-emails-jmap`                     | Both used: v1 is IMAP, v2 is JMAP transport                              |
| `jarvis-brain`          | `jarvis-brain-stream` / `jarvis-prime` | All used: brain=sync, brain-stream=SSE, prime=enhanced reasoning         |

## By Domain

### Jarvis AI (34 functions)

`jarvis-agent`, `jarvis-agent-metrics`, `jarvis-agent-negotiation`, `jarvis-agents`⚠️, `jarvis-auto-actions`, `jarvis-autopilot-scheduler`, `jarvis-background-worker`, `jarvis-brain`, `jarvis-brain-stream`, `jarvis-calendar-intelligence`, `jarvis-collective-learning`, `jarvis-daily-briefing`, `jarvis-email-intelligence`, `jarvis-execute`, `jarvis-generate-embedding`, `jarvis-health-check`, `jarvis-index-document`, `jarvis-learning-engine`, `jarvis-multi-channel`, `jarvis-objective-tracker`⚠️, `jarvis-orchestrator`, `jarvis-predictive-engine`, `jarvis-preemptive-actions`, `jarvis-prime`, `jarvis-proactive-scan`, `jarvis-proactive-scan-v2`, `jarvis-shared-memory`, `jarvis-team-standup`, `jarvis-vision`, `jarvis-voice-intent`, `jarvis-web-scrape`, `jarvis-webhook-receiver`, `jarvis-workflow-engine`, `jarvis-workflow-learner`

### Email (19 functions)

`auto-create-contacts-from-email`, `auto-match-emails`, `complete-team-email-mappings`, `connect-email-account`, `correct-spelling-email`, `detect-and-translate-email`, `email-bulk-actions`, `enrich-contact-from-email`, `forward-email`, `generate-thread-summary`, `generate-thread-title`, `help-me-write-email`, `hourly-email-sync-and-analysis`, `process-email-with-ai`, `reformulate-email`, `resync-empty-emails`, `send-email`, `send-email-reply`, `suggest-email-content`, `sync-emails`, `sync-emails-jmap`, `test-email-connection`, `translate-email`, `update-email-password`

### Qonto/Treasury (10 functions)

`qonto-auth`, `qonto-check-alerts`, `qonto-get-balance`, `qonto-get-client-invoices`, `qonto-reconcile`, `qonto-sync-transactions`, `qonto-webhook-handler`, `smart-reconcile-qonto`, `sync-factures-tresorerie`, `tresorerie-generate-revenus-etablissements`

### Workflow Automation (7 functions)

`workflow-ai-action`, `workflow-dispatcher`, `workflow-engine`, `workflow-health-alerts`, `workflow-scheduler`, `workflow-webhook-trigger`, `generate-workflow-from-prompt`

### Booking/Calendar (8 functions)

`booking-notify`, `calendar-ai-create`, `calendar-feed`, `calendar-push-reminders`, `import-ics-events`, `public-booking-proxy`, `send-booking-confirmation`, `send-booking-reminder`

### Documents/Storage (9 functions)

`docspace-config`, `docspace-download`, `docspace-upload`, `document-ai-assist`, `download-attachment`, `help-me-create-document`, `nextcloud-files`, `nextcloud-import`, `notify-document-shared`

### RH/People (10 functions)

`calculate-payroll-stats`, `export-paie`, `offboard-user`, `parse-bulletin-salaire`, `parse-bulletin-temp`, `parse-cv-with-ai`, `suggest-employee-training`, `sync-rh-tresorerie`, `weekly-rh-analysis`, `prepare-annual-review`

### Facturation (8 functions)

`export-fec`, `facturation-actions`, `generate-contract-pdf`, `generate-invoice-pdf`, `generate-quote-pdf`, `generate-future-revenues`, `generate-recurring-expenses`, `send-invoice-reminders`

### Admin/Security (6 functions)

`admin-create-user`, `admin-disable-user`, `admin-reset-user-password`, `audit-admin-2fa`, `generate-2fa-secret`, `ip-validator`

### Pulse Messaging (5 functions)

`pulse-ai-chat`, `pulse-ai-editor`, `pulse-ai-summarize`, `pulse-notify`, `pulse-search`

### Signatures (4 functions)

`signature-cancel`, `signature-remind`, `signature-send`, `docuseal-webhook`

### Other

See full listing above for: formations, CRM, support, OAuth, WebRTC, transcription, etc.

---

## Security Hardening Matrix (P2.8)

> Source : `docs/audits/edge-functions-public-service-role.csv` (généré par `scripts/audit-edge-functions-public-service-role.mjs`).
> Audit 2026-06-06 · 230 EF analysées · **95 HIGH · 3 MEDIUM · 132 LOW**.

### Synthèse par catégorie / risque

| Catégorie          |   HIGH | MEDIUM |     LOW |   Total |
| ------------------ | -----: | -----: | ------: | ------: |
| public-api         |      6 |      0 |       5 |      11 |
| webhook / callback |      3 |      2 |       2 |       7 |
| oauth              |      1 |      1 |       2 |       4 |
| internal-likely    |     25 |      0 |      33 |      58 |
| unknown            |     60 |      0 |      90 |     150 |
| **Total**          | **95** |  **3** | **132** | **230** |

### Règle de priorisation (PR par lot de 10)

Ordre de traitement HIGH → MEDIUM, en commençant par les surfaces les plus exposées :

1. **public-api** (6) — exposées sans JWT et avec service_role. Ajouter zod + rate-limit + (si applicable) signature/host_token.
2. **webhook / callback** (3 HIGH + 2 MEDIUM) — exigent **signature HMAC** (`crypto.subtle`) + zod sur le payload externe.
3. **oauth** (1 HIGH + 1 MEDIUM) — zod sur les params, rate-limit anti-abus, vérif state CSRF.
4. **internal-likely jarvis-\*** (≈18) — déclencheurs internes : exiger un secret partagé `INTERNAL_INVOCATION_SECRET` (header `x-internal-secret`) + zod.
5. **internal-likely autres** (7) — même règle secret partagé + zod.
6. **unknown** (60) — recatégoriser avant durcissement : marquer dans le code source via commentaire `// @ef-category: <cat>` pour que le script d'audit affine son verdict.

### Lots planifiés (PR atomiques)

| Lot | Fonctions                                                                                                                                                                                                                                                                                                                                                                                                                                                | Type d'ajout requis                                                |
| --: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
|  L1 | ✅ `public-booking-proxy`, ✅ `register-emargement-simple`, ✅ `send-booking-confirmation`, ✅ `send-booking-reminder`, ✅ `send-emargement-confirmation`, ✅ `client-portal-emargement-pdf` (service_role bearer)                                                                                                                                                                                                                                       | zod + rate-limit + host_token/CAPTCHA — **6/6 traités 2026-06-06** |
|  L2 | ✅ `social-oauth-callback` (state CSRF), ✅ `jarvis-webhook-receiver` (HMAC + legacy timing-safe), ✅ `workflow-webhook-trigger` (HMAC opt-in)                                                                                                                                                                                                                                                                                                           | **HMAC obligatoire** + zod — **3/3 traités 2026-06-06**            |
|  L3 | ✅ `oauth-authorize` (consent flow déjà nonce-based + redirect_uri whitelist, rate-limit 30 req/10 min/IP ajouté 2026-06-06)                                                                                                                                                                                                                                                                                                                             | zod + rate-limit + state CSRF — **traité**                         |
|  L4 | ✅ `jarvis-autopilot-scheduler`, ✅ `jarvis-objective-tracker`, ✅ `jarvis-proactive-scan` (+ compat legacy), ✅ `jarvis-daily-briefing` (déjà conforme via `validateServiceOrUser`) — **4/4 traités 2026-06-06**.                                                                                                                                                                                                                                       | secret partagé + zod                                               |
| L4b | ✅ `jarvis-health-check` (handler reconstruit + dual auth), ✅ `jarvis-proactive-scan-v2` (`validateServiceOrUser` ajouté), ✅ `jarvis-background-worker`, ✅ `jarvis-collective-learning`, ✅ `jarvis-learning-engine`, ✅ `jarvis-team-standup` (déjà conformes) — **6/6 frontend-callable traités 2026-06-06**. **Bonus** : 3 handlers tronqués réparés (autopilot-scheduler, objective-tracker, health-check).                                       | JWT + rate-limit                                                   |
|  L5 | ✅ `process-transcription-summary` (internal-secret ajouté 2026-06-06) ; 8 × jarvis-\* internes restants + `enrich-contact-from-email` (déjà service_role check) — **1 nouveau traité**                                                                                                                                                                                                                                                                  | secret partagé + zod                                               |
|  L6 | ✅ `generate-future-revenues` (déjà x-function-secret), ✅ `generate-recurring-expenses` (bug truncation fix + internal-secret 2026-06-06), ✅ `generate-roadmap-summary` (bug fix 2026-06-06), ✅ `generate-thread-title` (internal-secret + caller sync-emails mis à jour 2026-06-06), ✅ `generate-ai-suggestions` (déjà service_role check) ; reste `sync-calendar-subscription` (frontend-callable → JWT) + 4 unknown CRON — **4 nouveaux traités** | secret partagé + zod                                               |

| L7-L10 | 60 × unknown → **35 recatégorisées 2026-06-06** : 16 protégées au gateway (`verify_jwt = true`), 16 publiques par design (track-email-_, calendar-feed, formation public, kb-ai, live-chat, etc.), 3 CRON avec `X-CRON-SECRET` (`daily-task-reminder`, `social-refresh-tokens`, `social-scheduler`), 3 nouvelles durcies (`check-thread-integrity-cron`, `qonto-reconcile`, `send-emargement-thanks`). Reste ≈ 25 EF à auditer (jarvis-_ restants + EF métier non-CRON). | classer puis appliquer la règle correspondante |

### Helpers existants à utiliser

- `supabase/functions/_shared/error-sanitizer.ts` ✅ (gate à 0 dette)
- `supabase/functions/_shared/cors.ts` ✅
- `supabase/functions/_shared/rate-limit.ts` ✅ (créé 2026-06-06, 5 tests Deno verts, best-effort par isolat)
- `supabase/functions/_shared/hmac.ts` ✅ (créé 2026-06-06, 8 tests Deno verts)
- `supabase/functions/_shared/internal-secret.ts` ✅ (créé 2026-06-06, 5 tests Deno verts) — pour L4-L6 (jarvis-\* internes + CRON)
- `supabase/functions/_shared/zod.ts` (re-export Zod Deno)

### Règle d'entrée pour toute nouvelle EF (CI gate à activer)

Chaque nouvelle EF DOIT figurer dans la matrice ci-dessus AVANT merge. Le script `scripts/audit-edge-functions-public-service-role.mjs` produira une comparaison delta vs `docs/audits/edge-functions-public-service-role.csv` ; un delta non documenté ici échouera le job CI (à câbler dans une PR suivante).
