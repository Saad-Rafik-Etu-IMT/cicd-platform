# 🚀 CI/CD Platform - 快速启动指南

## 📋 前置要求

- Docker Desktop (已安装并运行)
- Git
- 对 VM 的 SSH 访问权限

## 🔧 快速启动

### 1. 克隆项目
```bash
git clone https://github.com/Saad-Rafik-Etu-IMT/cicd-platform.git
cd cicd-platform
```

### 2. 配置环境变量
```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件，填写以下配置：
# - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (从 GitHub OAuth App 获取)
# - JWT_SECRET (生成随机字符串)
# - VM_HOST / VM_USER (你的虚拟机配置)
# - SONAR_TOKEN (首次启动后从 SonarQube 获取)
```

### 3. 配置 SSH 密钥
```bash
# 创建 ssh 目录
mkdir -p ssh

# 生成新的 SSH 密钥对
ssh-keygen -t ed25519 -f ssh/vm_deployer -N ""

# 将公钥复制到 VM
ssh-copy-id -i ssh/vm_deployer.pub yuzhe@192.168.59.130
```

### 4. 启动服务
```bash
docker compose up -d --build
```

### 5. 配置 SonarQube Token
```bash
# 等待 SonarQube 启动 (约2分钟)
# 访问 http://localhost:9001
# 登录: admin / admin (首次登录需改密码)

# 生成 Token:
curl -X POST -u admin:新密码 "http://localhost:9001/api/user_tokens/generate?name=cicd-token"

# 将返回的 token 添加到 .env 文件的 SONAR_TOKEN
```

### 6. 重启后端
```bash
docker compose restart backend
```

### 7. 启动 Git Polling
```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3002/api/poller/start" -Method POST

# 或 Bash
curl -X POST http://localhost:3002/api/poller/start
```

## 🌐 访问地址

| 服务 | URL |
|------|-----|
| 前端 Dashboard | http://localhost:3000 |
| 后端 API | http://localhost:3002 |
| SonarQube | http://localhost:9001 |
| OWASP ZAP | http://localhost:8090 |

## 🔐 GitHub OAuth 配置

1. 访问 https://github.com/settings/developers
2. 创建新的 OAuth App
3. 配置：
   - Application name: `CI/CD Platform`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3002/api/auth/github/callback`
4. 将 Client ID 和 Client Secret 填入 `.env`

## 🖥️ VM 要求

VM 需要安装：
- Docker
- Docker Compose (可选)

```bash
# 在 VM 上安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

## 📁 项目结构

```
cicd-platform/
├── .env.example      # 环境变量示例
├── .env              # 你的配置 (不要提交!)
├── docker-compose.yml
├── backend/          # Node.js API
├── frontend/         # React Dashboard
├── ssh/              # SSH 密钥 (不要提交!)
│   ├── vm_deployer   # 私钥
│   └── vm_deployer.pub
└── kubernetes/       # K8s 配置 (bonus)
```

## ⚠️ 安全注意事项

**以下文件包含敏感信息，绝对不要提交到 Git：**
- `.env` - 包含密码、密钥、Token
- `ssh/vm_deployer` - SSH 私钥
- `ssh/vm_deployer.pub` - SSH 公钥

## 🔄 Git Polling vs Webhook

| 方式 | 优点 | 缺点 |
|------|------|------|
| Git Polling | 无需公网访问 | 有延迟 (默认5秒) |
| Webhook | 实时触发 | 需要 ngrok 暴露本地服务 |

## 🛠️ 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看后端日志
docker compose logs -f backend

# 重启所有服务
docker compose restart

# 停止所有服务
docker compose down

# 完全清理 (包括数据)
docker compose down -v
```

## 📞 问题排查

### SSH 连接失败
```bash
# 测试 SSH 连接
ssh -i ssh/vm_deployer yuzhe@192.168.59.130

# 检查密钥权限
chmod 600 ssh/vm_deployer
```

### SonarQube 无法启动
```bash
# 检查日志
docker compose logs sonarqube

# 可能需要增加 vm.max_map_count (Linux)
sudo sysctl -w vm.max_map_count=262144
```

### Pipeline 失败
```bash
# 查看详细日志
docker compose logs -f backend
```
