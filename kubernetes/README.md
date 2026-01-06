# ☸️ Guide Complet - Déploiement Kubernetes CI/CD Platform

**Objectif :** Déployer la plateforme CI/CD sur un cluster Kubernetes pour une scalabilité et résilience optimales.

**Durée estimée :** 20-30 minutes

---

## 📋 Table des Matières

1. [Présentation](#1--présentation)
2. [Architecture Kubernetes](#2--architecture-kubernetes)
3. [Prérequis](#3--prérequis)
4. [Installation du Cluster](#4--installation-du-cluster)
5. [Construction des Images](#5--construction-des-images)
6. [Déploiement](#6--déploiement)
7. [Accès aux Services](#7--accès-aux-services)
8. [Configuration Avancée](#8--configuration-avancée)
9. [Monitoring & Observabilité](#9--monitoring--observabilité)
10. [Sécurité](#10--sécurité)
11. [Auto-scaling](#11--auto-scaling)
12. [Mises à jour & Rollback](#12--mises-à-jour--rollback)
13. [Dépannage](#13--dépannage)
14. [Commandes Utiles](#14--commandes-utiles)

---

## 1. 🎯 Présentation

### Pourquoi Kubernetes ?

| Aspect | Docker Compose | Kubernetes |
|--------|----------------|------------|
| **Scalabilité** | Manuelle | Automatique (HPA) |
| **Haute disponibilité** | ❌ | ✅ Multi-replicas |
| **Rolling updates** | Basique | ✅ Zero-downtime |
| **Self-healing** | ❌ | ✅ Restart automatique |
| **Load balancing** | Manuel | ✅ Intégré |
| **Secrets management** | Fichiers .env | ✅ Secrets K8s |
| **Complexité** | Simple | Moyenne |

**➡️ Recommandation :** Kubernetes pour la production, Docker Compose pour le développement local.

### Structure des Fichiers

```
kubernetes/
├── 📁 Manifests principaux
│   ├── namespace.yaml              # Namespace dédié cicd-platform
│   ├── configmap.yaml              # Configuration des applications
│   ├── postgres-init-configmap.yaml # Script init PostgreSQL
│   ├── secrets.yaml                # Credentials & tokens
│   │
│   ├── postgres.yaml               # 🗄️ PostgreSQL (CI/CD DB)
│   ├── redis.yaml                  # 📮 Redis (Queue jobs)
│   ├── backend.yaml                # ⚙️ API Backend Node.js
│   ├── frontend.yaml               # 🌐 Dashboard React/Nginx
│   ├── sonarqube.yaml              # 📊 SonarQube + PostgreSQL
│   │
├── 📁 Optionnels
│   ├── ingress.yaml                # 🌍 Ingress Controller
│   ├── hpa.yaml                    # ⚡ Horizontal Pod Autoscaler
│   ├── network-policy.yaml         # 🔒 Politiques réseau
│   │
├── 📁 Outils
│   ├── kustomization.yaml          # Configuration Kustomize
│   ├── deploy.sh                   # Script déploiement (Linux/Mac)
│   ├── deploy.ps1                  # Script déploiement (Windows)
│   └── README.md                   # Cette documentation
```

---

## 2. 🏗️ Architecture Kubernetes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            KUBERNETES CLUSTER                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Namespace: cicd-platform                          │  │
│  │                                                                        │  │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │  │
│  │  │  Ingress    │────▶│  Frontend   │     │       SonarQube         │  │  │
│  │  │  Controller │     │  (2 pods)   │     │       (1 pod)           │  │  │
│  │  └─────────────┘     └─────────────┘     └───────────┬─────────────┘  │  │
│  │         │                   │                        │                 │  │
│  │         │                   │                        ▼                 │  │
│  │         │                   │            ┌─────────────────────────┐  │  │
│  │         │                   │            │   SonarQube DB          │  │  │
│  │         ▼                   ▼            │   (PostgreSQL)          │  │  │
│  │  ┌─────────────────────────────────┐     └─────────────────────────┘  │  │
│  │  │         Backend API             │                                   │  │
│  │  │         (2 pods, HPA)           │                                   │  │
│  │  └───────────┬─────────────────────┘                                   │  │
│  │              │                                                         │  │
│  │     ┌───────┴───────┐                                                 │  │
│  │     ▼               ▼                                                 │  │
│  │  ┌──────────┐  ┌──────────┐                                           │  │
│  │  │PostgreSQL│  │  Redis   │                                           │  │
│  │  │  (1 pod) │  │  (1 pod) │                                           │  │
│  │  │   PVC    │  │   PVC    │                                           │  │
│  │  └──────────┘  └──────────┘                                           │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Services et Ports

| Service | Type | Port Interne | NodePort | Description |
|---------|------|--------------|----------|-------------|
| `cicd-frontend` | ClusterIP + NodePort | 80 | 30000 | Dashboard React |
| `cicd-backend` | ClusterIP + NodePort | 3002 | 30002 | API + WebSocket |
| `cicd-sonarqube` | ClusterIP + NodePort | 9000 | 30090 | Analyse qualité |
| `cicd-postgres` | ClusterIP | 5432 | - | Base de données |
| `cicd-redis` | ClusterIP | 6379 | - | Queue jobs |
| `sonar-db` | ClusterIP | 5432 | - | DB SonarQube |

---

## 3. 🛠️ Prérequis

### Outils requis

| Outil | Version | Usage | Installation |
|-------|---------|-------|--------------|
| **kubectl** | 1.28+ | CLI Kubernetes | [Guide](https://kubernetes.io/docs/tasks/tools/) |
| **Docker** | 24+ | Build images | [Guide](https://docs.docker.com/get-docker/) |
| **Cluster K8s** | 1.28+ | Infrastructure | Voir section 4 |

### Vérification des prérequis

```powershell
# Windows PowerShell
kubectl version --client
docker --version
```

```bash
# Linux/Mac
kubectl version --client
docker --version
```

**✅ Sortie attendue :**
```
Client Version: v1.28.x
Docker version 24.x.x
```

---

## 4. 📦 Installation du Cluster

### Option A : Docker Desktop (Windows/Mac) ⭐ Recommandé

**Étape 1 : Activer Kubernetes**
1. Ouvrir Docker Desktop
2. Aller dans **Settings** (⚙️) → **Kubernetes**
3. Cocher **"Enable Kubernetes"**
4. Cliquer **"Apply & Restart"**
5. Attendre que le statut passe au vert (2-5 min)

**Étape 2 : Vérifier l'installation**
```powershell
kubectl cluster-info
kubectl get nodes
```

**✅ Sortie attendue :**
```
Kubernetes control plane is running at https://kubernetes.docker.internal:6443
NAME             STATUS   ROLES           AGE   VERSION
docker-desktop   Ready    control-plane   1m    v1.28.x
```

---

### Option B : Minikube (Toutes plateformes)

**Étape 1 : Installation**

```powershell
# Windows (PowerShell Admin)
choco install minikube -y
# OU via winget
winget install Kubernetes.minikube
```

```bash
# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Mac
brew install minikube
```

**Étape 2 : Démarrer le cluster**
```bash
minikube start --cpus=4 --memory=8192 --driver=docker
```

**Étape 3 : Activer les addons**
```bash
minikube addons enable ingress
minikube addons enable metrics-server
```

**✅ Vérification :**
```bash
minikube status
kubectl get nodes
```

---

### Option C : Kind (Kubernetes in Docker)

```bash
# Installation
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Créer un cluster
kind create cluster --name cicd-cluster
```

---

## 5. 🔨 Construction des Images

### ⚠️ Important pour Minikube
Pour que Minikube utilise les images locales :
```bash
eval $(minikube docker-env)
```

### Étape 5.1 : Construire l'image Backend

```powershell
# Windows PowerShell
cd c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\backend
docker build -t cicd-backend:latest .
```

```bash
# Linux/Mac
cd ~/cicd-platform/backend
docker build -t cicd-backend:latest .
```

**✅ Vérification :**
```bash
docker images | grep cicd-backend
```

### Étape 5.2 : Construire l'image Frontend

```powershell
# Windows PowerShell
cd c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\frontend
docker build -t cicd-frontend:latest `
  --build-arg VITE_API_URL=http://localhost:30002 `
  --build-arg VITE_WS_URL=ws://localhost:30002 .
```

```bash
# Linux/Mac
cd ~/cicd-platform/frontend
docker build -t cicd-frontend:latest \
  --build-arg VITE_API_URL=http://localhost:30002 \
  --build-arg VITE_WS_URL=ws://localhost:30002 .
```

**✅ Vérification :**
```bash
docker images | grep cicd
```

**Sortie attendue :**
```
cicd-backend    latest   abc123   1 minute ago   250MB
cicd-frontend   latest   def456   1 minute ago   50MB
```

---

## 6. 🚀 Déploiement

### Option 1 : Script automatisé ⭐ Recommandé

**Windows PowerShell :**
```powershell
cd c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\kubernetes
.\deploy.ps1 deploy
```

**Linux/Mac :**
```bash
cd kubernetes
chmod +x deploy.sh
./deploy.sh deploy
```

---

### Option 2 : Kustomize

```bash
kubectl apply -k kubernetes/
```

---

### Option 3 : Déploiement manuel étape par étape

**Étape 6.1 : Créer le namespace**
```bash
kubectl apply -f namespace.yaml
```

**Étape 6.2 : Appliquer les configurations**
```bash
kubectl apply -f configmap.yaml
kubectl apply -f postgres-init-configmap.yaml
kubectl apply -f secrets.yaml
```

**Étape 6.3 : Déployer les bases de données**
```bash
kubectl apply -f postgres.yaml
kubectl apply -f redis.yaml

# Attendre que PostgreSQL soit prêt (⏳ ~60s)
kubectl wait --for=condition=ready pod -l app=cicd-postgres -n cicd-platform --timeout=120s
kubectl wait --for=condition=ready pod -l app=cicd-redis -n cicd-platform --timeout=60s
```

**Étape 6.4 : Déployer SonarQube**
```bash
kubectl apply -f sonarqube.yaml

# ⏳ SonarQube prend 2-3 minutes à démarrer
kubectl wait --for=condition=ready pod -l app=cicd-sonarqube -n cicd-platform --timeout=300s
```

**Étape 6.5 : Déployer l'application**
```bash
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml

kubectl wait --for=condition=ready pod -l app=cicd-backend -n cicd-platform --timeout=120s
kubectl wait --for=condition=ready pod -l app=cicd-frontend -n cicd-platform --timeout=60s
```

**✅ Vérification finale :**
```bash
kubectl get all -n cicd-platform
```

**Sortie attendue :**
```
NAME                                  READY   STATUS    RESTARTS   AGE
pod/cicd-backend-xxx                  1/1     Running   0          2m
pod/cicd-backend-yyy                  1/1     Running   0          2m
pod/cicd-frontend-xxx                 1/1     Running   0          1m
pod/cicd-frontend-yyy                 1/1     Running   0          1m
pod/cicd-postgres-xxx                 1/1     Running   0          3m
pod/cicd-redis-xxx                    1/1     Running   0          3m
pod/cicd-sonarqube-xxx                1/1     Running   0          3m
pod/sonar-db-xxx                      1/1     Running   0          3m

NAME                           TYPE        CLUSTER-IP       PORT(S)
service/cicd-backend           ClusterIP   10.96.x.x        3002/TCP
service/cicd-backend-nodeport  NodePort    10.96.x.x        3002:30002/TCP
service/cicd-frontend          ClusterIP   10.96.x.x        80/TCP
service/cicd-frontend-nodeport NodePort    10.96.x.x        80:30000/TCP
service/cicd-sonarqube         ClusterIP   10.96.x.x        9000/TCP
...
```

---

## 7. 🌐 Accès aux Services

### Méthode 1 : NodePort (Développement) ⭐

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:30000 |
| **Backend API** | http://localhost:30002 |
| **SonarQube** | http://localhost:30090 |

> 💡 **Docker Desktop** : Utilisez `localhost`
> 💡 **Minikube** : Utilisez `$(minikube ip)` ou `minikube service cicd-frontend-nodeport -n cicd-platform`

---

### Méthode 2 : Port-Forward (Recommandé pour debug)

Ouvrez 3 terminaux :

**Terminal 1 - Frontend :**
```bash
kubectl port-forward svc/cicd-frontend 3000:80 -n cicd-platform
```
➡️ http://localhost:3000

**Terminal 2 - Backend :**
```bash
kubectl port-forward svc/cicd-backend 3002:3002 -n cicd-platform
```
➡️ http://localhost:3002

**Terminal 3 - SonarQube :**
```bash
kubectl port-forward svc/cicd-sonarqube 9000:9000 -n cicd-platform
```
➡️ http://localhost:9000 (admin/admin)

---

### Méthode 3 : Ingress (Production)

**Étape 1 : Installer l'Ingress Controller**
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

**Étape 2 : Appliquer l'Ingress**
```bash
kubectl apply -f ingress.yaml
```

**Étape 3 : Configurer les DNS/hosts**

Ajoutez dans `/etc/hosts` (Linux/Mac) ou `C:\Windows\System32\drivers\etc\hosts` (Windows) :
```
127.0.0.1 cicd.local api.cicd.local sonar.cicd.local
```

**Accès :**
- http://cicd.local → Frontend
- http://api.cicd.local → Backend
- http://sonar.cicd.local → SonarQube

---

## 8. ⚙️ Configuration Avancée

### Variables d'environnement

Modifiez `configmap.yaml` :

```yaml
data:
  # Mode pipeline
  PIPELINE_MODE: "real"          # simulate | real
  
  # URLs (adapter selon votre setup)
  FRONTEND_URL: "http://cicd-frontend:80"
  BACKEND_URL: "http://cicd-backend:3002"
  
  # VM de déploiement
  VM_HOST: "192.168.1.100"
  VM_USER: "deployer"
```

Appliquer les changements :
```bash
kubectl apply -f configmap.yaml
kubectl rollout restart deployment/cicd-backend -n cicd-platform
```

---

### Secrets (Production)

⚠️ **Ne jamais commiter les vrais secrets !**

**Créer des secrets encodés en base64 :**
```bash
echo -n "mon-mot-de-passe" | base64
# Output: bW9uLW1vdC1kZS1wYXNzZQ==
```

**Ou utiliser un gestionnaire de secrets :**
- **HashiCorp Vault**
- **Azure Key Vault**
- **AWS Secrets Manager**
- **Sealed Secrets** (Bitnami)

---

### Ressources (ajuster selon le cluster)

| Composant | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|-------------|-----------|----------------|--------------|
| Backend | 200m | 500m | 256Mi | 512Mi |
| Frontend | 50m | 100m | 64Mi | 128Mi |
| PostgreSQL | 250m | 500m | 256Mi | 512Mi |
| Redis | 100m | 200m | 128Mi | 256Mi |
| SonarQube | 500m | 2000m | 2Gi | 4Gi |

---

## 9. 📊 Monitoring & Observabilité

### Vérifier le statut des pods

```bash
# Vue d'ensemble
kubectl get pods -n cicd-platform -o wide

# Détails d'un pod
kubectl describe pod <pod-name> -n cicd-platform

# Événements récents
kubectl get events -n cicd-platform --sort-by='.lastTimestamp'
```

### Consulter les logs

```bash
# Logs du backend
kubectl logs -f deployment/cicd-backend -n cicd-platform

# Logs du frontend
kubectl logs -f deployment/cicd-frontend -n cicd-platform

# Logs d'un pod spécifique
kubectl logs -f <pod-name> -n cicd-platform

# Logs précédents (si crash)
kubectl logs <pod-name> -n cicd-platform --previous
```

### Métriques CPU/Mémoire

```bash
# Installer metrics-server (si pas installé)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Voir les métriques
kubectl top pods -n cicd-platform
kubectl top nodes
```

**Sortie exemple :**
```
NAME                              CPU(cores)   MEMORY(bytes)
cicd-backend-xxx                  25m          128Mi
cicd-frontend-xxx                 5m           32Mi
cicd-postgres-xxx                 50m          256Mi
```

---

## 10. 🔒 Sécurité

### Network Policies

Restreindre le trafic entre les pods :

```bash
kubectl apply -f network-policy.yaml
```

**Règles appliquées :**
- ✅ Frontend → Backend uniquement
- ✅ Backend → PostgreSQL, Redis, SonarQube
- ✅ SonarQube → SonarQube DB
- ❌ Pas d'accès direct aux bases de données depuis l'extérieur

### RBAC (Role-Based Access Control)

Créer un utilisateur avec accès limité :

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: cicd-platform
  name: cicd-viewer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
```

### Pod Security Standards

Ajouter aux Deployments :

```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: app
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
```

---

## 11. ⚡ Auto-scaling

### Horizontal Pod Autoscaler (HPA)

```bash
kubectl apply -f hpa.yaml
```

**Configuration :**

| Deployment | Min Pods | Max Pods | CPU Target | Memory Target |
|------------|----------|----------|------------|---------------|
| Backend | 2 | 10 | 70% | 80% |
| Frontend | 2 | 5 | 70% | - |

**Vérifier le HPA :**
```bash
kubectl get hpa -n cicd-platform
```

**Sortie :**
```
NAME               REFERENCE                  TARGETS   MINPODS   MAXPODS   REPLICAS
cicd-backend-hpa   Deployment/cicd-backend    25%/70%   2         10        2
cicd-frontend-hpa  Deployment/cicd-frontend   10%/70%   2         5         2
```

### Test de charge

```bash
# Simuler une charge
kubectl run -i --tty load-generator --rm --image=busybox --restart=Never -- \
  /bin/sh -c "while true; do wget -q -O- http://cicd-backend.cicd-platform:3002/health; done"
```

Observer le scaling :
```bash
kubectl get hpa -n cicd-platform -w
```

---

## 12. 🔄 Mises à jour & Rollback

### Rolling Update (Zero-downtime)

```bash
# Mettre à jour l'image
kubectl set image deployment/cicd-backend backend=cicd-backend:v2 -n cicd-platform

# Suivre le déploiement
kubectl rollout status deployment/cicd-backend -n cicd-platform
```

**Sortie :**
```
Waiting for deployment "cicd-backend" rollout to finish: 1 old replicas are pending termination...
Waiting for deployment "cicd-backend" rollout to finish: 1 of 2 updated replicas are available...
deployment "cicd-backend" successfully rolled out
```

### Historique des déploiements

```bash
kubectl rollout history deployment/cicd-backend -n cicd-platform
```

**Sortie :**
```
REVISION  CHANGE-CAUSE
1         <none>
2         kubectl set image deployment/cicd-backend backend=cicd-backend:v2
```

### Rollback

```bash
# Rollback à la version précédente
kubectl rollout undo deployment/cicd-backend -n cicd-platform

# Rollback à une version spécifique
kubectl rollout undo deployment/cicd-backend -n cicd-platform --to-revision=1
```

---

## 13. 🔧 Dépannage

### ❌ Pod en CrashLoopBackOff

```bash
# Voir les logs du crash
kubectl logs <pod-name> -n cicd-platform --previous

# Voir les événements
kubectl describe pod <pod-name> -n cicd-platform
```

**Causes courantes :**
- Image non trouvée → Vérifier le nom de l'image
- Erreur de configuration → Vérifier ConfigMap/Secrets
- Port déjà utilisé → Vérifier les ports
- Ressources insuffisantes → Augmenter les limits

---

### ❌ Pod en Pending

```bash
kubectl describe pod <pod-name> -n cicd-platform | grep -A 10 Events
```

**Causes courantes :**
- Pas assez de ressources sur le nœud
- PVC en attente → `kubectl get pvc -n cicd-platform`
- NodeSelector non satisfait

---

### ❌ Service inaccessible

```bash
# Vérifier les endpoints
kubectl get endpoints -n cicd-platform

# Vérifier le service
kubectl describe svc cicd-backend -n cicd-platform

# Test depuis un pod
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  wget -qO- http://cicd-backend.cicd-platform:3002/health
```

---

### ❌ SonarQube ne démarre pas

SonarQube nécessite des paramètres kernel spécifiques :

```bash
# Sur le nœud (ou dans le initContainer)
sudo sysctl -w vm.max_map_count=524288
sudo sysctl -w fs.file-max=131072

# Pour persister (ajouter dans /etc/sysctl.conf)
vm.max_map_count=524288
fs.file-max=131072
```

---

### ❌ PVC en Pending

```bash
kubectl get pvc -n cicd-platform
kubectl describe pvc <pvc-name> -n cicd-platform

# Vérifier les StorageClass disponibles
kubectl get storageclass
```

**Solution Docker Desktop :**
```bash
# Utiliser le StorageClass par défaut
kubectl patch pvc <pvc-name> -n cicd-platform -p '{"spec":{"storageClassName":"hostpath"}}'
```

---

## 14. 📝 Commandes Utiles

### Cheatsheet

```bash
# ============= DÉPLOIEMENT =============
kubectl apply -k kubernetes/              # Déployer tout
kubectl delete namespace cicd-platform    # Supprimer tout

# ============= STATUS =============
kubectl get all -n cicd-platform          # Tout voir
kubectl get pods -n cicd-platform -w      # Watch mode
kubectl top pods -n cicd-platform         # Métriques

# ============= LOGS =============
kubectl logs -f deploy/cicd-backend -n cicd-platform
kubectl logs <pod> -n cicd-platform --previous

# ============= DEBUG =============
kubectl exec -it <pod> -n cicd-platform -- /bin/sh
kubectl describe pod <pod> -n cicd-platform
kubectl get events -n cicd-platform --sort-by='.lastTimestamp'

# ============= PORT-FORWARD =============
kubectl port-forward svc/cicd-frontend 3000:80 -n cicd-platform
kubectl port-forward svc/cicd-backend 3002:3002 -n cicd-platform
kubectl port-forward svc/cicd-sonarqube 9000:9000 -n cicd-platform

# ============= SCALING =============
kubectl scale deployment cicd-backend --replicas=3 -n cicd-platform
kubectl get hpa -n cicd-platform

# ============= UPDATES =============
kubectl set image deploy/cicd-backend backend=cicd-backend:v2 -n cicd-platform
kubectl rollout status deploy/cicd-backend -n cicd-platform
kubectl rollout undo deploy/cicd-backend -n cicd-platform
```

---

## ✅ CHECKLIST DÉPLOIEMENT

### Avant le déploiement
- [ ] Cluster Kubernetes actif (`kubectl cluster-info`)
- [ ] Docker installé et fonctionnel
- [ ] Images construites (`docker images | grep cicd`)

### Pendant le déploiement
- [ ] Namespace créé (`kubectl get ns cicd-platform`)
- [ ] ConfigMaps et Secrets appliqués
- [ ] PostgreSQL et Redis en Running
- [ ] SonarQube en Running (⏳ 2-3 min)
- [ ] Backend et Frontend en Running

### Après le déploiement
- [ ] Frontend accessible (http://localhost:30000)
- [ ] Backend API répond (`curl http://localhost:30002/health`)
- [ ] SonarQube accessible (http://localhost:30090)
- [ ] WebSocket fonctionne

---

## 📚 Ressources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize Documentation](https://kustomize.io/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Kubernetes Secrets Best Practices](https://kubernetes.io/docs/concepts/configuration/secret/#best-practices)
- [HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)

---

**🎉 Félicitations ! Votre plateforme CI/CD est maintenant déployée sur Kubernetes !**
