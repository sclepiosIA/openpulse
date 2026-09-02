# Dev Container - Onboarding instantané en < 2 minutes ⚡

## 🚀 Nouvel arrivant opérationnel en moins de 2 minutes

### 1. Prérequis (30 secondes)
- Docker Desktop installé
- VS Code + Extension "Dev Containers"
- Git configuré

### 2. Ouverture du projet (60 secondes)
```bash
# Cloner le projet
git clone https://github.com/votre-org/marque-manager.git
cd marque-manager

# Ouvrir dans VS Code
code .

# Cliquer sur "Reopen in Container" (popup automatique)
# OU Ctrl+Shift+P > "Dev Containers: Rebuild and Reopen in Container"
```

### 3. Configuration automatique (30 secondes)
Le container se configure automatiquement :
- ✅ Installation Node.js 20 + npm
- ✅ Installation des dépendances
- ✅ Configuration VS Code avec extensions
- ✅ Build initial de vérification
- ✅ Démarrage du serveur de développement

**Total : < 2 minutes jusqu'à l'app fonctionnelle ! 🎉**

## 🛠️ Environnement complet inclus

### Services intégrés
- **App OpenPulse** : http://localhost:3000
- **Vite Dev Server** : http://localhost:5173
- **Storybook** : http://localhost:8080
- **Prometheus** : http://localhost:9090
- **Grafana Loki** : http://localhost:3100
- **PostgreSQL Dev** : localhost:5432
- **Redis Cache** : localhost:6379

### Outils pré-installés
- TypeScript + Node.js 20
- Vite + Hot Reload
- ESLint + Prettier
- Playwright pour les tests
- Lighthouse pour l'audit
- Git + GitHub CLI
- Docker support

### Extensions VS Code automatiques
- TypeScript
- Tailwind CSS IntelliSense
- ESLint + Prettier
- Auto Rename Tag
- Path Intellisense
- GitHub Copilot
- Playwright Test Runner

## 🔧 Configuration avancée

### Personnalisation utilisateur
Le container s'adapte automatiquement :
- Configuration Git existante préservée
- Extensions VS Code personnalisées supportées
- Settings utilisateur synchronisés
- SSH keys montées automatiquement

### Développement multi-plateforme
- ✅ **Windows** : WSL2 + Docker Desktop
- ✅ **macOS** : Docker Desktop natif
- ✅ **Linux** : Docker CE + VS Code

### Performance optimisée
- Cache des dépendances npm partagé
- Bind mounts avec consistency cached
- Volumes Docker pour la persistance
- Hot reload ultra-rapide

## 📋 Commandes disponibles

```bash
# Dans le terminal du container
npm run dev          # Serveur de développement
npm run build        # Build de production  
npm run test         # Tests unitaires
npm run e2e          # Tests end-to-end
npm run lint         # Vérification du code
npm run storybook    # Interface Storybook
npm run lighthouse   # Audit de performance
```

## 🌐 GitHub Codespaces

### Configuration 1-click
Le même environnement fonctionne sur GitHub Codespaces :

1. Aller sur le repository GitHub
2. Cliquer "Code" > "Codespaces" > "Create codespace"
3. Attendre 2 minutes → Environnement prêt !

### Avantages Codespaces
- ✅ Aucune installation locale
- ✅ Machine puissante (4 cores, 8GB RAM)
- ✅ Accès depuis n'importe où
- ✅ VS Code Web intégré
- ✅ Collaboration en temps réel

## 🚀 Script d'onboarding

Le script `.devcontainer/scripts/setup-dev.sh` gère :
- Installation des outils globaux
- Configuration Git si nécessaire
- Création des dossiers de développement
- Génération du `.env.local`
- Build de vérification
- Guide des commandes disponibles

## 📊 Monitoring intégré

Même en développement, le monitoring est disponible :
- **Performance** : Core Web Vitals en temps réel
- **Logs** : Centralisés dans Loki
- **Métriques** : Collectées par Prometheus
- **Tracing** : OpenTelemetry + Tempo

## 🎯 Cas d'usage

### Pour les nouveaux développeurs
1. Clone → Open in Container → Développer
2. Environnement identique pour toute l'équipe
3. Pas de "ça marche sur ma machine"

### Pour les contributeurs externes
1. Fork → Codespaces → Contribuer
2. Pas d'installation locale nécessaire
3. Review et test en un clic

### Pour les démonstrations
1. Codespaces → Share URL → Présenter
2. Environnement complet en live
3. Collaboration en temps réel

**Résultat : Onboarding instantané, développement frictionless ! ⚡**