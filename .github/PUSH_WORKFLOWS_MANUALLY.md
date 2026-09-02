# ⚠️ 5 workflows CI à pousser manuellement

**Statut** : Préparés et validés localement le 27/05/2026, mais bloqués au push
car le token OAuth Claude Code n'a pas le scope `workflow` requis par GitHub
pour publier des `.github/workflows/*.yml`.

## Fichiers concernés (présents en working tree, untracked)

| Workflow | Description | Triggers |
|----------|-------------|----------|
| `codeql.yml` | CodeQL TypeScript/JS security-extended + React patterns | push main/develop + PR + cron Dim 03h UTC |
| `security-audit.yml` | Gitleaks + Semgrep + npm audit + tsc strict + ESLint + SBOM CycloneDX | PR + push main + cron Lun 09h UTC |
| `pentest-smoke.yml` | Security headers + TLS + secrets inline | PR + manual |
| `mutation-testing.yml` | StrykerJS mutation score hebdomadaire (baseline 50%) | cron Dim 04h UTC |
| `k6.yml` | Load tests (smoke / standard / stress / spike / soak / morning_peak) | PR + cron Dim 05h UTC |

Tous SHA-pinned (actions/checkout v6.0.2, actions/setup-node v6.4.0,
step-security/harden-runner v2.12.0) — NIS2 / OWASP A02 compliance.

## Comment pousser ces fichiers

### Option A — Refresh du token gh avec scope workflow (recommandé)

```bash
gh auth refresh -s workflow --hostname github.com
# Suivre le flow OAuth (ouverture navigateur, code)

cd "/path/to/marque-client-compass"
git add .github/workflows/codeql.yml \
        .github/workflows/k6.yml \
        .github/workflows/mutation-testing.yml \
        .github/workflows/pentest-smoke.yml \
        .github/workflows/security-audit.yml

git commit -m "ci(security): wire up 5 production-ready workflows (codeql + k6 + mutation + pentest-smoke + security-audit)

Workflows production-grade avec SHA-pinning + step-security/harden-runner.
Triggers et budgets détaillés dans .github/PUSH_WORKFLOWS_MANUALLY.md.

NIS2 / OWASP A02 compliance."

git push origin main
```

### Option B — Push via une session normale (compte humain)

Ouvrir un terminal local avec accès SSH GitHub (port 22 ou via authentification HTTPS
classique avec un PAT scope `workflow`) et exécuter les commandes du bloc ci-dessus.

### Option C — Via GitHub web UI

1. Ouvrir https://github.com/marqueIA/marque-client-compass
2. Créer chaque fichier via "Add file → Create new file"
3. Copier-coller le contenu depuis le working tree local
4. Commit message identique à l'Option A

## Après push

Supprimer ce fichier :
```bash
rm .github/PUSH_WORKFLOWS_MANUALLY.md
git add -A && git commit -m "chore: remove workflow push reminder (5 workflows now pushed)"
```

---

*Créé : 2026-05-27 (session #11). Auteur : agent Claude — token sans scope `workflow`.*
