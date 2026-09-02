# API Reference auto-généré — Edge Functions OpenPulse

> **Généré automatiquement** depuis `supabase/functions/` et `supabase/config.toml`.
> **Vérifié le** : 2026-06-03 | **Total** : 254 Edge Functions

Ce fichier liste **exhaustivement** toutes les fonctions déployées. Pour le détail des payloads et exemples `curl`, voir [`API_REFERENCE.md`](./API_REFERENCE.md) (documentation manuelle, ~162 fonctions principales).

## Légende `verify_jwt`

- 🔒 `true` — JWT requis (défaut)
- 🌐 `false` — endpoint public
- ⚪ non déclaré dans `config.toml` (défaut Supabase = `true`)

---

## Auth & Admin (4)

| Fonction | `verify_jwt` |
|---|---|
| `admin-create-user` | 🔒 true |
| `admin-disable-user` | ⚪ (défaut) |
| `admin-reset-user-password` | 🔒 true |
| `generate-2fa-secret` | 🔒 true |

## Booking & Calendrier (5)

| Fonction | `verify_jwt` |
|---|---|
| `booking-notify` | ⚪ (défaut) |
| `calendar-ai-create` | 🔒 true |
| `calendar-feed` | 🌐 false |
| `calendar-push-reminders` | 🌐 false |
| `public-booking-proxy` | 🌐 false |

## Conformité & RGPD (3)

| Fonction | `verify_jwt` |
|---|---|
| `audit-admin-2fa` | 🌐 false |
| `rgpd-anonymize` | ⚪ (défaut) |
| `rgpd-export-data` | 🔒 true |

## Contrats (DocuSeal) (5)

| Fonction | `verify_jwt` |
|---|---|
| `docuseal-create-signature` | 🔒 true |
| `docuseal-webhook` | 🌐 false |
| `signature-cancel` | ⚪ (défaut) |
| `signature-remind` | ⚪ (défaut) |
| `signature-send` | ⚪ (défaut) |

## Email (14)

| Fonction | `verify_jwt` |
|---|---|
| `correct-spelling-email` | 🔒 true |
| `email-bulk-actions` | 🌐 false |
| `generate-thread-summary` | 🔒 true |
| `generate-thread-title` | 🌐 false |
| `process-email-with-ai` | 🔒 true |
| `reformulate-email` | 🔒 true |
| `send-email` | 🌐 false |
| `send-email-reply` | 🔒 true |
| `suggest-email-content` | 🔒 true |
| `sync-emails` | 🔒 true |
| `sync-emails-jmap` | ⚪ (défaut) |
| `track-email-click` | ⚪ (défaut) |
| `track-email-open` | ⚪ (défaut) |
| `translate-email` | 🔒 true |

## Formations (2)

| Fonction | `verify_jwt` |
|---|---|
| `formation-kb-chat` | 🌐 false |
| `formation-pulse-chat` | 🌐 false |

## IA / Azure GPT-5 (43)

| Fonction | `verify_jwt` |
|---|---|
| `ai-health-check` | 🔒 true |
| `ai-search-overview` | 🔒 true |
| `analyze-medical-economic-study` | 🌐 false |
| `analyze-rapports-insights` | 🔒 true |
| `analyze-rh-insights` | 🔒 true |
| `analyze-simulator-data` | 🔒 true |
| `analyze-tresorerie-insights` | 🔒 true |
| `azure-transcribe-audio` | 🔒 true |
| `generate-ai-suggestions` | 🌐 false |
| `jarvis-agent` | 🌐 false |
| `jarvis-agent-metrics` | 🌐 false |
| `jarvis-agent-negotiation` | 🌐 false |
| `jarvis-agents` | ⚪ (défaut) |
| `jarvis-auto-actions` | 🌐 false |
| `jarvis-autopilot-scheduler` | 🌐 false |
| `jarvis-background-worker` | 🌐 false |
| `jarvis-brain` | 🔒 true |
| `jarvis-brain-stream` | 🔒 true |
| `jarvis-calendar-intelligence` | ⚪ (défaut) |
| `jarvis-collective-learning` | ⚪ (défaut) |
| `jarvis-daily-briefing` | 🔒 true |
| `jarvis-email-intelligence` | ⚪ (défaut) |
| `jarvis-execute` | 🔒 true |
| `jarvis-generate-embedding` | 🌐 false |
| `jarvis-health-check` | 🌐 false |
| `jarvis-index-document` | ⚪ (défaut) |
| `jarvis-learning-engine` | 🌐 false |
| `jarvis-multi-channel` | 🌐 false |
| `jarvis-objective-tracker` | ⚪ (défaut) |
| `jarvis-orchestrator` | 🌐 false |
| `jarvis-predictive-engine` | 🌐 false |
| `jarvis-preemptive-actions` | ⚪ (défaut) |
| `jarvis-prime` | 🌐 false |
| `jarvis-proactive-scan` | 🌐 false |
| `jarvis-proactive-scan-v2` | ⚪ (défaut) |
| `jarvis-shared-memory` | 🌐 false |
| `jarvis-team-standup` | 🌐 false |
| `jarvis-vision` | 🔒 true |
| `jarvis-voice-intent` | 🌐 false |
| `jarvis-web-scrape` | ⚪ (défaut) |
| `jarvis-webhook-receiver` | 🌐 false |
| `jarvis-workflow-engine` | 🌐 false |
| `jarvis-workflow-learner` | ⚪ (défaut) |

