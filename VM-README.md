# VM & Déploiement local - Guide complet

Ce document rassemble tout ce que vous devez savoir pour la partie VM et déploiement local de la stack `cicd-platform` (création VM, réseau, SSH, utilisateurs, Docker, .env, docker-compose, vérifications et dépannage).

**Emplacement :** `~/cicd-platform` sur la VM (utilisateur `deploy`).

**Résumé rapide :**
- VM Ubuntu configurée avec IP statique `172.20.10.13` (exemple). 
- Utilisateurs : `ubuntu` (admin), `deploy` (CI/CD, membre des groupes `sudo` et `docker`).
- Docker installé et fonctionnel (ex. Docker 29.x).
- Services déployés via `docker compose` : Postgres, Redis, Backend, Frontend, SonarQube.

---

**1 - Prérequis locaux (hôte Windows)**
- VirtualBox installé.
- Image ISO Ubuntu Server (22.04/24.04 selon le guide).
- PowerShell pour SSH et gestion locale.

---

**2 - Création de la VM (VirtualBox)**
- Créez une VM nommée `BFB-CI-CD-Server`.
- RAM : 4 GB (ou plus). Disque : 30 GB.
- Dans les paramètres réseau (VM éteinte) : Adapter 1 → Mode `Bridged Adapter` (Accès par pont) → sélectionnez l'interface physique active (Ethernet ou Wi‑Fi). Cochez `Cable connected`.
- Montez l'ISO d'Ubuntu et installez manuellement (ne pas laisser l'option "Unattended" si elle vous crée un utilisateur inconnu).

Conseil : si votre VM a l'IP `10.0.2.15`, elle est en NAT ; passez à Bridged pour communiquer depuis votre PC.

---

**3 - Configuration réseau sur la VM (netplan)**
Vérifier l'interface :
```bash
ip addr show
ip route show default
```

Pour définir une IP statique (ex : `172.20.10.13`), éditez `/etc/netplan/50-cloud-init.yaml` (ou créez `/etc/netplan/01-netcfg.yaml`) :

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

Appliquer :
```bash
sudo netplan try   # tester (120s)
sudo netplan apply
```

---

**4 - SSH et utilisateurs**
- Générer clés SSH sur votre PC Windows (POWER SHELL, hors SSH) :
```powershell
ssh-keygen -t ed25519 -C "bfb-cicd-deploy" -f $env:USERPROFILE\.ssh\bfb-cicd-deploy
Get-Content $env:USERPROFILE\.ssh\bfb-cicd-deploy.pub
```
- Ajouter la clé publique au fichier `/home/deploy/.ssh/authorized_keys` sur la VM :
```bash
echo "ssh-ed25519 AAAA... yourkey..." | sudo tee /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

Créer l'utilisateur `deploy` (si pas déjà) :
```bash
sudo adduser deploy
sudo usermod -aG sudo,docker deploy
sudo mkdir -p /home/deploy/.ssh
sudo chown deploy:deploy /home/deploy/.ssh
```

Test SSH depuis Windows :
```powershell
ssh -i $env:USERPROFILE\.ssh\bfb-cicd-deploy deploy@172.20.10.13
```

---

**5 - Installer Docker (sur la VM)**
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
sudo systemctl enable --now docker
rm get-docker.sh
```
Pour appliquer le groupe `docker`, reconnectez-vous.

Vérifier :
```bash
docker --version
docker compose version
docker run --rm hello-world
```

---

**6 - Clonage du dépôt et .env**
Sur la VM (user `deploy`) :
```bash
cd ~
mkdir -p cicd-platform && cd cicd-platform
git clone git@github.com:Saad-Rafik-Etu-IMT/cicd-platform.git .
cp .env.example .env
nano .env  # adapter les variables (POSTGRES_*, VITE_API_URL, JWT_SECRET ...)
```

Important : `docker-compose.yml` attend que `.env` contienne `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, etc. Assurez-vous qu'ils sont définis.

Exemple minimal `.env` (adapter les valeurs) :
```env
POSTGRES_USER=bfb_user
POSTGRES_PASSWORD=bfb_password_2024
POSTGRES_DB=bfb_management
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://bfb_user:bfb_password_2024@postgres:5432/bfb_management
REDIS_URL=redis://redis:6379
JWT_SECRET=change_this_secret
VITE_API_URL=http://172.20.10.13:3000
```

---

**7 - Lancer la stack Docker (docker compose)**
```bash
# Démarrer tout
docker compose up -d

# Vérifier l'état
docker compose ps

# Logs
docker compose logs -f
```

Si vous voulez démarrer un service isolé :
```bash
docker compose up -d postgres
docker compose up -d redis
docker compose up -d backend
```

Arrêter et supprimer volumes (attention : efface les données) :
```bash
docker compose down -v
```

---

**8 - Vérifications utiles**
- Vérifier IP : `ip addr show enp0s3`
- Vérifier route : `ip route show default`
- Tester ping : `ping -c 4 google.com`
- Vérifier Postgres :
  - `docker compose exec postgres psql -U bfb_user -d bfb_management -c "SELECT version();"`
  - `docker compose exec postgres psql -U bfb_user -d bfb_management -c "\dt"`
- Vérifier Redis : `docker compose exec redis redis-cli ping` (doit répondre `PONG`)
- Backend logs : `docker compose logs backend --tail 50`
- Frontend : ouvrez `http://172.20.10.13:3000` depuis votre navigateur hôte
- SonarQube : `http://172.20.10.13:9000` (login: `admin` / `admin` par défaut — changez-le)

---

**9 - Dépannage commun**
- Postgres : "role X does not exist" → probablement données persistantes créées avec d'autres credentials. Solution :
  - `docker compose down -v` puis `docker compose up -d postgres` (réinitialise le volume)
  - Ou créer manuellement l'utilisateur en se connectant comme `postgres` :
    ```bash
    docker compose exec postgres psql -U postgres
    CREATE USER bfb_user WITH PASSWORD 'bfb_password_2024';
    CREATE DATABASE bfb_management OWNER bfb_user;
    GRANT ALL PRIVILEGES ON DATABASE bfb_management TO bfb_user;
    \q
    ```
- Clé SSH GitHub : si `git clone git@github.com:...` donne `Permission denied (publickey)`, ajoutez la clé publique (`id_ed25519.pub`) en tant que *Deploy Key* dans les paramètres du repo GitHub.
- SonarQube démarre lentement : suivre `docker compose logs sonarqube -f`. Attendre 1–3 minutes, vérifier `SonarQube is operational`.
- Redis warning `vm.overcommit_memory`: exécuter `sudo sysctl vm.overcommit_memory=1` si nécessaire.
- VirtualBox: si VM reçoit IP en `10.0.2.15`, repasser l'adaptateur en `Bridged`.

---

**10 - Définitions rapides**
- Bridged Adapter : la VM est sur le même réseau local que l'hôte, permet l'accès direct entre hôte et VM.
- Netplan : utilitaire Ubuntu pour configurer réseau (fichiers YAML sous `/etc/netplan`).
- Deploy key : clé SSH dédiée qu'on ajoute au repo GitHub pour donner accès en lecture/écriture depuis la VM.

---

**11 - Commandes de référence (copier-coller)**
- Stop / cleanup : `docker compose down -v`
- Start : `docker compose up -d`
- Logs : `docker compose logs -f`
- Restart one service : `docker compose up -d postgres`
- Exec shell : `docker compose exec backend sh` (ou bash selon image)

---

Si vous voulez, je peux :
- Committer ce fichier README dans le repo et créer un PR, ou
- L'ajouter puis exécuter `git add/commit/push` si vous voulez que je pousse les modifications.

Faites-moi savoir si vous voulez des sections supplémentaires (cron jobs, backup DB, sauvegarde volumes, SSL, reverse proxy Nginx, etc.).
