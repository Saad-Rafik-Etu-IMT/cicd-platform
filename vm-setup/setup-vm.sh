#!/bin/bash
# ============================================
# Script de configuration VM Ubuntu pour CI/CD
# BFB Management - Déploiement automatique
# ============================================

set -e

echo "🚀 Configuration de la VM Ubuntu pour CI/CD"
echo "============================================"

# Variables
APP_USER="deploy"
APP_DIR="/opt/bfb-management"
DOCKER_NETWORK="bfb-network"

# 1. Mise à jour du système
echo ""
echo "📦 1. Mise à jour du système..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Installation de Docker
echo ""
echo "🐳 2. Installation de Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    echo "✅ Docker installé"
else
    echo "✅ Docker déjà installé"
fi

# Ajouter l'utilisateur courant au groupe docker
sudo usermod -aG docker $USER

# 3. Installation de Docker Compose
echo ""
echo "📦 3. Vérification de Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt-get install -y docker-compose-plugin
fi
echo "✅ Docker Compose disponible"

# 4. Créer l'utilisateur de déploiement
echo ""
echo "👤 4. Configuration de l'utilisateur de déploiement..."
if ! id "$APP_USER" &>/dev/null; then
    sudo useradd -m -s /bin/bash $APP_USER
    sudo usermod -aG docker $APP_USER
    echo "✅ Utilisateur '$APP_USER' créé"
else
    echo "✅ Utilisateur '$APP_USER' existe déjà"
fi

# 5. Créer la structure de répertoires
echo ""
echo "📁 5. Création de la structure de répertoires..."
sudo mkdir -p $APP_DIR/{current,releases,shared/data,logs}
sudo chown -R $APP_USER:$APP_USER $APP_DIR
echo "✅ Répertoires créés: $APP_DIR"

# 6. Configurer SSH pour le déploiement
echo ""
echo "🔑 6. Configuration SSH..."
sudo mkdir -p /home/$APP_USER/.ssh
sudo touch /home/$APP_USER/.ssh/authorized_keys
sudo chmod 700 /home/$APP_USER/.ssh
sudo chmod 600 /home/$APP_USER/.ssh/authorized_keys
sudo chown -R $APP_USER:$APP_USER /home/$APP_USER/.ssh
echo "✅ SSH configuré pour l'utilisateur '$APP_USER'"

# 7. Créer le réseau Docker
echo ""
echo "🌐 7. Création du réseau Docker..."
if ! docker network ls | grep -q $DOCKER_NETWORK; then
    docker network create $DOCKER_NETWORK
    echo "✅ Réseau '$DOCKER_NETWORK' créé"
else
    echo "✅ Réseau '$DOCKER_NETWORK' existe déjà"
fi

# 8. Configurer le firewall
echo ""
echo "🔥 8. Configuration du firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8080/tcp  # Application
sudo ufw --force enable
echo "✅ Firewall configuré"

# 9. Créer le script de déploiement
echo ""
echo "📜 9. Création du script de déploiement..."
cat > /tmp/deploy.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
# Script de déploiement automatique

set -e

APP_DIR="/opt/bfb-management"
DOCKER_IMAGE="$1"
RELEASE_DIR="$APP_DIR/releases/$(date +%Y%m%d_%H%M%S)"

echo "🚀 Déploiement de $DOCKER_IMAGE"

# Créer le répertoire de release
mkdir -p $RELEASE_DIR

# Arrêter l'ancien conteneur
echo "⏹️  Arrêt de l'ancien conteneur..."
docker stop bfb-app 2>/dev/null || true
docker rm bfb-app 2>/dev/null || true

# Sauvegarder l'ancienne version
if [ -L "$APP_DIR/current" ]; then
    OLD_RELEASE=$(readlink -f $APP_DIR/current)
    echo "📦 Sauvegarde: $OLD_RELEASE"
fi

# Démarrer le nouveau conteneur
echo "▶️  Démarrage du nouveau conteneur..."
docker run -d \
    --name bfb-app \
    --network bfb-network \
    -p 8080:8080 \
    -v $APP_DIR/shared/data:/app/data \
    -e SPRING_PROFILES_ACTIVE=prod \
    --restart unless-stopped \
    --health-cmd="curl -f http://localhost:8080/actuator/health || exit 1" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    $DOCKER_IMAGE

# Attendre le health check
echo "⏳ Attente du health check..."
sleep 10