## Knowledge Base & GED (2)

| Fonction | `verify_jwt` |
|---|---|
| `kb-ai-assist` | 🔒 true |
| `kb-semantic-search` | 🔒 true |

## Notifications (2)

| Fonction | `verify_jwt` |
|---|---|
| `notify-document-shared` | 🌐 false |
| `notify-pending-ai-suggestions` | 🌐 false |

## Portail Client (1)

| Fonction | `verify_jwt` |
|---|---|
| `client-portal-emargement-pdf` | 🌐 false |

## Pulse (Communication) (6)

| Fonction | `verify_jwt` |
|---|---|
| `chat-data-query` | 🔒 true |
| `pulse-ai-chat` | 🔒 true |
| `pulse-ai-editor` | 🔒 true |
| `pulse-ai-summarize` | 🔒 true |
| `pulse-notify` | 🌐 false |
| `pulse-search` | 🔒 true |

## R&D (1)

| Fonction | `verify_jwt` |
|---|---|
| `rd-ai-assist` | 🔒 true |

## RH / People (4)

| Fonction | `verify_jwt` |
|---|---|
| `export-paie` | 🔒 true |
| `parse-bulletin-salaire` | 🔒 true |
| `parse-bulletin-temp` | 🔒 true |
| `sync-rh-tresorerie` | 🔒 true |

## Social Dashboard (8)

| Fonction | `verify_jwt` |
|---|---|
| `social-comment-reply` | 🌐 false |
| `social-health-alerts` | 🌐 false |
| `social-oauth-callback` | 🌐 false |
| `social-oauth-start` | 🌐 false |
| `social-publish` | 🌐 false |
| `social-refresh-tokens` | 🌐 false |
| `social-scheduler` | 🌐 false |
| `social-sync` | 🌐 false |

## Support (1)

| Fonction | `verify_jwt` |
|---|---|
| `create-support-ticket` | 🌐 false |

## Trésorerie & Facturation (8)

| Fonction | `verify_jwt` |
|---|---|
| `qonto-auth` | 🔒 true |
| `qonto-check-alerts` | 🌐 false |
| `qonto-get-balance` | 🔒 true |
| `qonto-get-client-invoices` | 🔒 true |
| `qonto-reconcile` | 🌐 false |
| `qonto-sync-transactions` | 🌐 false |
| `qonto-webhook-handler` | 🌐 false |
| `tresorerie-generate-revenus-etablissements` | 🔒 true |

## Utilitaires (122)

