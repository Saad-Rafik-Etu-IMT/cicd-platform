# 🖥️ Guide Complet - Configuration VM Ubuntu pour CI/CD Platform

**Objectif :** Créer et configurer une VM Ubuntu qui servira de serveur de déploiement pour l'application BFB Management.

**Durée estimée :** 30-45 minutes

---

## 📋 Table des Matières

1. [Choix de la Solution VM](#1-choix-de-la-solution-vm)
2. [Installation de VirtualBox](#2-installation-de-virtualbox)
3. [Téléchargement Ubuntu Server](#3-téléchargement-ubuntu-server)
4. [Création de la VM](#4-création-de-la-vm)
5. [Installation Ubuntu](#5-installation-ubuntu)
6. [Configuration Réseau](#6-configuration-réseau)
7. [Configuration SSH](#7-configuration-ssh)
8. [Installation Docker et Dépendances](#8-installation-docker-et-dépendances)
9. [Configuration Utilisateur Deploy](#9-configuration-utilisateur-deploy)
10. [Test de Connexion](#10-test-de-connexion)
11. [Dépannage](#11-dépannage)

---

## 1. 🎯 Choix de la Solution VM

### Options disponibles :

| Solution | Avantages | Inconvénients | Recommandé pour |
|----------|-----------|---------------|-----------------|
| **VirtualBox** | Gratuit, facile, Windows/Mac/Linux | Performances moyennes | Débutants, test local |
| **VMware Workstation** | Meilleures performances | Payant (version Pro) | Professionnels |
| **Hyper-V** | Intégré à Windows Pro | Windows Pro uniquement | Utilisateurs Windows Pro |
| **WSL2** | Léger, rapide | Linux seulement, pas de GUI | Développeurs avancés |

**➡️ Recommandation : VirtualBox** (gratuit, universel, simple)

---

## 2. 📥 Installation de VirtualBox

### Étape 2.1 : Téléchargement

1. Aller sur : https://www.virtualbox.org/wiki/Downloads
2. Télécharger **VirtualBox 7.0.x for Windows hosts**
3. Télécharger aussi **VirtualBox Extension Pack** (même page)

### Étape 2.2 : Installation VirtualBox

```powershell
# Dans PowerShell en tant qu'administrateur
cd $env:USERPROFILE\Downloads
Start-Process "VirtualBox-7.0.x-Win.exe" -Wait -ArgumentList "/S"
```

**OU** : Double-cliquer sur l'installeur et suivre l'assistant.

### Étape 2.3 : Installation Extension Pack

1. Ouvrir VirtualBox
2. Aller dans **Fichier → Préférences → Extensions**
3. Cliquer sur **+** et sélectionner le fichier `.vbox-extpack` téléchargé
4. Accepter la licence

**✅ Vérification :**
```powershell
"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" --version
```

---

## 3. 💿 Téléchargement Ubuntu Server

### Étape 3.1 : Télécharger l'ISO

**Option A : Ubuntu Server 22.04 LTS (Recommandé)**
- URL : https://ubuntu.com/download/server
- Fichier : `ubuntu-22.04.x-live-server-amd64.iso` (~2 GB)

**Option B : Ubuntu Desktop 22.04** (si vous préférez une interface graphique)
- URL : https://ubuntu.com/download/desktop
- Fichier : `ubuntu-22.04.x-desktop-amd64.iso` (~4.7 GB)

```powershell
# Télécharger via PowerShell (Option A - Server)
$url = "https://releases.ubuntu.com/22.04/ubuntu-22.04.3-live-server-amd64.iso"
$output = "$env:USERPROFILE\Downloads\ubuntu-22.04.3-server-amd64.iso"
Invoke-WebRequest -Uri $url -OutFile $output
```

**⏱️ Temps de téléchargement :** 5-15 minutes (selon connexion)

---

## 4. 🛠️ Création de la VM dans VirtualBox

### Étape 4.1 : Créer une nouvelle VM

1. Ouvrir **VirtualBox**
2. Cliquer sur **Nouvelle** (ou `Ctrl+N`)
3. Remplir les informations :

| Paramètre | Valeur |
|-----------|--------|
| **Nom** | `BFB-CI-CD-Server` |
| **Dossier** | `C:\VMs` (créer si nécessaire) |
| **Type** | Linux |
| **Version** | Ubuntu (64-bit) |
| **ISO Image** | Sélectionner l'ISO Ubuntu téléchargée |

4. Cocher **"Skip Unattended Installation"** ✅ (important pour configuration manuelle)

### Étape 4.2 : Allocation Mémoire (RAM)

| Configuration | RAM | Usage |
|--------------|-----|-------|
| **Minimum** | 2048 MB (2 GB) | Fonctionnel mais juste |
| **Recommandé** | 4096 MB (4 GB) | Idéal pour Docker + App |
| **Optimal** | 8192 MB (8 GB) | Confortable pour multiples conteneurs |

**➡️ Choisir : 4096 MB**

### Étape 4.3 : Créer un disque dur virtuel

1. Sélectionner **"Create a Virtual Hard Disk Now"**
2. Paramètres :

| Paramètre | Valeur |
|-----------|--------|
| **Taille** | 25 GB minimum, **30 GB recommandé** |
| **Type** | VDI (VirtualBox Disk Image) |
| **Stockage** | Dynamically allocated (s'agrandit au besoin) |

3. Cliquer sur **Finish**

### Étape 4.4 : Configuration avancée de la VM

1. Sélectionner la VM `BFB-CI-CD-Server`
2. Cliquer sur **Configuration** (ou `Ctrl+S`)

#### 4.4.1 Système
- **Onglet Processeur** :
  - **CPU** : 2 cœurs minimum (4 si possible)
  - Activer **"Enable PAE/NX"**

#### 4.4.2 Affichage
- **Mémoire vidéo** : 16 MB (suffisant pour serveur)
- **Accélération graphique** : Laisser désactivé

#### 4.4.3 Réseau (⚠️ CRITIQUE)
- **Carte 1** :
  - ✅ Activer la carte réseau
  - **Mode d'accès réseau** : **Accès par pont (Bridged Adapter)**
  - **Nom** : Sélectionner votre carte réseau physique (WiFi ou Ethernet)
  - **Type d'adaptateur** : `Paravirtualized Network (virtio-net)`

**Pourquoi "Accès par pont" ?**
- La VM obtient une IP sur votre réseau local (192.168.1.x)
- Accessible depuis votre PC Windows
- Nécessaire pour le déploiement SSH

#### 4.4.4 Stockage
- Vérifier que l'ISO Ubuntu est bien montée sur le contrôleur IDE

---

## 5. 🚀 Installation Ubuntu Server

### Étape 5.1 : Démarrer la VM

1. Sélectionner `BFB-CI-CD-Server`
2. Cliquer sur **Démarrer** (flèche verte)
3. La VM démarre sur l'ISO Ubuntu

### Étape 5.2 : Installation Ubuntu (Assistant)

#### Écran 1 : Langue
- Sélectionner : **English**
- `Enter`

#### Écran 2 : Keyboard Configuration
- Layout : **French** (ou votre clavier)
- Variant : **French**
- `Done` → `Enter`

#### Écran 3 : Type d'installation
- Sélectionner : **Ubuntu Server**
- `Done`

#### Écran 4 : Connexion réseau
- **⚠️ IMPORTANT : Noter l'adresse IP affichée !**
- Exemple : `192.168.1.150/24` (DHCP)
- Vérifier que la carte est **UP** avec une IP
- Si pas d'IP : appuyer sur `Enter` sur la carte et configurer DHCP
- `Done`

#### Écran 5 : Proxy
- Laisser vide
- `Done`

#### Écran 6 : Archive mirror
- Laisser par défaut (http://archive.ubuntu.com/ubuntu)
- `Done`

#### Écran 7 : Guided storage configuration
- Laisser **"Use an entire disk"** coché
- Laisser **"Set up this disk as an LVM group"** coché
- `Done`
- Confirmer : `Continue`

#### Écran 8 : Profile Setup (⚠️ BIEN NOTER CES INFOS)

| Champ | Valeur Recommandée |
|-------|-------------------|
| **Your name** | `Administrator` |
| **Your server's name** | `bfb-cicd` |
| **Pick a username** | `ubuntu` |
| **Choose a password** | `ubuntu2026` (à changer après) |
| **Confirm password** | `ubuntu2026` |

- `Done`

#### Écran 9 : Upgrade to Ubuntu Pro
- Sélectionner : **Skip for now**
- `Continue`

#### Écran 10 : SSH Setup
- **⚠️ IMPORTANT : Cocher "Install OpenSSH server"** ✅
- Ne pas importer de clés SSH maintenant
- `Done`

#### Écran 11 : Featured Server Snaps
- **Cocher : Docker** ✅ (facilite l'installation)
- Décocher le reste
- `Done`

**⏱️ Installation en cours : 5-10 minutes**

### Étape 5.3 : Finalisation

1. Attendre le message **"Installation complete!"**
2. Sélectionner **Reboot Now**
3. Appuyer sur `Enter` pour éjecter le CD
4. La VM redémarre

### Étape 5.4 : Premier login

1. Attendre l'écran de login : `bfb-cicd login:`
2. Entrer :
   - **login** : `ubuntu`
   - **password** : `ubuntu2026`

**✅ Vous êtes maintenant connecté à Ubuntu Server !**

---

## 6. 🌐 Configuration Réseau

### Étape 6.1 : Vérifier l'adresse IP

```bash
ip addr show
```

**Chercher :** `inet 192.168.1.XXX/24` sur l'interface `enp0s3` ou `eth0`

**Exemple de sortie :**
```
2: enp0s3: <BROADCAST,MULTICAST,UP,LOWER_UP>
    inet 192.168.1.150/24 brd 192.168.1.255 scope global dynamic enp0s3
```

**➡️ Noter cette IP : `192.168.1.150`** (ce sera votre `VM_HOST`)

### Étape 6.2 : Configurer une IP statique (Recommandé)

**Pourquoi ?** Éviter que l'IP change à chaque redémarrage (DHCP)

```bash
# Identifier le nom de l'interface réseau
ip link show
# Exemple : enp0s3

# Éditer la configuration Netplan
sudo nano /etc/netplan/00-installer-config.yaml
```

**Remplacer le contenu par :**
```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:  # Remplacer par votre interface
      dhcp4: no
      addresses:
        - 192.168.1.100/24  # IP statique souhaitée
      routes:
        - to: default
          via: 192.168.1.1  # Gateway (votre box Internet)
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

**Appliquer la configuration :**
```bash
sudo netplan apply
```

**Vérifier :**
```bash
ip addr show enp0s3
# Doit afficher : inet 192.168.1.100/24
```

### Étape 6.3 : Tester la connectivité

```bash
# Depuis la VM : Ping vers Internet
ping -c 4 google.com

# Afficher l'IP publique
curl ifconfig.me
```

---

## 7. 🔐 Configuration SSH

### Étape 7.1 : Tester SSH depuis Windows

**Sur votre PC Windows (PowerShell) :**

```powershell
# Remplacer 192.168.1.100 par l'IP de votre VM
ssh ubuntu@192.168.1.100
```

**Première connexion :**
- Message : `Are you sure you want to continue connecting (yes/no)?`
- Taper : `yes`
- Entrer le mot de passe : `ubuntu2026`

**✅ Si connexion OK → SSH fonctionne !**

### Étape 7.2 : Configuration SSH pour la sécurité

**Sur la VM :**

```bash
# Éditer la configuration SSH
sudo nano /etc/ssh/sshd_config
```

**Modifications recommandées :**
```bash
# Autoriser l'authentification par clé
PubkeyAuthentication yes

# Désactiver le login root SSH (sécurité)
PermitRootLogin no

# Optionnel : Désactiver l'authentification par mot de passe (après avoir configuré les clés)
# PasswordAuthentication no
```

**Redémarrer SSH :**
```bash
sudo systemctl restart sshd
```

---

## 8. 🐳 Installation Docker et Dépendances

### Étape 8.1 : Vérifier Docker (déjà installé via Snap)

```bash
docker --version
# Docker version 24.0.x, build ...
```

**Si Docker n'est pas installé :**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh
```

### Étape 8.2 : Ajouter l'utilisateur ubuntu au groupe docker

```bash
sudo usermod -aG docker ubuntu
```

**⚠️ Déconnecter et reconnecter pour appliquer :**
```bash
exit
```

**Reconnectez-vous via SSH :**
```powershell
ssh ubuntu@192.168.1.100
```

**Vérifier :**
```bash
docker ps
# Ne doit PAS afficher "permission denied"
```

### Étape 8.3 : Installer Docker Compose

```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
```

**Vérifier :**
```bash
docker compose version
# Docker Compose version v2.x.x
```

### Étape 8.4 : Installer les outils nécessaires

```bash
sudo apt-get install -y git curl wget unzip
```

---

## 9. 👤 Configuration Utilisateur Deploy

### Étape 9.1 : Créer l'utilisateur `deploy`

```bash
# Créer l'utilisateur
sudo useradd -m -s /bin/bash deploy

# Ajouter au groupe docker
sudo usermod -aG docker deploy

# Définir un mot de passe (optionnel, on utilisera les clés SSH)
sudo passwd deploy
# Entrer : deploy2026
```

### Étape 9.2 : Créer les répertoires de déploiement

```bash
# Créer la structure
sudo mkdir -p /opt/bfb-management/{releases,shared,current}

# Donner les permissions à deploy
sudo chown -R deploy:deploy /opt/bfb-management

# Vérifier
ls -la /opt/bfb-management/
```

**Structure attendue :**
```
/opt/bfb-management/
├── current/       # Lien symbolique vers la version active
├── releases/      # Historique des déploiements
└── shared/        # Fichiers partagés (logs, data)
```

### Étape 9.3 : Configurer SSH pour l'utilisateur deploy

```bash
# Créer le répertoire .ssh
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chown deploy:deploy /home/deploy/.ssh
```

---

## 10. 🔑 Configuration des Clés SSH (Depuis Windows)

### Étape 10.1 : Générer une paire de clés SSH sur Windows

**Sur votre PC Windows (PowerShell) :**

```powershell
# Créer le répertoire .ssh s'il n'existe pas
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh"

# Se placer dans le répertoire cicd-platform/ssh
cd C:\Users\QL6479\SchoolDevs\Devops\cicd-platform\ssh

# Générer une clé SSH
ssh-keygen -t ed25519 -C "cicd-deploy-key" -f id_rsa -N '""'
```

**Fichiers créés :**
- `id_rsa` : Clé privée (à garder secret)
- `id_rsa.pub` : Clé publique (à copier sur la VM)

### Étape 10.2 : Copier la clé publique sur la VM

```powershell
# Afficher la clé publique
Get-Content .\id_rsa.pub

# Copier la clé sur la VM (utilisateur deploy)
type .\id_rsa.pub | ssh ubuntu@192.168.1.100 "sudo tee -a /home/deploy/.ssh/authorized_keys"
```

**Sur la VM (pour finaliser) :**
```bash
# Définir les permissions correctes
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

### Étape 10.3 : Tester la connexion sans mot de passe

**Depuis Windows :**
```powershell
ssh -i .\id_rsa deploy@192.168.1.100 "echo 'SSH Key Authentication OK!'"
```

**✅ Attendu : `SSH Key Authentication OK!` (sans demander de mot de passe)**

---

## 11. ⚙️ Configuration de la Plateforme CI/CD

### Étape 11.1 : Mettre à jour le fichier .env

**Sur Windows, ouvrir :**
```
C:\Users\QL6479\SchoolDevs\Devops\cicd-platform\backend\.env
```

**Modifier les lignes suivantes :**
```bash
# Passer en mode réel
PIPELINE_MODE=real

# Configuration VM
VM_HOST=192.168.1.100           # Votre IP VM
VM_PORT=22
VM_USER=deploy
VM_SSH_PRIVATE_KEY=/app/ssh/id_rsa  # Chemin dans le container Docker
```

### Étape 11.2 : Vérifier le montage de la clé SSH

**Ouvrir :**
```
C:\Users\QL6479\SchoolDevs\Devops\cicd-platform\docker-compose.yml
```

**Vérifier la section `volumes` du service `backend` :**
```yaml
services:
  backend:
    volumes:
      - ./ssh:/app/ssh:ro  # Montage de la clé SSH en lecture seule
```

### Étape 11.3 : Redémarrer la plateforme CI/CD

```powershell
cd C:\Users\QL6479\SchoolDevs\Devops\cicd-platform

# Arrêter les services
docker compose down

# Reconstruire et redémarrer
docker compose up -d --build

# Vérifier les logs
docker compose logs -f backend
```

---

## 12. ✅ Tests de Validation

### Test 1 : Connexion SSH depuis le container backend

```powershell
# Entrer dans le container backend
docker compose exec backend sh

# Tester SSH vers la VM
ssh -i /app/ssh/id_rsa -o StrictHostKeyChecking=no deploy@192.168.1.100 "hostname"
# Attendu : bfb-cicd

# Tester Docker sur la VM
ssh -i /app/ssh/id_rsa deploy@192.168.1.100 "docker ps"
# Attendu : Liste vide ou conteneurs existants

exit
```

### Test 2 : Déploiement manuel de test

**Créer un fichier de test sur la VM :**
```powershell
ssh -i .\cicd-platform\ssh\id_rsa deploy@192.168.1.100 @"
echo 'Hello from CI/CD!' > /opt/bfb-management/test.txt
cat /opt/bfb-management/test.txt
"@
```

### Test 3 : Lancer un pipeline de test

1. Ouvrir : http://localhost:3000
2. Se connecter avec GitHub OAuth
3. Créer un nouveau pipeline
4. Observer les logs en temps réel

---

## 13. 🔧 Dépannage

### Problème 1 : "Connection timed out" lors du ping

**Causes possibles :**
- VM éteinte
- Mauvaise configuration réseau (NAT au lieu de Bridge)
- Firewall Windows bloque ICMP

**Solutions :**
```powershell
# Vérifier si la VM est allumée dans VirtualBox
# Vérifier le mode réseau : Configuration → Réseau → Accès par pont

# Désactiver temporairement le pare-feu Windows
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Réactiver après test
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

### Problème 2 : "Permission denied (publickey)"

**Causes :**
- Clé SSH mal configurée
- Permissions incorrectes

**Solutions :**
```bash
# Sur la VM
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh

# Vérifier le contenu
sudo cat /home/deploy/.ssh/authorized_keys
```

### Problème 3 : "docker: permission denied"

**Solution :**
```bash
# Ajouter deploy au groupe docker
sudo usermod -aG docker deploy

# Redémarrer le service docker
sudo systemctl restart docker

# Se déconnecter et reconnecter
exit
```

### Problème 4 : IP de la VM change

**Solution : IP statique (voir section 6.2)**

### Problème 5 : Cannot connect from backend container

**Vérifier le montage de la clé :**
```powershell
docker compose exec backend ls -la /app/ssh/
# Doit afficher : id_rsa et id_rsa.pub
```

**Vérifier les permissions :**
```powershell
# La clé doit être en lecture seule
chmod 600 .\cicd-platform\ssh\id_rsa
```

---

## 14. 📊 Checklist Finale

- [ ] VirtualBox installé (version 7.0+)
- [ ] VM Ubuntu créée avec 4GB RAM, 30GB disque
- [ ] Réseau en mode **Accès par pont**
- [ ] Ubuntu Server installé avec OpenSSH
- [ ] IP statique configurée (192.168.1.100)
- [ ] Ping fonctionne depuis Windows
- [ ] SSH fonctionne : `ssh ubuntu@192.168.1.100`
- [ ] Docker installé et fonctionnel
- [ ] Utilisateur `deploy` créé et dans le groupe docker
- [ ] Répertoire `/opt/bfb-management/` créé
- [ ] Clé SSH générée dans `cicd-platform/ssh/`
- [ ] Clé publique copiée dans `/home/deploy/.ssh/authorized_keys`
- [ ] Connexion SSH sans mot de passe fonctionne
- [ ] Fichier `.env` mis à jour avec `PIPELINE_MODE=real` et `VM_HOST=192.168.1.100`
- [ ] Plateforme CI/CD redémarrée : `docker compose up -d`
- [ ] Test SSH depuis container backend réussi

---

## 15. 🎯 Prochaines Étapes

1. **Configurer le webhook GitHub** (voir README-CICD.md)
2. **Lancer un premier pipeline de déploiement**
3. **Tester le rollback automatique**
4. **Configurer SonarQube** (optionnel)
5. **Préparer la présentation du 9 janvier**

---

## 📞 Support

**En cas de problème :**
1. Vérifier les logs : `docker compose logs backend`
2. Vérifier la connectivité : `Test-NetConnection -ComputerName 192.168.1.100 -Port 22`
3. Consulter la section Dépannage ci-dessus

**Documentation complète :** `README-CICD.md`

---

**🎉 Félicitations ! Votre VM est prête pour le CI/CD !**
