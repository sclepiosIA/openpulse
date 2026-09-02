# 📚 Documentation OpenPulse

> **Index complet de la documentation technique et utilisateur**
> 
> Dernière mise à jour : 5 juillet 2026 | Version 1.9.0 (JARVIS V17)

---

## 🏗️ Architecture & Référence

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Vue d'ensemble de l'architecture système |
| [API_REFERENCE.md](./API_REFERENCE.md) | Documentation des 254 Edge Functions Deno |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Schéma complet (436+ tables PostgreSQL) |
| [SECURITY.md](../SECURITY.md) | Guide de sécurité et bonnes pratiques |
| [HOOKS_ARCHITECTURE.md](./HOOKS_ARCHITECTURE.md) | Architecture des 459 hooks React (hors tests) |
| [RLS_EXCEPTIONS.md](./RLS_EXCEPTIONS.md) | Exceptions et règles RLS spéciales |

---

## 📖 Guides Techniques par Module

### Intelligence Artificielle

| Module | Guide |
|--------|-------|
| **JARVIS 12.0** 🤖 | [JARVIS_TECH_GUIDE.md](./JARVIS_TECH_GUIDE.md) |

### CRM & Core

| Module | Guide |
|--------|-------|
| CRM (utilisateur) | [CRM_USER_GUIDE.md](./CRM_USER_GUIDE.md) |
| Email / Messagerie | [EMAIL_TECH_GUIDE.md](./EMAIL_TECH_GUIDE.md) |
| Email (utilisateur) | [EMAIL_USER_GUIDE.md](./EMAIL_USER_GUIDE.md) |
| Support & Tickets | [SUPPORT_TECH_GUIDE.md](./SUPPORT_TECH_GUIDE.md) |
| Établissements bloqués | [BLOCKED_ESTABLISHMENTS.md](./BLOCKED_ESTABLISHMENTS.md) |

### Finance & Facturation

| Module | Guide |
|--------|-------|
| Trésorerie | [TRESORERIE_TECH_GUIDE.md](./TRESORERIE_TECH_GUIDE.md) |
| Facturation & Devis | [FACTURATION_TECH_GUIDE.md](./FACTURATION_TECH_GUIDE.md) |
| Calcul de valeur | [VALUE_CALCULATION_RULES.md](./VALUE_CALCULATION_RULES.md) |

### RH & People

| Module | Guide |
|--------|-------|
| RH (technique) | [RH_TECH_GUIDE.md](./RH_TECH_GUIDE.md) |
| RH (utilisateur) | [RH_USER_GUIDE.md](./RH_USER_GUIDE.md) |
| Compétences | [COMPETENCES_TECH_GUIDE.md](./COMPETENCES_TECH_GUIDE.md) |
| Recrutement | [RECRUTEMENT_TECH_GUIDE.md](./RECRUTEMENT_TECH_GUIDE.md) |

### Communication & Collaboration

| Module | Guide |
|--------|-------|
| Pulse (technique) | [PULSE_TECH_GUIDE.md](./PULSE_TECH_GUIDE.md) |
| Pulse (utilisateur) | [PULSE_USER_GUIDE.md](./PULSE_USER_GUIDE.md) |
| Live Chat (widget) | [LIVE_CHAT_TECH_GUIDE.md](./LIVE_CHAT_TECH_GUIDE.md) |
| Base de connaissances | [KNOWLEDGE_BASE_TECH_GUIDE.md](./KNOWLEDGE_BASE_TECH_GUIDE.md) |

### Gestion de projet

| Module | Guide |
|--------|-------|
| R&D (technique) | [RD_TECH_GUIDE.md](./RD_TECH_GUIDE.md) |
| R&D (utilisateur) | [RD_USER_GUIDE.md](./RD_USER_GUIDE.md) |

### Contrats & Juridique

| Module | Guide |
|--------|-------|
| Contrats (DocuSeal) | [CONTRATS_TECH_GUIDE.md](./CONTRATS_TECH_GUIDE.md) |
| RGPD & Conformité | [RGPD_TECH_GUIDE.md](./RGPD_TECH_GUIDE.md) |

### Réservations & Calendrier

| Module | Guide |
|--------|-------|
| Booking (RDV publics) | [BOOKING_TECH_GUIDE.md](./BOOKING_TECH_GUIDE.md) |

---

## 🚀 Déploiement & Infrastructure

| Document | Description |
|----------|-------------|
| [QUICK_START_ON_PREMISE.md](./QUICK_START_ON_PREMISE.md) | Guide rapide installation on-premise (10 étapes) |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Guide de déploiement complet |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Checklist avant mise en production |
| [SELF_HOSTING_GUIDE.md](./SELF_HOSTING_GUIDE.md) | Hébergement self-hosted |
| [OVH_DEPLOYMENT.md](./OVH_DEPLOYMENT.md) | Déploiement spécifique OVH |
| [azure/GESTION-AZURE-ONBOARDING.md](./azure/GESTION-AZURE-ONBOARDING.md) | Reprise opérationnelle Gestion Azure : live, SHA, Container Apps, Drive API, Desktop public |
| [PUSH_NOTIFICATIONS_GUIDE.md](./PUSH_NOTIFICATIONS_GUIDE.md) | Configuration Web Push |

---

## 📱 PWA & Performance

