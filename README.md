# 📘 PLATEFORME CI/CD - DOCUMENTATION COMPLÈTE

## Projet Cloud Sécurisé - BFB Management

**Auteurs**: Saar Rafik, Yuzhe Zhu, Thomas Bernabé
**Date**: Janvier 2026

---

## 📑 TABLE DES MATIÈRES

1. [Vue d&#39;ensemble](#vue-densemble)
2. [Architecture technique](#architecture-technique)
3. [Configuration et variables](#configuration-et-variables)
4. [Guide de démarrage](#guide-de-démarrage)
5. [VM de production](#vm-de-production)
6. [Fonctionnalités](#fonctionnalités)
7. [Guide de démonstration](#guide-de-démonstration)
8. [Commandes utiles](#commandes-utiles)
9. [Dépannage](#dépannage)

---

## 🎯 VUE D'ENSEMBLE

### Objectif du Projet

Construire une plateforme CI/CD permettant un déploiement automatique d'une application sur un serveur de production via une VM simulée.

### Technologies Utilisées

| Catégorie                 | Technologies                                  |
| -------------------------- | --------------------------------------------- |
| **Frontend**         | React 18, Vite, Socket.io-client, Chart.js    |
| **Backend**          | Node.js 20, Express, Socket.io, Bull (queues) |
| **Base de données** | PostgreSQL 15, Redis 7                        |
| **Authentification** | OAuth2 GitHub, JWT                            |
| **CI/CD**            | Docker, SSH, Git                              |
| **Qualité**         | SonarQube LTS Community                       |
| **Sécurité**       | OWASP ZAP (Pentest)                           |
| **Orchestration**    | Kubernetes                                    |

### Fonctionnalités Principales

✅ **Authentification OAuth2 GitHub**
✅ **Système de rôles** (admin, developer, viewer)
✅ **Pipeline visuel en temps réel** (WebSocket)
✅ **Déclenchement automatique** (Git Polling)
✅ **Déploiement SSH sur VM**
✅ **Analyse SonarQube**
✅ **Tests d'intrusion (Pentest)**
✅ **Rollback**
✅ **Kubernetes**

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Schéma Global

```
┌──────────────────────────────────────────────────────┐
│                  UTILISATEUR                         │
│            (Navigateur Web)                          │
└────────────────────┬─────────────────────────────────┘
                     │
                     │ HTTP/HTTPS + WebSocket
                     ▼
┌──────────────────────────────────────────────────────┐
│              FRONTEND (React)                        │
│  Port: 3000                                          │
│  - Dashboard avec graphiques                         │
│  - Login OAuth2 GitHub                               │
│  - Visualisation pipelines temps réel                │
│  - Gestion utilisateurs (admin)                      │
│  - Dashboard SonarQube                               │
│  - Dashboard Pentest                                 │
└────────────────────┬─────────────────────────────────┘
                     │
                     │ REST API + WebSocket
                     ▼
┌──────────────────────────────────────────────────────┐
│              BACKEND (Node.js)                       │
│  Port: 3002                                          │
│  - API REST (Express)                                │
│  - WebSocket (Socket.io)                             │
│  - Authentification JWT                              │
│  - Gestion des rôles et permissions                  │
│  - Orchestrateur de pipelines                        │
│  - Git Poller (vérifie changements)                  │
└────┬─────────┬──────────┬──────────┬─────────────────┘
     │         │          │          │
     │         │          │          └─────────────┐
     ▼         ▼          ▼                        ▼
┌─────────┐ ┌──────┐ ┌──────────┐      ┌──────────────────┐
│PostgreSQL││Redis │ │SonarQube │      │   VM PRODUCTION  │
│Port:5433│ │:6379 │ │Port:9001 │      │  172.20.10.13    │
│         │ │      │ │          │      │                  │
│Pipelines│ │Queue │ │Analyse   │      │ SSH Deploy       │
│Logs     │ │Jobs  │ │Qualité   │      │ Docker Containers│
│Users    │ │      │ │          │      │ Application      │
└─────────┘ └──────┘ └──────────┘      └──────────────────┘
```

### Pipeline de Déploiement (8 Étapes)

```
1. 📥 Clone Repository
   └─ Git clone du repo GitHub

2. 🧪 Run Tests
   └─ Exécution tests unitaires Maven/Gradle

3. 📦 Build Package
   └─ Compilation et packaging (.jar)

4. 🔍 SonarQube Analysis
   └─ Analyse qualité de code

5. 🐳 Build Docker Image
   └─ Construction image Docker

6. 🚀 Deploy to VM
   └─ Déploiement SSH sur VM

7. ✅ Health Check
   └─ Vérification santé application

8. 🔐 Security Scan
   └─ Tests d'intrusion OWASP ZAP
```

---

## ⚙️ CONFIGURATION ET VARIABLES

### Variables d'Environnement (.env)

#### **Fichier: `cicd-platform/.env`**

```env
# ============================================
# CONFIGURATION SERVEUR
# ============================================
PORT=3002
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3002

# ============================================
# BASE DE DONNÉES
# ============================================
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=cicd_db
POSTGRES_USER=cicd_user
POSTGRES_PASSWORD=cicd_pass

# ============================================
# REDIS (Queue)
# ============================================
REDIS_HOST=redis
REDIS_PORT=6379

# ============================================
# MODE PIPELINE
# ============================================
# 'simulate' = Mode démo (pas de vraie connexion VM)
# 'real' = Mode production (connexion réelle VM)
PIPELINE_MODE=real

# ============================================
# OAUTH2 GITHUB
# ============================================
# Créer une GitHub OAuth App sur:
# https://github.com/settings/developers
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ============================================
# SÉCURITÉ JWT
# ============================================
JWT_SECRET=

# ============================================
# VM DE PRODUCTION
# ============================================
VM_HOST=172.20.10.13
VM_USER=deploy
SSH_KEY_PATH=/app/ssh/vm_deployer

# ============================================
# SONARQUBE
# ============================================
SONAR_URL=http://sonarqube:9000
SONAR_TOKEN=
SONAR_EXTERNAL_URL=http://localhost:9001

# ============================================
# REPOSITORY À DÉPLOYER
# ============================================
APP_REPO_URL=https://github.com/Saad-Rafik-Etu-IMT/demo.git

# ============================================
# GIT POLLING (Détection automatique)
# ============================================
GIT_POLLING_ENABLED=true
GIT_POLLING_INTERVAL=60000
GIT_POLLING_BRANCH=master
```

### Ports Utilisés

| Service       | Port Local | Description            |
| ------------- | ---------- | ---------------------- |
| Frontend      | 3000       | Dashboard React        |
| Backend       | 3002       | API REST + WebSocket   |
| PostgreSQL    | 5433       | Base de données CI/CD |
| Redis         | 6379       | Queue de jobs          |
| SonarQube     | 9001       | Analyse qualité       |
| VM Production | 22 (SSH)   | Déploiement           |

---

## 🚀 GUIDE DE DÉMARRAGE

### Prérequis

- **Docker Desktop** installé et démarré
- **Git** installé
- **PowerShell** (Windows) ou **Bash** (Linux/Mac)
- **8 GB RAM minimum** recommandés
- **10 GB d'espace disque**

### Installation Rapide

#### **1. Cloner le projet**

```powershell
git clone https://github.com/Saad-Rafik-Etu-IMT/cicd-platform
cd cicd-platform
```

#### **2. Configurer la clé SSH**

```powershell
# Créer le dossier ssh
mkdir ssh

# Copier votre clé SSH privée
Copy-Item "$env:USERPROFILE\.ssh\bfb-cicd-deploy" -Destination "ssh\vm_deployer"
```

#### **3. Démarrer tous les services**

```powershell
docker compose up -d --build
```

#### **4. Vérifier le démarrage**

```powershell
docker compose ps
```

Tous les conteneurs doivent afficher "Up" ou "Healthy".

#### **5. Accéder à l'application**

- **Dashboard CI/CD**: http://localhost:3000
- **API Backend**: http://localhost:3002/health
- **SonarQube**: http://localhost:9001 (admin/admin)

### Premier Pipeline

1. Ouvrir http://localhost:3000
2. Se connecter via GitHub OAuth
3. Cliquer sur **"Nouveau Pipeline"**
4. Observer les 8 étapes s'exécuter en temps réel
5. Vérifier le déploiement sur la VM

---

## 🖥️ VM DE PRODUCTION

### Configuration Réseau

| Paramètre            | Valeur           |
| --------------------- | ---------------- |
| **IP Statique** | 172.20.10.13/28  |
| **Gateway**     | 172.20.10.1      |
| **DNS**         | 8.8.8.8, 8.8.4.4 |
| **Interface**   | enp0s3 (Bridged) |
| **OS**          | Ubuntu 24.04 LTS |

### Utilisateurs

| Utilisateur      | Rôle | Groupes      | Description              |
| ---------------- | ----- | ------------ | ------------------------ |
| **ubuntu** | Admin | sudo         | Utilisateur principal    |
| **deploy** | CI/CD | sudo, docker | Déploiement automatique |

### Services Installés sur VM

- **Docker** 29.1.3
- **Docker Compose** v5.0.1
- **PostgreSQL** (application)
- **Redis** (application)
- **Application BFB Management** (déployée)

### Commandes VM Utiles

```bash
# Se connecter en SSH
ssh ubuntu@172.20.10.13

# Vérifier les conteneurs
docker ps

# Voir les logs de l'application
docker logs <container-id>

# Redémarrer l'application
docker restart <container-id>

# Vérifier l'IP
ip addr show enp0s3

# Vérifier les services
systemctl status docker
```

### Configuration Netplan (VM)

**Fichier**: `/etc/netplan/50-cloud-init.yaml`

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:
      dhcp4: no
      addresses:
        - 172.20.10.13/28
      routes:
        - to: default
          via: 172.20.10.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

Appliquer les changements:

```bash
sudo netplan apply
```

---

## ⚡ FONCTIONNALITÉS

### 1. Authentification OAuth2

**Provider**: GitHub
**Flow**: Authorization Code Grant

**Endpoints**:

- Login: `/api/auth/github`
- Callback: `/api/auth/github/callback`
- Me: `/api/auth/me`
- Logout: `/api/auth/logout`

**Token**: JWT avec expiration 24h

### 2. Système de Rôles

| Rôle               | Permissions                                                     |
| ------------------- | --------------------------------------------------------------- |
| **admin**     | Tout (read, write, trigger, rollback, manage_users, manage_env) |
| **developer** | read, write, trigger, rollback                                  |
| **viewer**    | read seulement                                                  |

**Page de gestion**: http://localhost:3000/users (admin uniquement)

### 3. Pipeline Temps Réel

**Technologie**: WebSocket (Socket.io)

**Events**:

- `pipeline_started` - Pipeline démarré
- `step_started` - Étape commencée
- `step_completed` - Étape terminée
- `pipeline_completed` - Pipeline réussi
- `pipeline_failed` - Pipeline échoué

**Auto-refresh**: Dashboard actualise toutes les 5 secondes

### 4. Déclenchement Automatique

#### **Git Polling**

Vérifie les changements toutes les 5 secondes:

```bash
# Démarrer le polling
curl -X POST http://localhost:3002/api/poller/start

# Vérifier le statut
curl http://localhost:3002/api/poller/status

# Arrêter le polling
curl -X POST http://localhost:3002/api/poller/stop
```

### 5. SonarQube

**Accès**: http://localhost:9001
**Login par défaut**: admin

**Métriques analysées**:

- Bugs
- Vulnerabilities
- Code Smells
- Coverage (%)
- Duplication (%)
- Maintainability Rating
- Security Rating

### 6. Tests d'Intrusion

**Outil**: OWASP ZAP
**Dashboard**: http://localhost:3000/pentest

**Vulnérabilités détectées**:

- 🔴 High severity
- 🟠 Medium severity
- 🟡 Low severity
- 🔵 Informational

### 7. Rollback

En cas d'échec d'une étape:

1. Pipeline s'arrête
2. Logs d'erreur enregistrés
3. Option de rollback disponible
4. Restauration version précédente

**Commande**:

```bash
curl -X POST http://localhost:3002/api/pipelines/{id}/rollback
```

---

## 🛠️ COMMANDES UTILES

### Docker Compose

```powershell
# Démarrer tous les services
docker compose up -d

# Démarrer avec rebuild
docker compose up -d --build

# Arrêter tout
docker compose down

# Arrêter et supprimer volumes (⚠️ efface les données)
docker compose down -v

# Voir les logs
docker compose logs -f

# Logs d'un service spécifique
docker compose logs backend -f

# Redémarrer un service
docker compose restart backend

# Voir l'état
docker compose ps

# Voir les ressources
docker compose top
```

### API Backend

```powershell
# Health check
curl http://localhost:3002/health

# Lister les pipelines
curl http://localhost:3002/api/pipelines

# Déclencher un pipeline
curl -X POST http://localhost:3002/api/pipelines/trigger `
  -H "Content-Type: application/json" `
  -d '{"repo_url":"https://github.com/Saad-Rafik-Etu-IMT/demo.git","branch":"master"}'

# Démarrer Git Polling
curl -X POST http://localhost:3002/api/poller/start

# Status Git Polling
curl http://localhost:3002/api/poller/status
```

### VM (SSH)

```bash
# Connexion SSH (depuis Windows)
ssh -i $env:USERPROFILE\.ssh\bfb-cicd-deploy deploy@172.20.10.13

# Sur la VM: voir les conteneurs
docker ps

# Logs application
docker logs <container-name>

# Arrêter application
docker stop <container-name>

# Démarrer application
docker start <container-name>

# Nettoyer images Docker
docker image prune -a
```

### Git

```powershell
# Statut
git status

# Commit
git add .
git commit -m "message"

# Push
git push origin master

# Pull
git pull

# Voir l'historique
git log --oneline -10
```

---

## 🐛 DÉPANNAGE

### Problème: Le frontend ne se connecte pas au backend

**Symptômes**: Erreur CORS, "Cannot connect to server"

**Solutions**:

```powershell
# 1. Vérifier que le backend est up
docker compose ps

# 2. Vérifier les logs du backend
docker compose logs backend

# 3. Redémarrer le backend
docker compose restart backend

# 4. Vérifier l'URL dans le navigateur
# Frontend: http://localhost:3000
# Backend: http://localhost:3002
```

### Problème: PostgreSQL refuse la connexion

**Symptômes**: "role does not exist", "connection refused"

**Solutions**:

```powershell
# 1. Supprimer les volumes et recréer
docker compose down -v
docker compose up -d postgres

# 2. Attendre que Postgres soit healthy
docker compose ps

# 3. Si toujours un problème, recréer tout
docker compose down -v
docker compose up -d
```

### Problème: Pipeline échoue sur SSH

**Symptômes**: "Permission denied (publickey)"

**Solutions**:

```powershell
# 1. Vérifier que la clé existe
Test-Path .\ssh\vm_deployer

# 2. Vérifier la connexion SSH
ssh -i $env:USERPROFILE\.ssh\bfb-cicd-deploy deploy@172.20.10.13

# 3. Recopier la clé
Copy-Item "$env:USERPROFILE\.ssh\bfb-cicd-deploy" -Destination "ssh\vm_deployer" -Force

# 4. Redémarrer le backend
docker compose restart backend
```

### Problème: SonarQube ne démarre pas

**Symptômes**: "unhealthy", conteneur redémarre

**Solutions**:

```powershell
# 1. Augmenter la mémoire Docker Desktop
# Settings → Resources → Memory: 8 GB minimum

# 2. Attendre plus longtemps (2-3 minutes)
docker compose logs sonarqube -f

# 3. Vérifier les logs pour errors
docker compose logs sonarqube --tail 100
```

### Problème: Git Polling ne fonctionne pas

**Symptômes**: "Git Polling is disabled"

**Solutions**:

```powershell
# 1. Démarrer manuellement via API
curl -X POST http://localhost:3002/api/poller/start

# 2. Vérifier le statut
curl http://localhost:3002/api/poller/status

# 3. Vérifier les variables d'environnement
docker compose exec backend env | grep GIT_POLLING
```

### Problème: OAuth GitHub ne fonctionne pas

**Symptômes**: "OAuth failed", redirection échoue

**Solutions**:

1. Vérifier que `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET` sont corrects
2. Vérifier l'URL de callback dans GitHub OAuth App:
   - Authorization callback URL: `http://localhost:3002/api/auth/github/callback`
3. Vérifier que le backend est accessible: http://localhost:3002/health