# 🚀 CI/CD Platform - BFB Management

Plateforme de déploiement continu pour l'application BFB Management.

## 📋 État du projet

### ✅ CRITIQUE (Terminé)
- [x] Endpoint logs pipeline - GET `/api/pipelines/:id/logs`
- [x] Bouton "Nouveau Pipeline" fonctionnel
- [x] Connexion au vrai repo BFB

### ⏸️ IMPORTANT (À faire après - Améliore la qualité)
- [ ] Page détail pipeline avec logs temps réel WebSocket
- [ ] Authentification basique (login/password)
- [ ] Rollback fonctionnel
- [ ] Notifications en cas d'échec

### 🔄 SECONDAIRE (En cours - Nice to have)
- [ ] Graphiques statistiques (Chart.js)
- [ ] Multi-projets
- [ ] Variables d'environnement (UI secrets)
- [ ] Tests automatisés

### 📝 DOCUMENTATION
- [ ] README complet
- [ ] Schéma d'architecture
- [ ] Guide déploiement VM

---

## 🛠️ Installation

```bash
# Cloner le repo
git clone https://github.com/Saad-Rafik-Etu-IMT/cicd-platform.git
cd cicd-platform

# Lancer avec Docker
docker-compose up -d
```

## 🌐 Accès

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5433
- **Redis**: localhost:6379

## 📅 Deadline: 9 janvier 2026
