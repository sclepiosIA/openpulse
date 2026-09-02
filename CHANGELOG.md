# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Versioning Sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté
- Sauvegarde et restauration canoniques de la base, des rôles PostgreSQL et du
  stockage objet, avec inventaire SHA-256 et compatibilité Linux/macOS.

### Sécurité
- Les sauvegardes sont privées par défaut et n'embarquent pas les mots de passe
  des rôles ; les échecs de dump, d'arrêt ou de redémarrage restent fail-closed.

### Corrigé
- Les propriétaires `auth` et `storage`, l'ordre de restauration et l'état
  initial des services sont désormais préservés.
- Les routes CRM exigent explicitement les permissions Prospects/Pipeline au lieu
  de reposer uniquement sur une liste de rôles exclus.

### À venir
- Export PDF des rapports
- Mode hors-ligne avec synchronisation
- Planning Poker pour estimation R&D
- Rétrospectives sprint

> **Note** : Le support multi-langues (i18n) a été écarté (décision produit
> 2026-05-24, FR-only confirmé — audience hospitalière francophone). Cf.
> ADR `docs/audits/archive/CLOTURE-2026-05-24-tracker.md`.

---

## [1.9.0] - 2026-03-03

### Audit Performance (7 phases, ~90 fichiers)
- **Phase 1-3** : Colonnes explicites dans les requêtes Supabase (remplacement de `select('*')`)
- **Phase 4** : Ajout de `.limit()` sur toutes les requêtes sans pagination
- **Phase 5** : Optimisation des count queries (utilisation de `count: 'exact'` au lieu de fetch complet)
- **Phase 6** : Sécurisation des canaux Realtime (subscription avec filtres)
- **Phase 7** : Correction de 2 bugs découverts lors de l'audit (double fetch, race condition)

### Audit Tests (6 phases)
- **Phase 1** : Élimination des tests fantômes — extraction de la logique inline vers des modules réels (`src/lib/crmUtils.ts`, `rhUtils.ts`, `documentUtils.ts`, `dateHelpers.ts`, `validationHelpers.ts`, `formatterHelpers.ts`)
- **Phase 2** : Migration vers la mock factory partagée `src/test-utils/supabaseMockFactory.ts` (modèle appliqué sur `useEtablissements.test.tsx`)
- **Phase 3** : Suppression des doublons A11y (`tests/a11y/AppSidebar.test.tsx`, `tests/a11y/EtablissementForm.test.tsx`) et du mock factory doublon (`src/test/mocks/supabase.ts`)
- **Phase 4** : Renforcement des assertions dans `JarvisComponents.test.tsx`
- **Phase 5** : Correction CI — health check HTTP au lieu de `sleep 10`, réordonnancement Playwright
- Suppression de `src/__tests__/setup.test.tsx` (tests triviaux)

### Audit Documentation
- **Phase 1** : Correction de 9 liens morts dans la documentation
- **Phase 2** : Synchronisation de toutes les versions vers v1.9.0 / Mars 2026 (7 fichiers)
- **Phase 3** : Corrections de contenu dans CONTRIBUTING, TESTING_GUIDE, DEPLOYMENT_GUIDE, TROUBLESHOOTING
  - Remplacement `profiles.role` par `user_roles` + `has_role()` dans DEPLOYMENT_GUIDE
  - Suppression des références Vercel/Netlify/Azure (projet déployé via plateforme initiale tierce)
  - Remplacement `console.log` par `debug.log` dans TROUBLESHOOTING
  - Remplacement `.select('*')` par colonnes explicites
  - Remplacement `staleTime`/`cacheTime` en dur par `queryPresets`
- **Phase 4** : Création de `docs/MONITORING_SETUP.md`, mise à jour du CHANGELOG

### Corrigé
- Documentation : 9 liens morts corrigés
- Documentation : comptage des fichiers docs 54 → 57
- Tests A11y : inventaire mis à jour (8 → 6 fichiers dans `tests/a11y/`)

---

## [1.8.0] - 2026-02-22

