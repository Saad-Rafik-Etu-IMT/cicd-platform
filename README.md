# 🚀 Plateforme CI/CD - BFB Management

Bienvenue dans la plateforme CI/CD pour le projet Cloud Sécurisé. Cette application permet de construire, tester et déployer automatiquement l'application BFB Management.

## 📋 Fonctionnalités

- **Pipelines Automatisés** : Clone, Test, Build, SonarQube, Docker Build, Deploy.
- **Visualisation en Temps Réel** : Suivi des étapes du pipeline via WebSocket.
- **Gestion des VMs** : Déploiement automatique sur VM via SSH.
- **Rollback** : Retour à la version précédente en un clic.
- **Webhooks** : Déclenchement automatique via GitHub Webhooks.

## 🛠️ Prérequis

- Docker & Docker Compose
- Node.js 18+ (pour le développement local)

## 🚀 Démarrage Rapide (Mode Simulation)

Le mode simulation permet de tester toute l'interface et le flux sans avoir besoin d'une vraie VM ou d'un repo Git.

1. **Cloner le projet**

   ```bash
   git clone https://github.com/Saad-Rafik-Etu-IMT/cicd-platform
   cd cicd-platform
   ```
2. **Configurer l'environnement**
   Le fichier `backend/.env` est déjà configuré pour le mode simulation (`PIPELINE_MODE=simulate`).
3. **Lancer les conteneurs**

   ```bash
   docker-compose up -d --build
   ```
4. **Accéder à l'application**

   - **Frontend (Dashboard)** : [http://localhost:3000](http://localhost:3000)
   - **Backend API** : [http://localhost:3002](http://localhost:3002)
   - **SonarQube** : [http://localhost:9000](http://localhost:9000)
   - **Base de données** : Port 5433
   - **Redis** : Port 6379
5. **Tester un pipeline**

   - Allez sur le Dashboard.
   - Cliquez sur "Nouveau Pipeline".
   - Observez les étapes se dérouler en temps réel (simulées).

## 🌍 Déploiement Réel (Production)

Pour connecter la plateforme à une vraie VM et déployer réellement l'application :

### 1. Préparer la VM Cible

Utilisez le script fourni pour configurer une VM Ubuntu vierge :

1. Copiez le dossier `vm-setup` sur votre VM.
2. Exécutez le script d'installation :

   ```bash
   cd vm-setup
   chmod +x setup-vm.sh
   ./setup-vm.sh
   ```

   Cela installera Docker, créera l'utilisateur `deploy` et configurera les clés SSH.

### 2. Configurer le Backend

Modifiez le fichier `backend/.env` :

```env
PIPELINE_MODE=real
VM_HOST=<IP_DE_VOTRE_VM>
VM_USER=deploy
VM_SSH_PRIVATE_KEY=<CONTENU_DE_LA_CLE_PRIVEE>
# Ou utilisez un chemin vers la clé dans docker-compose.yml
```

### 3. Configurer SonarQube

SonarQube est intégré dans le docker-compose. Pour le configurer :

1. **Accéder à SonarQube** : [http://localhost:9000](http://localhost:9000)
   - Login par défaut : `admin` / `admin`
   - Changez le mot de passe à la première connexion

2. **Générer un Token API** :
   - Allez dans `Administration > Security > Users`
   - Cliquez sur l'icône de token pour votre utilisateur
   - Créez un token et copiez-le

3. **Configurer le Backend** :
   Modifiez `backend/.env` :
   ```env
   SONAR_URL=http://sonarqube:9000
   SONAR_EXTERNAL_URL=http://localhost:9000
   SONAR_TOKEN=<VOTRE_TOKEN>
   ```

4. **Relancer les conteneurs** :
   ```bash
   docker-compose up -d backend
   ```

L'analyse SonarQube sera exécutée automatiquement lors de chaque pipeline.

## 🏗️ Architecture

- **Frontend** : React + Vite (Port 3000)
- **Backend** : Node.js + Express + Socket.io (Port 3001)
- **Base de données** : PostgreSQL (Port 5433)
- **File d'attente** : Redis (Port 6379)
- **Worker** : Gère l'exécution des pipelines (intégré au backend)

## 🔒 Sécurité

- **Isolation** : Chaque pipeline s'exécute dans un dossier temporaire isolé.
- **SSH** : Connexion sécurisée par clé privée uniquement.
- **Secrets** : Les variables sensibles sont gérées via `.env`.