# Vérifier la santé
if docker inspect --format='{{.State.Health.Status}}' bfb-app | grep -q "healthy"; then
    echo "✅ Déploiement réussi!"
    
    # Mettre à jour le lien symbolique
    rm -f $APP_DIR/current
    ln -s $RELEASE_DIR $APP_DIR/current
    
    # Nettoyer les anciennes releases (garder les 5 dernières)
    cd $APP_DIR/releases
    ls -t | tail -n +6 | xargs -r rm -rf
else
    echo "❌ Health check échoué, rollback..."
    docker stop bfb-app 2>/dev/null || true
    docker rm bfb-app 2>/dev/null || true
    exit 1
fi
DEPLOY_SCRIPT

sudo mv /tmp/deploy.sh $APP_DIR/deploy.sh
sudo chmod +x $APP_DIR/deploy.sh
sudo chown $APP_USER:$APP_USER $APP_DIR/deploy.sh
echo "✅ Script de déploiement créé: $APP_DIR/deploy.sh"

# 10. Créer le script de rollback
echo ""
echo "📜 10. Création du script de rollback..."
cat > /tmp/rollback.sh << 'ROLLBACK_SCRIPT'
#!/bin/bash
# Script de rollback

set -e

APP_DIR="/opt/bfb-management"

echo "⏮️  Rollback en cours..."

# Trouver la version précédente
CURRENT=$(readlink -f $APP_DIR/current 2>/dev/null || echo "")
RELEASES=$(ls -t $APP_DIR/releases 2>/dev/null)
PREVIOUS=""

for release in $RELEASES; do
    if [ "$APP_DIR/releases/$release" != "$CURRENT" ]; then
        PREVIOUS="$APP_DIR/releases/$release"
        break
    fi
done

if [ -z "$PREVIOUS" ]; then
    echo "❌ Aucune version précédente disponible"
    exit 1
fi

echo "📦 Rollback vers: $PREVIOUS"

# Arrêter le conteneur actuel
docker stop bfb-app 2>/dev/null || true
docker rm bfb-app 2>/dev/null || true

# Démarrer l'ancienne version
# Note: Nécessite que l'image soit encore disponible
PREVIOUS_IMAGE=$(cat $PREVIOUS/image.txt 2>/dev/null || echo "bfb-management:previous")

docker run -d \
    --name bfb-app \
    --network bfb-network \
    -p 8080:8080 \
    -v $APP_DIR/shared/data:/app/data \
    -e SPRING_PROFILES_ACTIVE=prod \
    --restart unless-stopped \
    $PREVIOUS_IMAGE

# Mettre à jour le lien
rm -f $APP_DIR/current
ln -s $PREVIOUS $APP_DIR/current

echo "✅ Rollback terminé!"
ROLLBACK_SCRIPT

sudo mv /tmp/rollback.sh $APP_DIR/rollback.sh
sudo chmod +x $APP_DIR/rollback.sh
sudo chown $APP_USER:$APP_USER $APP_DIR/rollback.sh
echo "✅ Script de rollback créé: $APP_DIR/rollback.sh"

# 11. Installer et configurer Nginx (reverse proxy)
echo ""
echo "🌐 11. Installation de Nginx..."
sudo apt-get install -y nginx

cat > /tmp/bfb-nginx << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        proxy_pass http://localhost:8080/actuator/health;
    }
}
NGINX_CONF

sudo mv /tmp/bfb-nginx /etc/nginx/sites-available/bfb-management
sudo ln -sf /etc/nginx/sites-available/bfb-management /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx configuré"

# 12. Résumé
echo ""
echo "============================================"
echo "✅ Configuration terminée!"
echo "============================================"
echo ""
echo "📋 Résumé:"
echo "   - Docker: $(docker --version)"
echo "   - Utilisateur: $APP_USER"
echo "   - Répertoire: $APP_DIR"
echo "   - Réseau Docker: $DOCKER_NETWORK"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Ajouter la clé SSH publique dans:"
echo "      /home/$APP_USER/.ssh/authorized_keys"
echo ""
echo "   2. Tester le déploiement:"
echo "      ssh $APP_USER@<IP_VM> '/opt/bfb-management/deploy.sh bfb-management:latest'"
echo ""
echo "   3. Accéder à l'application:"
echo "      http://<IP_VM>:80"
echo ""