### Ajouté
- **JARVIS 12.0** : Assistant IA autonome avec accès complet aux données
  - Streaming SSE via `jarvis-brain` Edge Function (orchestration d'outils)
  - 50+ outils intégrés : calendrier, CRM, emails, tâches, RH, trésorerie
  - Transcription vocale temps réel (Azure Speech-to-Text)
  - Intelligence collective cross-utilisateur (`jarvis-collective-learning`)
  - Alertes proactives avec `JarvisProactiveAlertsContext`
  - Panel premium unifié (sidebar + bouton flottant mobile)
  - Mode autonome "OpenWlaw" : accès direct données sans confirmation utilisateur
- **Calendriers OpenPulse** : Calendriers d'équipe partagés
  - Transparence visuelle avec opacité semi-transparente
  - Visibilité des calendriers `is_default` par tous les utilisateurs
  - Flux iCal via `calendar-feed` Edge Function
  - Partage granulaire via `calendar_shares` (lecture/écriture)
- **Transcription** : Nouveau `TranscriptionContext` pour sessions audio en cours
- **Edge Functions JARVIS** : ~50 nouvelles fonctions (query_database, schedule_meeting, search_emails, create_task, etc.)

### Modifié
- Architecture : ~162 Edge Functions (était 125)
- Hooks : ~301 hooks personnalisés (était 266)
- Pages : 86 pages (était 81) — 77 desktop + 9 mobile
- Composants : 61 dossiers (était 60)
- Contextes React : 11 (était 9) — ajout `JarvisProactiveAlertsContext`, `TranscriptionContext`
- Types TypeScript : 42 fichiers (était 39)
- Fichiers documentation : 54 (était 52) — ajout JARVIS_TECH_GUIDE.md

### Corrigé
- JARVIS `query_database` : Correction de la validation des requêtes SQL
- JARVIS `schedule_meeting` : Correction de la gestion des fuseaux horaires
- JARVIS rôles auth : Vérification correcte des permissions par outil
- Tests infrastructure : Polyfills centralisés dans `src/test-setup.ts`
- Tests a11y : Pattern d'inclusion `vitest-a11y.config.ts` corrigé pour matcher `tests/a11y/`
- CI pipeline : Suppression des `|| echo "No tests found"` masquant les erreurs
- Doublon supprimé : `src/components/__tests__/Dashboard.a11y.test.tsx`

### Documentation
- Création `docs/JARVIS_TECH_GUIDE.md` (architecture complète JARVIS 12.0)
- Mise à jour `docs/TESTING_GUIDE.md` v2.0 (polyfills centralisés, commandes npx)
- Mise à jour complète README.md, ARCHITECTURE.md, SECURITY.md vers v1.8.0
- Harmonisation de toutes les métriques dans l'ensemble de la documentation

### Métriques Finales Vérifiées (Février 2026)
| Métrique | Valeur |
|----------|--------|
| Edge Functions | ~162 |
| Hooks React | ~301 |
| Pages | 86 (77 desktop + 9 mobile) |
| Composants | 61 dossiers |
| Types TypeScript | 42 fichiers |
| Contextes React | 11 |
| Tables PostgreSQL | 151+ |
| Fichiers documentation | 54 |

---

## [1.7.3] - 2026-02-01

### Documentation
- **Audit documentaire complet v4** : Correction des métriques et méthodologie
  - Hooks React : 266 → **274** (ajout sous-dossier `src/hooks/documents/` avec 11 hooks)
  - Fichiers documentation : Clarification méthodologie de comptage (52 fichiers racine `docs/`)
  - Scripts README.md : Documentation complète des scripts on-premise
  - HOOKS_ARCHITECTURE.md : Ajout section hooks documents/
- **Audit documentaire exhaustif v3** : Harmonisation complète vers v1.7.3 / Février 2026
  - **27 fichiers mis à jour** pour synchroniser toutes les versions :
    - 14 guides techniques (_TECH_GUIDE.md)
    - 4 guides infrastructure (DEPLOYMENT, SELF_HOSTING, OVH, MIGRATION)
    - 3 guides utilisateur (RH_USER, TRESORERIE_USER, TROUBLESHOOTING)
    - 1 guide spécialisé (INCIDENT_RUNBOOK v1.0 → v1.1)
    - 3 fichiers racine (ARCHITECTURE, SECURITY, README)
    - 2 footers (DATABASE_SCHEMA, migration-php)
  - Correction des statistiques dans README.md : 51 → **52** fichiers docs
  - Correction ARCHITECTURE.md footer : v1.6.1 → **v1.7.3**
  - Correction SECURITY.md : dates Janvier → **Février 2026**
- **Vérification des 9 contextes React** documentés
- **Vérification des 81 pages** (73 desktop + 8 mobile PWA)

### Métriques Finales Vérifiées (Février 2026)
| Métrique | Valeur |
|----------|--------|
| Edge Functions | 125 |
| Hooks React | 266 |
| Pages | 81 |
| Composants | 60 dossiers |
| Types TypeScript | 39 fichiers |
| Contextes React | 9 |
| Tables PostgreSQL | 151 |
| Fichiers documentation | 52 |

---

## [1.7.2] - 2026-01-25

### Documentation
- **Audit documentaire complet** : Synchronisation des métriques dans tous les fichiers
  - Edge Functions : 122/124/125 → **126** (comptage vérifié)
  - Hooks React : 260+ → **254** (comptage exact)
  - Composants : 65+ → **60 dossiers**
- **Versions harmonisées** : Tous les fichiers alignés sur v1.7.1
- **API Reference** : Mise à jour vers 126 Edge Functions, version 1.7.1
- Correction incohérences dans README.md, ARCHITECTURE.md, docs/README.md, docs/API_REFERENCE.md

---

## [1.7.1] - 2026-01-25

### Performance - Stabilité Visuelle
- **Animations conditionnelles** : Ajout `useShouldAnimate` à `FloatingElements`, `WaveBackground`, `MobileAuthHeader`
- **DashboardHero optimisé** : Vague de transition et highlight animé conditionnés par `shouldAnimate`
- **Polling harmonisé** : Intervalles de refetch augmentés (30s → 60s) pour `useEmailUnreadCount` et `useEmailUnprocessedCount`
- **Présence debounced** : Ajout debounce 500ms sur `useGlobalUserPresence` pour batching des mises à jour temps réel
- **Réduction saccades** : ~70% moins de mutations DOM sur les animations SVG, particulièrement sur mobile/onglet inactif

### Technique
- Nouvelles versions statiques des animations SVG pour fallback sans mouvement
- `useShouldAnimateLight` utilisé sur mobile pour permettre les animations tout en respectant la visibilité de l'onglet

---

## [1.7.0] - 2026-01-25

### Sécurité
- **Logs sensibles** : Remplacement console.log par debug.log filtré dans TwoFactorSetup et ResetPassword
- **debug.ts renforcé** : Filtrage des warnings en production, helper maskId() pour masquer les identifiants
- **Audit 2FA automatisé** : Nouvelle Edge Function `audit-admin-2fa` pour vérification quotidienne de conformité

### Performance
- **Limites de sécurité DB** : Ajout `.limit()` sur 6 hooks critiques (Prévisionnel, Presence, Calendars, Groupe)
- **Edge Functions optimisées** : Ajout `.limit()` sur `check-absence-conflicts` et `pulse-notify`
- **React.memo** : Optimisation `TaskCard`, `TeamMemberCard` (equipe + etablissement) avec comparateurs personnalisés
- **queryPresets standardisés** : Migration de 5 hooks vers les presets normalisés
  - `useTachesGroupe`, `useContactsGroupe`, `useEtablissementTimeline`, `AIContactHoverCard`

### Technique
- Edge Functions count : 124 → **125** (nouvelle fonction audit-admin-2fa)
- Hooks optimisés avec queryPresets : standardisation du caching à travers l'application

---

## [1.6.2] - 2026-01-25

### Documentation
- **Audit métriques** : Correction comptages réels
  - Edge Functions : 122 → **124** (2 nouvelles fonctions détectées)
  - Types TypeScript : 25 → **26 fichiers**
- Standardisation version sur `docs/migration-php/README.md`
- Uniformisation `migration-phalcon/docs/API_REFERENCE.md`

---

## [1.6.1] - 2026-01-25

### Documentation
- **Audit complet** : Vérification exhaustive de toute la documentation
- Actualisation des métriques : 254 Edge Functions, 436+ tables, 260+ hooks, 74 pages
- Documentation des 8 contextes React dans ARCHITECTURE.md
- Documentation des 25 fichiers de types TypeScript
- Ajout section "Backend Node.js (server/)" dans ARCHITECTURE.md
- Mise à jour DATABASE_SCHEMA.md : 436+ tables, 450+ politiques RLS (comptage 2025)
- Synchronisation API_REFERENCE.md avec les 254 Edge Functions
- Correction métriques dans docs/migration-php/README.md (96 → 122 fonctions)
- Mise à jour docs/README.md avec statistiques exactes
- **Phase 2** : Uniformisation de tous les guides techniques en version 1.6.1
  - 14 guides techniques mis à jour (EMAIL, RH, RD, SUPPORT, PULSE, etc.)
- **Phase 3** : Vérification des liens inter-docs (40 fichiers, aucun lien mort)
- **Phase 4** : Validation finale - Tous les fichiers conformes

---

## [1.6.0] - 2026-01

### Ajouté
- **Module Facturation** : Devis, factures, avoirs, catalogue produits, export FEC
- **Module Contrats** : Modèles, clauses, signatures électroniques DocuSeal
- **Module Pulse** : Communication interne temps réel, visioconférence
- **Module Recrutement** : Pipeline candidats, offres d'emploi, parsing CV IA
- **Module Live Chat** : Widget embeddable avec réponses IA
- **Module Booking** : Pages RDV publiques, confirmations email
- **Module Base de Connaissances** : Documentation interne, recherche sémantique
- **Module Compétences** : Référentiel, certifications, alertes expiration
- **Sécurité** : Audit complet et remédiation (secrets, XSS, CORS, RLS)
- **Documentation** : 14 guides techniques créés/mis à jour

### Modifié
- Architecture : 254 Edge Functions (était 85)
- Hooks : 250+ hooks personnalisés (était 140)
- Pages : 75 pages (était 50)
- Composants : 60+ dossiers (était 45)
- Tables : 120+ (était 79)

### Nettoyage
- Suppression de 27+ fichiers obsolètes
- Consolidation des fichiers PWA/Performance dans /docs

### Sécurité
- Suppression des secrets en clair dans les scripts
- Durcissement RLS sur les tables sensibles
- Validation webhook DocuSeal
- Sanitization XSS renforcée

---

## [1.5.0] - 2025-12-07

### Ajouté
- **Notifications Push** : Système complet Web Push avec support iOS PWA
- **Module Support** : Gestion complète des tickets
- **Documentation GitHub complète**

### Modifié
- Navigation unifiée mobile/desktop avec Sheet pattern
- Sidebar réorganisée en 7 sections cohérentes

### Corrigé
- Chiffrement Web Push correct (aes128gcm)
- Synchronisation emails OVH
- Race condition login/signOut

---

## [1.4.0] - 2025-11-15

### Ajouté
- **Module R&D Agile** : Gestion de projet Scrum complète
- **Tutoriels intégrés** : 17 modules de formation
- **Gantt Global** : Vue multi-établissements

### Modifié
- Email : génération automatique de titres IA
- Classification emails étendue à 8 catégories

---

## [1.3.0] - 2025-10-01

### Ajouté
- **Module Formations** : Gestion complète
- **Breadcrumb global** : Navigation historique
- **Trésorerie refactorisée** : Architecture KISS

### Modifié
- Page People unifiée (RH + Équipe fusionnés)
- Onboarding/Offboarding intégré aux dossiers RH

### Corrigé
- Triple comptage salaires dans dépenses
- Affichage logos établissements/groupes

---

## [1.2.0] - 2025-07-12

### Ajouté
- Tests end-to-end avec Playwright
- Tests d'accessibilité WCAG AA automatisés
- Lazy loading des pages
- Configuration CI/CD GitHub Actions

---

## [1.1.0] - 2025-07-05

### Ajouté
- Authentification à deux facteurs (2FA)
- Gestion des profils utilisateurs avancée
- Système de rôles et permissions
- Logs de sécurité et audit

---

## [1.0.0] - 2025-06-01

### Ajouté
- Gestion complète des établissements hospitaliers
- Système de tâches et projets
- Pipeline commercial et suivi prospects
- Tableaux de bord et analytics
- Import/export CSV des données
- Authentification Supabase
- Interface responsive Tailwind CSS

### Infrastructure
- Base de données Supabase PostgreSQL
- Row Level Security (RLS)
- Edge Functions pour logique métier
- Stockage fichiers sécurisé
- Déploiement automatique la plateforme initiale

---

## Guide des types de changements

- **Ajouté** : nouvelles fonctionnalités
- **Modifié** : changements dans les fonctionnalités existantes
- **Déprécié** : fonctionnalités bientôt supprimées
- **Supprimé** : fonctionnalités supprimées
- **Corrigé** : corrections de bugs
- **Sécurité** : améliorations de sécurité

## Convention de versioning

- **MAJOR** (X.0.0) : changements incompatibles
- **MINOR** (x.Y.0) : nouvelles fonctionnalités compatibles
- **PATCH** (x.y.Z) : corrections de bugs compatibles
