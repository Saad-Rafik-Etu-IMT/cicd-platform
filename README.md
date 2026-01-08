# 🚀 CI/CD Platform - Quick Start Guide

## 📋 Prerequisites

- Docker Desktop (installed and running)
- Git
- SSH access to VM

## 🔧 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Saad-Rafik-Etu-IMT/cicd-platform.git
cd cicd-platform
```

### 2. Configure Environment Variables
```bash
# Copy example configuration
cp .env.example .env

# Edit .env file and fill in:
# - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (from GitHub OAuth App)
# - JWT_SECRET (generate random string)
# - VM_HOST / VM_USER (your VM configuration)
# - SONAR_TOKEN (get from SonarQube after first startup)
```

### 3. Configure SSH Keys
```bash
# Create ssh directory
mkdir -p ssh

# Generate new SSH key pair
ssh-keygen -t ed25519 -f ssh/vm_deployer -N ""

# Copy public key to VM
ssh-copy-id -i ssh/vm_deployer.pub yuzhe@192.168.59.130
```

### 4. Start Services
```bash
docker compose up -d --build
```

### 5. Configure SonarQube Token
```bash
# Wait for SonarQube to start (about 2 minutes)
# Visit http://localhost:9001
# Login: admin / admin (change password on first login)

# Generate Token:
curl -X POST -u admin:newpassword "http://localhost:9001/api/user_tokens/generate?name=cicd-token"

# Add the returned token to SONAR_TOKEN in .env file
```

### 6. Restart Backend
```bash
docker compose restart backend
```

### 7. Start Git Polling
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3002/api/poller/start" -Method POST

# Or Bash
curl -X POST http://localhost:3002/api/poller/start
```

## 🌐 Access URLs

| Service | URL |
|---------|-----|
| Frontend Dashboard | http://localhost:3000 |
| Backend API | http://localhost:3002 |
| SonarQube | http://localhost:9001 |
| OWASP ZAP | http://localhost:8090 |

## 🔐 GitHub OAuth Configuration

1. Visit https://github.com/settings/developers
2. Create new OAuth App
3. Configure:
   - Application name: `CI/CD Platform`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3002/api/auth/github/callback`
4. Add Client ID and Client Secret to `.env`

## 🖥️ VM Requirements

VM needs to have installed:
- Docker
- Docker Compose (optional)

```bash
# Install Docker on VM
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

## 📁 Project Structure

```
cicd-platform/
├── .env.example      # Environment variables example
├── .env              # Your config (don't commit!)
├── docker-compose.yml
├── backend/          # Node.js API
├── frontend/         # React Dashboard
├── ssh/              # SSH keys (don't commit!)
│   ├── vm_deployer   # Private key
│   └── vm_deployer.pub
└── kubernetes/       # K8s config (bonus)
```

## ⚠️ Security Notes

**The following files contain sensitive information, never commit to Git:**
- `.env` - Contains passwords, keys, tokens
- `ssh/vm_deployer` - SSH private key
- `ssh/vm_deployer.pub` - SSH public key

## 🔄 Git Polling vs Webhook

| Method | Pros | Cons |
|--------|------|------|
| Git Polling | No public network access needed | Has delay (default 5s) |
| Webhook | Real-time trigger | Requires ngrok to expose local service |

## 🛠️ Common Commands

```bash
# View service status
docker compose ps

# View backend logs
docker compose logs -f backend

# Restart all services
docker compose restart

# Stop all services
docker compose down

# Full cleanup (including data)
docker compose down -v
```

## 📞 Troubleshooting

### SSH Connection Failed
```bash
# Test SSH connection
ssh -i ssh/vm_deployer yuzhe@192.168.59.130

# Check key permissions
chmod 600 ssh/vm_deployer
```

### SonarQube Won't Start
```bash
# Check logs
docker compose logs sonarqube

# May need to increase vm.max_map_count (Linux)
sudo sysctl -w vm.max_map_count=262144
```

### Pipeline Failed
```bash
# View detailed logs
docker compose logs -f backend
```
