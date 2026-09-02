# Archive `bun.lock.legacy`

Le projet a été migré de Bun à **npm@10.9.0** (cf. `package.json` → `packageManager`).
Le lockfile historique `bun.lock` est conservé ici à des fins d'audit/traçabilité.

- **Ne pas** restaurer à la racine : le garde-fou `scripts/lockfile-guard.mjs` échouera en CI.
- Source de vérité : `package-lock.json` à la racine.
- Audit du 2026-06-06 : conformité « un seul gestionnaire de paquets » (quick-win #3).
