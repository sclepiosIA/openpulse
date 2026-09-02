#!/bin/bash

# Script de configuration initiale pour le dev container
set -e

echo "🚀 Configuration de l'environnement de développement OpenPulse Manager..."

# Installation des outils globaux utiles
echo "📦 Installation des outils de développement..."
npm install -g @storybook/cli
npm install -g lighthouse
npm install -g @playwright/test

# Configuration Git (si pas encore fait)
if [ -z "$(git config --global user.name)" ]; then
    echo "⚙️ Configuration Git recommandée..."
    echo "Veuillez configurer votre nom: git config --global user.name 'Votre Nom'"
    echo "Veuillez configurer votre email: git config --global user.email 'votre@email.com'"
fi

# Création des dossiers de développement
echo "📁 Création des dossiers de développement..."
mkdir -p .vscode/settings.json
mkdir -p docs/development
mkdir -p logs/development

# Installation des dépendances avec cache optimisé
echo "📦 Installation des dépendances du projet..."
npm ci --cache /tmp/npm-cache

# Configuration des hooks Git
echo "🔧 Configuration des hooks Git..."
npx husky install || echo "Husky non configuré, continuons..."

# Vérification de l'environnement
echo "✅ Vérification de l'environnement..."
node --version
npm --version
echo "TypeScript: $(npx tsc --version)"
echo "Vite: $(npx vite --version)"

# Génération du fichier d'environnement de développement
if [ ! -f ".env.local" ]; then
    echo "🔑 Création du fichier .env.local pour le développement..."
    cat > .env.local << EOF
# Environnement de développement
NODE_ENV=development
VITE_APP_ENV=development

# Supabase - Set your project values
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY_HERE

# Analytics de développement (optionnel)
VITE_PLAUSIBLE_DOMAIN=localhost
VITE_PLAUSIBLE_API_HOST=http://localhost:8080
VITE_MATOMO_SITE_ID=1
VITE_MATOMO_TRACKER_URL=http://localhost:8080

# Monitoring de développement
VITE_OTEL_ENDPOINT=http://localhost:4318/v1/traces
VITE_SENTRY_DSN=

# Debug
VITE_DEBUG_MODE=true
EOF
fi

# Build initial pour vérifier que tout fonctionne
echo "🏗️ Build initial de vérification..."
npm run build

echo "✅ Configuration terminée ! L'environnement de développement est prêt."
echo ""
echo "🎉 Commandes disponibles :"
echo "  npm run dev          - Démarrer le serveur de développement"
echo "  npm run build        - Build de production"
echo "  npm run test         - Lancer les tests"
echo "  npm run lint         - Vérifier le code"
echo "  npm run storybook    - Démarrer Storybook"
echo "  npm run lighthouse   - Audit Lighthouse"
echo ""
echo "📊 Services de monitoring :"
echo "  http://localhost:9090  - Prometheus"
echo "  http://localhost:3100  - Loki (Logs)"
echo "  http://localhost:3200  - Tempo (Tracing)"
echo ""
echo "🚀 Prêt à développer !"
