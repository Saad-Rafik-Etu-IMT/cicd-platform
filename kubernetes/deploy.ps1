# ========================================
# Script de déploiement Kubernetes (Windows PowerShell)
# Plateforme CI/CD
# ========================================

param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "build", "status", "urls", "cleanup", "help")]
    [string]$Command = "deploy",
    
    [string]$Registry = "docker.io",
    [string]$ImageTag = "latest",
    [switch]$PushImages,
    [switch]$DeployIngress,
    [switch]$DeployHPA,
    [switch]$DeployNetworkPolicies
)

# Configuration
$Namespace = "cicd-platform"
$ScriptDir = $PSScriptRoot

# Fonctions utilitaires
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

# Vérifier les prérequis
function Test-Prerequisites {
    Write-Info "Vérification des prérequis..."
    
    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
        Write-Err "kubectl n'est pas installé"
        exit 1
    }
    
    try {
        kubectl cluster-info 2>&1 | Out-Null
    } catch {
        Write-Err "Impossible de se connecter au cluster Kubernetes"
        exit 1
    }
    
    Write-Success "Prérequis OK"
}

# Construire les images Docker
function Build-Images {
    Write-Info "Construction des images Docker..."
    
    # Backend
    Write-Info "Construction de l'image backend..."
    docker build -t "$Registry/cicd-backend:$ImageTag" "$ScriptDir\..\backend\"
    
    # Frontend
    Write-Info "Construction de l'image frontend..."
    docker build -t "$Registry/cicd-frontend:$ImageTag" "$ScriptDir\..\frontend\" `
        --build-arg VITE_API_URL=http://localhost:3002 `
        --build-arg VITE_WS_URL=ws://localhost:3002
    
    if ($PushImages) {
        Write-Info "Push des images vers le registry..."
        docker push "$Registry/cicd-backend:$ImageTag"
        docker push "$Registry/cicd-frontend:$ImageTag"
    }
    
    Write-Success "Images construites avec succès"
}

# Déployer sur Kubernetes
function Deploy-Platform {
    Write-Info "Déploiement sur Kubernetes..."
    
    # Créer le namespace
    Write-Info "Création du namespace..."
    kubectl apply -f "$ScriptDir\namespace.yaml"
    
    # Appliquer les ConfigMaps
    Write-Info "Application des ConfigMaps..."
    kubectl apply -f "$ScriptDir\configmap.yaml"
    kubectl apply -f "$ScriptDir\postgres-init-configmap.yaml"
    
    # Appliquer les Secrets
    Write-Info "Application des Secrets..."
    kubectl apply -f "$ScriptDir\secrets.yaml"
    
    # Déployer les bases de données
    Write-Info "Déploiement de PostgreSQL..."
    kubectl apply -f "$ScriptDir\postgres.yaml"
    
    Write-Info "Déploiement de Redis..."
    kubectl apply -f "$ScriptDir\redis.yaml"
    
    # Attendre que les bases de données soient prêtes
    Write-Info "Attente de PostgreSQL..."
    kubectl wait --for=condition=ready pod -l app=cicd-postgres -n $Namespace --timeout=120s 2>&1 | Out-Null
    
    Write-Info "Attente de Redis..."
    kubectl wait --for=condition=ready pod -l app=cicd-redis -n $Namespace --timeout=60s 2>&1 | Out-Null
    
    # Déployer SonarQube
    Write-Info "Déploiement de SonarQube..."
    kubectl apply -f "$ScriptDir\sonarqube.yaml"
    
    # Déployer Backend et Frontend
    Write-Info "Déploiement du Backend..."
    kubectl apply -f "$ScriptDir\backend.yaml"
    
    Write-Info "Déploiement du Frontend..."
    kubectl apply -f "$ScriptDir\frontend.yaml"
    
    # Appliquer l'Ingress (optionnel)
    if ($DeployIngress) {
        Write-Info "Application de l'Ingress..."
        kubectl apply -f "$ScriptDir\ingress.yaml"
    }
    
    # Appliquer le HPA (optionnel)
    if ($DeployHPA) {
        Write-Info "Application du HPA..."
        kubectl apply -f "$ScriptDir\hpa.yaml"
    }
    
    # Appliquer les Network Policies (optionnel)
    if ($DeployNetworkPolicies) {
        Write-Info "Application des Network Policies..."
        kubectl apply -f "$ScriptDir\network-policy.yaml"
    }
    
    Write-Success "Déploiement terminé !"
}

# Afficher le statut
function Get-Status {
    Write-Info "Statut du déploiement..."
    Write-Host ""
    kubectl get all -n $Namespace
    Write-Host ""
    Write-Info "Services NodePort disponibles:"
    kubectl get svc -n $Namespace -o wide | Select-String "NodePort"
}

# Afficher les URLs d'accès
function Get-Urls {
    Write-Info "URLs d'accès..."
    
    # Obtenir l'IP du nœud
    $NodeIP = kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'
    
    Write-Host ""
    Write-Host "Frontend:  http://${NodeIP}:30000"
    Write-Host "Backend:   http://${NodeIP}:30002"
    Write-Host "SonarQube: http://${NodeIP}:30090"
    Write-Host ""
    
    Write-Info "Pour accéder via port-forward:"
    Write-Host "kubectl port-forward svc/cicd-frontend 3000:80 -n $Namespace"
    Write-Host "kubectl port-forward svc/cicd-backend 3002:3002 -n $Namespace"
    Write-Host "kubectl port-forward svc/cicd-sonarqube 9000:9000 -n $Namespace"
}

# Nettoyer le déploiement
function Remove-Deployment {
    Write-Warn "Suppression du déploiement..."
    kubectl delete namespace $Namespace --ignore-not-found
    Write-Success "Nettoyage terminé"
}

# Afficher l'aide
function Show-Help {
    Write-Host @"
Usage: .\deploy.ps1 [Command] [Options]

Commands:
  deploy              Déployer la plateforme sur Kubernetes (défaut)
  build               Construire les images Docker
  status              Afficher le statut du déploiement
  urls                Afficher les URLs d'accès
  cleanup             Supprimer le déploiement
  help                Afficher cette aide

Options:
  -Registry           Registry Docker (default: docker.io)
  -ImageTag           Tag des images (default: latest)
  -PushImages         Pousser les images vers le registry
  -DeployIngress      Déployer l'Ingress
  -DeployHPA          Déployer le HPA
  -DeployNetworkPolicies  Déployer les Network Policies

Exemples:
  .\deploy.ps1 deploy
  .\deploy.ps1 build -PushImages
  .\deploy.ps1 deploy -DeployIngress -DeployHPA
  .\deploy.ps1 cleanup
"@
}

# Main
switch ($Command) {
    "deploy" {
        Test-Prerequisites
        Deploy-Platform
        Get-Status
        Get-Urls
    }
    "build" {
        Build-Images
    }
    "status" {
        Get-Status
    }
    "urls" {
        Get-Urls
    }
    "cleanup" {
        Remove-Deployment
    }
    "help" {
        Show-Help
    }
    default {
        Write-Err "Commande inconnue: $Command"
        Show-Help
        exit 1
    }
}
