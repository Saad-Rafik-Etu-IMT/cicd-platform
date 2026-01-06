#!/bin/bash
# ========================================
# Script de déploiement Kubernetes
# Plateforme CI/CD
# ========================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
NAMESPACE="cicd-platform"
REGISTRY="${REGISTRY:-docker.io}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl n'est pas installé"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Impossible de se connecter au cluster Kubernetes"
        exit 1
    fi
    
    log_success "Prérequis OK"
}

# Construire et pousser les images Docker
build_images() {
    log_info "Construction des images Docker..."
    
    # Backend
    log_info "Construction de l'image backend..."
    docker build -t ${REGISTRY}/cicd-backend:${IMAGE_TAG} ../backend/
    
    # Frontend
    log_info "Construction de l'image frontend..."
    docker build -t ${REGISTRY}/cicd-frontend:${IMAGE_TAG} ../frontend/ \
        --build-arg VITE_API_URL=http://localhost:3002 \
        --build-arg VITE_WS_URL=ws://localhost:3002
    
    if [ "$PUSH_IMAGES" = "true" ]; then
        log_info "Push des images vers le registry..."
        docker push ${REGISTRY}/cicd-backend:${IMAGE_TAG}
        docker push ${REGISTRY}/cicd-frontend:${IMAGE_TAG}
    fi
    
    log_success "Images construites avec succès"
}

# Déployer sur Kubernetes
deploy() {
    log_info "Déploiement sur Kubernetes..."
    
    # Créer le namespace
    log_info "Création du namespace..."
    kubectl apply -f ${SCRIPT_DIR}/namespace.yaml
    
    # Appliquer les ConfigMaps
    log_info "Application des ConfigMaps..."
    kubectl apply -f ${SCRIPT_DIR}/configmap.yaml
    kubectl apply -f ${SCRIPT_DIR}/postgres-init-configmap.yaml
    
    # Appliquer les Secrets
    log_info "Application des Secrets..."
    kubectl apply -f ${SCRIPT_DIR}/secrets.yaml
    
    # Déployer les bases de données
    log_info "Déploiement de PostgreSQL..."
    kubectl apply -f ${SCRIPT_DIR}/postgres.yaml
    
    log_info "Déploiement de Redis..."
    kubectl apply -f ${SCRIPT_DIR}/redis.yaml
    
    # Attendre que les bases de données soient prêtes
    log_info "Attente de PostgreSQL..."
    kubectl wait --for=condition=ready pod -l app=cicd-postgres -n ${NAMESPACE} --timeout=120s || true
    
    log_info "Attente de Redis..."
    kubectl wait --for=condition=ready pod -l app=cicd-redis -n ${NAMESPACE} --timeout=60s || true
    
    # Déployer SonarQube
    log_info "Déploiement de SonarQube..."
    kubectl apply -f ${SCRIPT_DIR}/sonarqube.yaml
    
    # Déployer Backend et Frontend
    log_info "Déploiement du Backend..."
    kubectl apply -f ${SCRIPT_DIR}/backend.yaml
    
    log_info "Déploiement du Frontend..."
    kubectl apply -f ${SCRIPT_DIR}/frontend.yaml
    
    # Appliquer l'Ingress (optionnel)
    if [ "$DEPLOY_INGRESS" = "true" ]; then
        log_info "Application de l'Ingress..."
        kubectl apply -f ${SCRIPT_DIR}/ingress.yaml
    fi
    
    # Appliquer le HPA (optionnel)
    if [ "$DEPLOY_HPA" = "true" ]; then
        log_info "Application du HPA..."
        kubectl apply -f ${SCRIPT_DIR}/hpa.yaml
    fi
    
    # Appliquer les Network Policies (optionnel)
    if [ "$DEPLOY_NETWORK_POLICIES" = "true" ]; then
        log_info "Application des Network Policies..."
        kubectl apply -f ${SCRIPT_DIR}/network-policy.yaml
    fi
    
    log_success "Déploiement terminé !"
}

# Afficher le statut
status() {
    log_info "Statut du déploiement..."
    echo ""
    kubectl get all -n ${NAMESPACE}
    echo ""
    log_info "Services NodePort disponibles:"
    kubectl get svc -n ${NAMESPACE} -o wide | grep NodePort
}

# Afficher les URLs d'accès
urls() {
    log_info "URLs d'accès..."
    
    # Obtenir l'IP du nœud
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
    
    echo ""
    echo "Frontend:  http://${NODE_IP}:30000"
    echo "Backend:   http://${NODE_IP}:30002"
    echo "SonarQube: http://${NODE_IP}:30090"
    echo ""
    
    log_info "Pour accéder via port-forward:"
    echo "kubectl port-forward svc/cicd-frontend 3000:80 -n ${NAMESPACE}"
    echo "kubectl port-forward svc/cicd-backend 3002:3002 -n ${NAMESPACE}"
    echo "kubectl port-forward svc/cicd-sonarqube 9000:9000 -n ${NAMESPACE}"
}

# Nettoyer le déploiement
cleanup() {
    log_warning "Suppression du déploiement..."
    kubectl delete namespace ${NAMESPACE} --ignore-not-found
    log_success "Nettoyage terminé"
}

# Afficher l'aide
help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy              Déployer la plateforme sur Kubernetes"
    echo "  build               Construire les images Docker"
    echo "  status              Afficher le statut du déploiement"
    echo "  urls                Afficher les URLs d'accès"
    echo "  cleanup             Supprimer le déploiement"
    echo "  help                Afficher cette aide"
    echo ""
    echo "Variables d'environnement:"
    echo "  REGISTRY            Registry Docker (default: docker.io)"
    echo "  IMAGE_TAG           Tag des images (default: latest)"
    echo "  PUSH_IMAGES         Pousser les images (default: false)"
    echo "  DEPLOY_INGRESS      Déployer l'Ingress (default: false)"
    echo "  DEPLOY_HPA          Déployer le HPA (default: false)"
    echo "  DEPLOY_NETWORK_POLICIES  Déployer les Network Policies (default: false)"
}

# Main
case "${1:-deploy}" in
    deploy)
        check_prerequisites
        deploy
        status
        urls
        ;;
    build)
        build_images
        ;;
    status)
        status
        ;;
    urls)
        urls
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        help
        ;;
    *)
        log_error "Commande inconnue: $1"
        help
        exit 1
        ;;
esac