| Fonction | `verify_jwt` |
|---|---|
| `api-v1-docs` | 🌐 false |
| `api-v1-tickets` | ⚪ (défaut) |
| `apply-ai-suggestion` | 🔒 true |
| `auto-complete-sessions` | 🌐 false |
| `auto-create-contacts-from-email` | 🌐 false |
| `auto-create-contacts-from-partenaire` | 🌐 false |
| `auto-create-etablissement` | 🌐 false |
| `auto-link-attachment-to-task` | 🔒 true |
| `auto-match-emails` | 🔒 true |
| `backfill-contacts-from-ai-data` | 🔒 true |
| `calculate-payroll-stats` | 🔒 true |
| `call-log` | ⚪ (défaut) |
| `call-recording-upload` | ⚪ (défaut) |
| `check-absence-conflicts` | 🔒 true |
| `check-thread-integrity-cron` | 🌐 false |
| `cleanup-all-suggestions` | 🌐 false |
| `cleanup-internal-contacts` | 🔒 true |
| `companion-autologin` | 🌐 false |
| `complete-team-email-mappings` | 🔒 true |
| `connect-email-account` | 🔒 true |
| `contract-ai-assist` | 🔒 true |
| `create-google-meet-link` | 🔒 true |
| `create-in-app-notification` | 🌐 false |
| `create-live-chat-session` | ⚪ (défaut) |
| `create-nextcloud-talk-link` | 🔒 true |
| `create-tasks-from-email` | 🌐 false |
| `csm-playbook-engine` | 🌐 false |
| `daily-ai-insights-analysis` | 🌐 false |
| `daily-task-reminder` | 🌐 false |
| `detect-and-translate-email` | 🔒 true |
| `detect-calendar-invitations` | 🔒 true |
| `docspace-config` | 🔒 true |
| `docspace-download` | 🔒 true |
| `docspace-upload` | 🔒 true |
| `download-attachment` | 🔒 true |
| `enrich-contact-from-email` | 🌐 false |
| `enrich-prospect` | ⚪ (défaut) |
| `export-fec` | 🔒 true |
| `facturation-actions` | 🌐 false |
| `fill-with-ai` | 🌐 false |
| `forum-actions` | 🌐 false |
| `forward-email` | 🔒 true |
| `generate-contract-pdf` | 🔒 true |
| `generate-direction-alerts` | 🔒 true |
| `generate-future-revenues` | 🌐 false |
| `generate-invoice-pdf` | 🔒 true |
| `generate-quote-pdf` | 🔒 true |
| `generate-recurring-expenses` | 🌐 false |
| `generate-retention-email` | ⚪ (défaut) |
| `generate-roadmap-summary` | 🌐 false |
| `generate-visio-summary` | ⚪ (défaut) |
| `generate-workflow-from-prompt` | ⚪ (défaut) |
| `get-etablissements-emargement` | ⚪ (défaut) |
| `help-me-create-document` | 🌐 false |
| `help-me-write-email` | 🔒 true |
| `hourly-email-sync-and-analysis` | 🌐 false |
| `import-commercial-data` | 🌐 false |
| `import-deck-json` | 🔒 true |
| `import-ics-events` | 🌐 false |
| `ip-validator` | 🌐 false |
| `live-chat-ai-respond` | 🌐 false |
| `mcp-server` | 🌐 false |
| `meeting-notes-process` | 🌐 false |
| `migrate-to-jmap` | ⚪ (défaut) |
| `nextcloud-files` | ⚪ (défaut) |
| `nextcloud-import` | 🌐 false |
| `oauth-authorize` | 🌐 false |
| `oauth-google-callback` | ⚪ (défaut) |
| `oauth-google-init` | ⚪ (défaut) |
| `oauth-google-refresh` | ⚪ (défaut) |
| `oauth-token` | 🌐 false |
| `offboard-user` | ⚪ (défaut) |
| `onlyoffice-callback` | 🌐 false |
| `onlyoffice-token` | 🌐 false |
| `parse-cv-with-ai` | 🔒 true |
| `predict-cashflow` | 🔒 true |
| `prepare-annual-review` | 🔒 true |
| `process-transcription-summary` | 🌐 false |
| `provision-test-accounts` | 🌐 false |
| `quick-match-by-domain` | 🔒 true |
| `reanalyze-all-bulletins` | 🔒 true |
| `recommend-training` | 🔒 true |
| `recompute-gamification` | 🌐 false |
| `recompute-prospect-scores` | ⚪ (défaut) |
| `register-emargement-simple` | 🌐 false |
| `report-export` | ⚪ (défaut) |
| `resync-empty-emails` | 🔒 true |
| `save-quiz-result` | 🌐 false |
| `send-booking-confirmation` | 🌐 false |
| `send-booking-reminder` | 🌐 false |
| `send-emargement-confirmation` | 🌐 false |
| `send-emargement-thanks` | 🌐 false |
| `send-invoice-reminders` | 🌐 false |
| `send-push-notification` | 🌐 false |
| `send-test-email` | 🔒 true |
| `send-transcription-email` | 🌐 false |
| `sequence-engine` | 🌐 false |
| `setup-team-members` | 🔒 true |
| `sip-credentials` | ⚪ (défaut) |
| `smart-reconcile-qonto` | 🔒 true |
| `smart-tasks-from-content` | 🔒 true |
| `structure-note` | 🔒 true |
| `submit-satisfaction-solution` | 🌐 false |
| `suggest-employee-training` | 🔒 true |
| `sync-calendar-subscription` | 🌐 false |
| `sync-factures-tresorerie` | 🔒 true |
| `synthesize-communication` | 🌐 false |
| `test-email-connection` | 🔒 true |
| `transcribe-audio` | 🔒 true |
| `update-email-password` | 🔒 true |
| `update-tasks-from-email` | 🌐 false |
| `visio-transcription-session` | 🔒 true |
| `webdav-server` | 🌐 false |
| `webrtc-signaling` | 🔒 true |
| `weekly-rh-analysis` | 🌐 false |
| `weekly-treasury-analysis` | 🌐 false |
| `workflow-ai-action` | ⚪ (défaut) |
| `workflow-dispatcher` | 🌐 false |
| `workflow-engine` | 🌐 false |
| `workflow-health-alerts` | 🌐 false |
| `workflow-scheduler` | 🌐 false |
| `workflow-webhook-trigger` | 🌐 false |

---

## Couverture par config.toml

- Déclarées dans `config.toml` : **193 / 231**
- Non déclarées (défaut `verify_jwt=true`) : **38**
- Publiques (`verify_jwt=false`) : **106**
