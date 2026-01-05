# Configuration VM Ubuntu pour CI/CD

## Prérequis

- VM Ubuntu 22.04 LTS ou plus récent
- Accès SSH avec droits sudo
- Minimum 2GB RAM, 20GB disque

## Installation rapide

### 1. Copier le script sur la VM

```bash
scp vm-setup/setup-vm.sh ubuntu@<IP_VM>:~/
```

### 2. Exécuter le script

```bash
ssh ubuntu@<IP_VM>
chmod +x setup-vm.sh
sudo ./setup-vm.sh
```

### 3. Configurer la clé SSH de déploiement

Générer une paire de clés sur la plateforme CI/CD :
```bash
ssh-keygen -t ed25519 -C "cicd-deploy" -f ~/.ssh/cicd_deploy -N ""
```

Copier la clé publique sur la VM :
```bash
ssh ubuntu@<IP_VM> "echo '$(cat ~/.ssh/cicd_deploy.pub)' | sudo tee -a /home/deploy/.ssh/authorized_keys"
```

### 4. Tester la connexion

```bash
ssh -i ~/.ssh/cicd_deploy deploy@<IP_VM> "echo 'Connection OK'"
```

## Structure des répertoires

```
/opt/bfb-management/
├── current/          # Lien vers la release active
├── releases/         # Historique des releases
│   ├── 20260105_143000/
│   └── 20260105_120000/
├── shared/
│   └── data/         # Données persistantes (H2 DB)
├── logs/             # Logs de l'application
├── deploy.sh         # Script de déploiement
└── rollback.sh       # Script de rollback
```

## Commandes utiles

### Déployer une nouvelle version
```bash
/opt/bfb-management/deploy.sh bfb-management:v1.0.0
```

### Rollback
```bash
/opt/bfb-management/rollback.sh
```

### Voir les logs
```bash
docker logs -f bfb-app
```

### Vérifier le status
```bash
docker ps
curl http://localhost:8080/actuator/health
```

## Configuration réseau

| Port | Service | Description |
|------|---------|-------------|
| 22   | SSH     | Accès déploiement |
| 80   | Nginx   | Reverse proxy → 8080 |
| 8080 | App     | Application Spring Boot |

## Maintenance

### Nettoyer les anciennes images Docker
```bash
docker image prune -a --filter "until=168h"
```

### Voir l'espace disque
```bash
df -h /opt/bfb-management
docker system df
```
