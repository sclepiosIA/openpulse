#!/bin/bash

# Script de démarrage rapide pour finaliser la trésorerie
# Exécute l'import Excel et déclenche les edge functions

set -e  # Arrêter en cas d'erreur

echo "=================================================="
echo "   FINALISATION TRÉSORERIE - Script rapide"
echo "=================================================="
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables - MUST be set via environment
if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_ANON_KEY environment variable not set${NC}"
    echo "Please set: export SUPABASE_ANON_KEY='your-key-here'"
    exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}❌ SUPABASE_URL environment variable not set${NC}"
    echo "Please set: export SUPABASE_URL='https://your-project.supabase.co'"
    exit 1
fi

# ÉTAPE 1: Import Python
echo -e "${BLUE}📊 ÉTAPE 1/3: Import historique salaires (Jan-Oct 2025)${NC}"
echo "---------------------------------------------------"

cd scripts
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 n'est pas installé${NC}"
    exit 1
fi

echo "Installation des dépendances Python..."
pip install -q -r requirements.txt

echo "Exécution de l'import..."
python3 import_excel_tresorerie.py

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Import terminé avec succès${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'import${NC}"
    exit 1
fi

cd ..
echo ""

# ÉTAPE 2: Génération recettes
echo -e "${BLUE}💰 ÉTAPE 2/3: Génération recettes futures (36 mois)${NC}"
echo "---------------------------------------------------"

RESULT=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/generate-future-revenues" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --data '{}')

echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"

if echo "$RESULT" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Recettes générées avec succès${NC}"
else
    echo -e "${RED}⚠️ Erreur lors de la génération des recettes${NC}"
fi

echo ""

# ÉTAPE 3: Génération dépenses récurrentes
echo -e "${BLUE}🔄 ÉTAPE 3/3: Génération dépenses récurrentes${NC}"
echo "---------------------------------------------------"

RESULT=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/generate-recurring-expenses" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  --data '{}')

echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"

if echo "$RESULT" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Dépenses récurrentes générées avec succès${NC}"
else
    echo -e "${RED}⚠️ Erreur lors de la génération des dépenses${NC}"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}   ✅ FINALISATION TERMINÉE${NC}"
echo "=================================================="
echo ""
echo "Prochaines étapes:"
echo "1. Vérifier les données dans Supabase (voir TRESORERIE_EXECUTION_GUIDE.md)"
echo "2. Tester l'interface Trésorerie"
echo "3. Valider la synchronisation RH ↔ Trésorerie"
echo ""
echo "Pour plus de détails, voir: TRESORERIE_EXECUTION_GUIDE.md"
echo ""
