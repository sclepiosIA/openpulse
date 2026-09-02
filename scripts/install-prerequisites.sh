#!/bin/bash
# ============================================
# Script d'Installation des Prérequis
# OpenPulse - Installation On-Premise
# ============================================
#
# Ce script installe automatiquement tous les prérequis
# nécessaires pour déployer OpenPulse on-premise.
#
# Testé sur:
#   - Ubuntu 22.04 LTS
#   - Debian 12
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/.../install-prerequisites.sh | bash
#   # ou
#   ./scripts/install-prerequisites.sh
#
# ============================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
log_step() { echo -e "\n${CYAN}${BOLD}[$1]${NC} $2"; }

# Vérifier qu'on est root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Ce script doit être exécuté en tant que root (sudo)"
    fi
}

# Détecter l'OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VERSION=$VERSION_ID
    else
        log_error "Système d'exploitation non supporté"
    fi
    
    log_info "Système détecté: $OS $VERSION"
}

# Afficher le banner
show_banner() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}                                                           ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   ${BOLD}🏥 Installation des Prérequis - OpenPulse${NC}           ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                           ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   Ce script va installer:                                ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   • Docker & Docker Compose                              ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   • Git                                                  ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   • Utilitaires (curl, nano, htop)                       ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   • Configuration pare-feu (UFW)                         ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}   • Fail2ban pour la sécurité                            ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                           ${CYAN}║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Mise à jour du système
update_system() {
    log_step "1/8" "Mise à jour du système..."
    
    apt-get update -qq
    apt-get upgrade -y -qq
    
    log_success "Système mis à jour"
}

# Installation des utilitaires de base
install_utilities() {
    log_step "2/8" "Installation des utilitaires..."
    
    apt-get install -y -qq \
        curl \
        wget \
        nano \
        vim \
        htop \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    log_success "Utilitaires installés"
}

# Installation de Docker
install_docker() {
    log_step "3/8" "Installation de Docker..."
    
    # Vérifier si Docker est déjà installé
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | tr -d ',')
        log_info "Docker déjà installé: version $DOCKER_VERSION"
        
        # Vérifier la version minimum
        MAJOR_VERSION=$(echo $DOCKER_VERSION | cut -d '.' -f1)
        if [[ $MAJOR_VERSION -ge 24 ]]; then
            log_success "Version Docker OK (≥ 24.0)"
            return
        else
            log_warning "Version Docker trop ancienne, mise à jour..."
        fi
    fi
    
    # Désinstaller les anciennes versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Ajouter la clé GPG officielle Docker
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Ajouter le repository Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Installer Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Démarrer et activer Docker
    systemctl start docker
    systemctl enable docker
    
    # Vérifier l'installation
    docker --version
    
    log_success "Docker installé avec succès"
}

# Installation de Docker Compose (standalone)
install_docker_compose() {
    log_step "4/8" "Installation de Docker Compose..."
    
    # Vérifier si Docker Compose est déjà disponible
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version | grep -oP '\d+\.\d+\.\d+' | head -1)
        log_info "Docker Compose déjà installé: version $COMPOSE_VERSION"
        log_success "Version Docker Compose OK"
        return
    fi
    
    # Installer la version standalone si nécessaire
    COMPOSE_VERSION="2.24.0"
    curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Créer un lien symbolique
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    # Vérifier
    docker-compose --version
    
    log_success "Docker Compose installé"
}

# Configuration du pare-feu
configure_firewall() {
    log_step "5/8" "Configuration du pare-feu (UFW)..."
    
    # Installer UFW si nécessaire
    apt-get install -y -qq ufw
    
    # Réinitialiser UFW
    ufw --force reset
    
    # Configuration par défaut
    ufw default deny incoming
    ufw default allow outgoing
    
    # Autoriser SSH (port 22 par défaut)
    ufw allow 22/tcp comment 'SSH'
    
    # Autoriser HTTP et HTTPS
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Activer UFW
    echo "y" | ufw enable
    
    log_success "Pare-feu configuré"
    log_info "Ports ouverts: 22 (SSH), 80 (HTTP), 443 (HTTPS)"
}

# Installation de Fail2ban
install_fail2ban() {
    log_step "6/8" "Installation de Fail2ban..."
    
    apt-get install -y -qq fail2ban
    
    # Configuration de base pour SSH
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF
    
    # Redémarrer Fail2ban
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_success "Fail2ban installé et configuré"
}

# Création du répertoire projet
create_project_directory() {
    log_step "7/8" "Création du répertoire projet..."
    
    PROJECT_DIR="/opt/marque"
    
    if [[ -d "$PROJECT_DIR" ]]; then
        log_info "Répertoire $PROJECT_DIR existe déjà"
    else
        mkdir -p "$PROJECT_DIR"
        log_success "Répertoire créé: $PROJECT_DIR"
    fi
    
    # Créer les répertoires de backup et logs
    mkdir -p /backups
    mkdir -p /var/log/marque
    
    log_success "Répertoires créés"
}

# Afficher le résumé
show_summary() {
    log_step "8/8" "Vérification finale..."
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                                                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}   ${BOLD}✓ Installation des prérequis terminée!${NC}                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                           ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${BOLD}Versions installées:${NC}"
    echo -e "  • Docker:         $(docker --version 2>/dev/null | cut -d ' ' -f3 | tr -d ',' || echo 'Non installé')"
    echo -e "  • Docker Compose: $(docker compose version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1 || echo 'Non installé')"
    echo -e "  • Git:            $(git --version 2>/dev/null | cut -d ' ' -f3 || echo 'Non installé')"
    echo ""
    
    echo -e "${BOLD}Configuration réseau:${NC}"
    echo -e "  • UFW (Pare-feu): $(ufw status 2>/dev/null | head -1)"
    echo -e "  • Fail2ban:       $(systemctl is-active fail2ban 2>/dev/null || echo 'Non actif')"
    echo ""
    
    echo -e "${BOLD}Répertoires créés:${NC}"
    echo -e "  • /opt/marque   (projet)"
    echo -e "  • /backups        (sauvegardes)"
    echo -e "  • /var/log/marque (logs)"
    echo ""
    
    echo -e "${BOLD}Prochaines étapes:${NC}"
    echo ""
    echo "  1. Cloner le projet:"
    echo -e "     ${CYAN}cd /opt/marque${NC}"
    echo -e "     ${CYAN}git clone https://github.com/VOTRE_ORG/marque-ia.git .${NC}"
    echo ""
    echo "  2. Configurer l'environnement:"
    echo -e "     ${CYAN}cd docker${NC}"
    echo -e "     ${CYAN}cp .env.example .env${NC}"
    echo -e "     ${CYAN}nano .env${NC}"
    echo ""
    echo "  3. Lancer le déploiement:"
    echo -e "     ${CYAN}chmod +x scripts/deploy.sh${NC}"
    echo -e "     ${CYAN}./scripts/deploy.sh${NC}"
    echo ""
    echo -e "${YELLOW}Consultez la documentation complète: docs/QUICK_START_ON_PREMISE.md${NC}"
    echo ""
}

# ============================================
# MAIN
# ============================================

show_banner

log_info "Démarrage de l'installation..."
echo ""

check_root
detect_os

# Exécuter les étapes
update_system
install_utilities
install_docker
install_docker_compose
configure_firewall
install_fail2ban
create_project_directory
show_summary

log_success "Installation terminée avec succès! 🎉"