| Document | Description |
|----------|-------------|
| [PWA_FEATURES.md](./PWA_FEATURES.md) | Fonctionnalités Progressive Web App |
| [PWA_ANALYTICS.md](./PWA_ANALYTICS.md) | Analytics mobile et tracking PWA |
| [BUNDLE_ANALYSIS.md](./BUNDLE_ANALYSIS.md) | Optimisations bundle et lazy loading |
| [MONITORING_SETUP.md](./MONITORING_SETUP.md) | Stack monitoring auto-hébergée |
| [DEV_CONTAINER.md](./DEV_CONTAINER.md) | Onboarding rapide avec Dev Container |
| [UI_COMPONENTS_GUIDE.md](./UI_COMPONENTS_GUIDE.md) | Guide des composants UI |

---

## 📧 Email - Guides Spécialisés

| Document | Description |
|----------|-------------|
| [EMAIL_INBOX_FEATURES.md](./EMAIL_INBOX_FEATURES.md) | Fonctionnalités inbox |
| [EMAIL_SEARCH_FEATURES.md](./EMAIL_SEARCH_FEATURES.md) | Recherche avancée |
| [EMAIL_ENCODING_RULES.md](./EMAIL_ENCODING_RULES.md) | Gestion des encodages |
| [EMAIL_THREAD_INTEGRITY.md](./EMAIL_THREAD_INTEGRITY.md) | Intégrité des threads |
| [EMAIL_HISTORICAL_BACKFILL.md](./EMAIL_HISTORICAL_BACKFILL.md) | Import historique |

---

## 💰 Trésorerie - Guides Utilisateur

| Document | Description |
|----------|-------------|
| [TRESORERIE_USER_GUIDE.md](./TRESORERIE_USER_GUIDE.md) | Guide utilisateur trésorerie |

---

## 🧪 Tests

| Document | Description |
|----------|-------------|
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Guide des tests (Vitest, Playwright, a11y) |

---

## 🔧 Dépannage

| Document | Description |
|----------|-------------|
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Guide de résolution des problèmes courants |
| [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) | Guide de migration de données |
| [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md) | Checklist de validation |
| [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md) | Procédures de gestion des incidents |

---

## 📊 Statistiques Projet

| Métrique | Valeur |
|----------|--------|
| Edge Functions Deno | 254 |
| Tables PostgreSQL (types générés) | 436+ |
| Migrations SQL | 876 |
| Hooks React (hors tests) | 459 |
| Pages (hors tests) | 156 |
| Contextes React | 63 fichiers |
| Types TypeScript | 103 fichiers |
| Composants (dossiers `src/components/`) | 90 |
| Fichiers de documentation (`docs/*.md`) | 83 |
| Tests unitaires (`src/**/*.test.*`) | 6 538 |
| Tests E2E / intégration (`tests/**/*.test.*`) | 171 |

> **Note** : Comptage automatisé — 5 juillet 2026 | Version 1.9.0 (JARVIS V17).
> Voir [DOC_AUDIT_2026-07-05.md](./DOC_AUDIT_2026-07-05.md) pour la synthèse de fraîcheur.
>
> **Audits récents** :
> - **2026-07-05** : Audit documentation — marquage `ARCHIVED_` sur 171 fichiers, resynchronisation des compteurs et versions.
> - **2026-05-30** : Audit OpenPulse (mono-org) — P0 sécurité+CI traités (SEC-01, MAT-01/02), backlog SEC-03 CORS / CONF-01/02 RGPD ouverts. Détail : `docs/audits/`.
> - **2026-05-14/15** : Audit v3-azure — Vague 1 RBAC clôturée (11 bugs P0+P1).

> **Méthodologie de comptage** :
> - **Fichiers documentation** : `find docs -maxdepth 1 -name '*.md' | wc -l`
> - **Hooks React** : `find src/hooks -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' ! -name '*.spec.*' | wc -l`
> - **Edge Functions** : `ls supabase/functions | grep -v _shared | wc -l`
> - **Pages** : `find src/pages -type f -name '*.tsx' ! -name '*.test.*' | wc -l`
> - **Tables** : `grep -c "Row: {" src/integrations/supabase/types.ts`

---

## 🗄️ Archives

Les documents historiques sont conservés dans les dossiers `archive/` / `archives/` du repo. Depuis l'audit du 2026-07-05, tous les fichiers d'archive portent le préfixe `ARCHIVED_` (ou un marqueur explicite `CLOTURE-`, `CLOSED-`, `-STALE`, `.legacy`) pour éviter toute confusion.

Emplacements principaux :
- [`docs/audits/archive/`](./audits/archive/) — Rapports d'audit clos
- [`docs/archive/`](./archive/) — Documents techniques dépréciés
- [`audits/archives/`](../audits/archives/) et [`audits/e2e/archive/`](../audits/e2e/archive/) — Runs d'audit E2E
- [les archives d'audit, hors distribution](../tests/pentest/archive/) — Rapports pentest historiques
- [les archives d'audit, hors distribution](../tests/qa-reports/archive/) — Rapports QA historiques
- [les archives d'audit, hors distribution](../tests/browser-use/archive/) — Runs browser-use (artefacts machine `index.json` conservés sans préfixe pour compatibilité avec `compare_runs.py` / `export_normalized_findings.py`)

---

## 🔗 Liens Utiles

- [README principal](../README.md)
- [CHANGELOG](../CHANGELOG.md)
- [CONTRIBUTING](../CONTRIBUTING.md)
- [Code de conduite](../CODE_OF_CONDUCT.md)
- [Licence](../LICENSE)
- [Audits & plans de remédiation](./audits/README.md)

---

*Documentation maintenue par l'équipe OpenPulse — 5 juillet 2026 | Version 1.9.0*
