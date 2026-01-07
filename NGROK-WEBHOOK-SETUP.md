# 🌐 Configuration ngrok + Webhook GitHub

**Date**: 2026-01-07  
**Statut**: Mode Production ACTIVÉ ✅

---

## ✅ Étape 1: Mode Production ACTIVÉ

```bash
✅ PIPELINE_MODE: production
✅ Backend redémarré avec nouvelle configuration
```

Les pipelines s'exécuteront maintenant réellement (Maven build, tests, SonarQube).

---

## 📥 Étape 2: Installation de ngrok

### Option A: Installation Manuelle (Recommandé)

1. **Téléchargez ngrok**:
   - Allez sur: https://ngrok.com/download
   - Téléchargez **Windows (64-bit)**
   - Extrayez `ngrok.exe` dans `C:\ngrok` (ou autre dossier)

2. **Créez un compte gratuit**:
   - https://dashboard.ngrok.com/signup
   - Gratuit, pas de carte bancaire requise

3. **Récupérez votre authtoken**:
   - Après connexion: https://dashboard.ngrok.com/get-started/your-authtoken
   - Copiez le token (ex: `2a8G7x...`)

4. **Configurez ngrok**:
```bash
cd C:\ngrok
.\ngrok config add-authtoken VOTRE_TOKEN_ICI
```

### Option B: Via Chocolatey (si vous avez Chocolatey)

```powershell
choco install ngrok
ngrok config add-authtoken VOTRE_TOKEN_ICI
```

---

## 🚀 Étape 3: Démarrer le Tunnel ngrok

### Commande à exécuter

```powershell
# Dans un nouveau terminal PowerShell
cd C:\ngrok
.\ngrok http 30002
```

**Résultat attendu**:
```
ngrok                                                                 

Session Status                online
Account                       votre-email@example.com
Version                       3.3.1
Region                        Europe (eu)
Latency                       20ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123def.ngrok-free.app -> http://localhost:30002

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

⚠️ **IMPORTANT**: 
- Copiez l'URL de forwarding (ex: `https://abc123def.ngrok-free.app`)
- Gardez ce terminal ouvert (ne pas fermer)
- Cette URL change à chaque redémarrage de ngrok (gratuit)

---

## 🔗 Étape 4: Configurer le Webhook GitHub

### 4.1 Accédez aux paramètres du repo

https://github.com/Saad-Rafik-Etu-IMT/demo/settings/hooks

### 4.2 Cliquez sur "Add webhook"

### 4.3 Configurez le webhook

| Champ | Valeur |
|-------|--------|
| **Payload URL** | `https://VOTRE_URL_NGROK.ngrok-free.app/api/webhooks/github` |
| **Content type** | `application/json` |
| **Secret** | `GvF7c54SDl6WydC8M2sOhgLQrAaYeHw3` |
| **SSL verification** | ✅ Enable SSL verification |
| **Which events?** | ⚪ Just the push event |
| **Active** | ✅ Checked |

**Exemple d'URL complète**:
```
https://abc123def.ngrok-free.app/api/webhooks/github
```

### 4.4 Cliquez sur "Add webhook"

GitHub va envoyer un événement `ping` pour tester.

### 4.5 Vérifiez le webhook

- ✅ Coche verte = Webhook fonctionne
- ❌ Croix rouge = Cliquez pour voir l'erreur

---

## 🧪 Étape 5: Tester le Webhook

### Test 1: Push Simple

```bash
cd C:\Users\QL6479\SchoolDevs\Devops\demo
echo "# Test webhook" >> README.md
git add .
git commit -m "test: webhook trigger"
git push origin master
```

### Que va-t-il se passer ?

**Dans ngrok (terminal)**:
```
POST /api/webhooks/github    200 OK
```

**Dans les logs backend**:
```bash
# Voir les logs en temps réel
kubectl logs -f deployment/cicd-backend -n cicd-platform
```

**Sur le frontend** (http://localhost:30000):
- Notification: "Pipeline #1 started"
- Logs en temps réel
- Résultat après 1-3 minutes

### Test 2: Push avec Erreur

```bash
# Introduire une erreur de compilation
echo "public class Bug { syntax error }" > src/main/java/com/bfb/Bug.java
git add .
git commit -m "test: error detection"
git push origin master
```

**Pipeline échouera à l'étape Build** avec les logs Maven détaillés.

---

## 🔍 Étape 6: Monitoring

### Web Interface ngrok

Ouvrez: http://127.0.0.1:4040

Vous verrez:
- Toutes les requêtes HTTP reçues
- Headers complets
- Body des webhooks
- Réponses envoyées

### Logs Backend Kubernetes

```bash
# Logs en temps réel
kubectl logs -f deployment/cicd-backend -n cicd-platform

# Dernières 100 lignes
kubectl logs --tail=100 deployment/cicd-backend -n cicd-platform
```

### Frontend Dashboard

http://localhost:30000
- Liste des pipelines
- Statut en temps réel
- Logs détaillés

---

## 🛑 Arrêter ngrok

Dans le terminal ngrok: `Ctrl + C`

⚠️ L'URL ngrok changera au prochain démarrage (version gratuite).

---

## 🔄 Redémarrer ngrok (après arrêt)

```powershell
cd C:\ngrok
.\ngrok http 30002
```

**IMPORTANT**: Mettez à jour l'URL du webhook GitHub avec la nouvelle URL ngrok !

---

## 💡 Workflow Complet Automatique

Une fois configuré:

```
1. Vous modifiez le code dans demo/
2. git push origin master
3. GitHub envoie webhook → ngrok → votre backend
4. Pipeline démarre automatiquement
5. Build → Tests → SonarQube → Deploy
6. Notification de succès/échec
7. Logs consultables sur le frontend
```

**Temps total**: 2-5 minutes selon la taille du projet

---

## 🎯 URLs Importantes

| Service | URL |
|---------|-----|
| **Frontend Dashboard** | http://localhost:30000 |
| **Backend API** | http://localhost:30002 |
| **SonarQube** | http://localhost:30090 |
| **ngrok Web Interface** | http://127.0.0.1:4040 |
| **ngrok Public URL** | https://VOTRE_URL.ngrok-free.app |
| **Webhook GitHub** | https://VOTRE_URL.ngrok-free.app/api/webhooks/github |

---

## 📋 Checklist de Configuration

- [x] Mode production activé
- [ ] ngrok téléchargé et extrait
- [ ] Compte ngrok créé
- [ ] Authtoken configuré (`ngrok config add-authtoken`)
- [ ] ngrok démarré (`ngrok http 30002`)
- [ ] URL ngrok copiée
- [ ] Webhook GitHub configuré
- [ ] Test push effectué
- [ ] Pipeline exécuté avec succès

---

## 🔒 Sécurité

### Webhook Secret

Le secret `GvF7c54SDl6WydC8M2sOhgLQrAaYeHw3` est utilisé pour:
- Vérifier que les webhooks viennent bien de GitHub
- Signature HMAC-SHA256
- Protection contre les requêtes malveillantes

### SSL/TLS

ngrok fournit automatiquement:
- Certificat SSL valide
- HTTPS activé
- Trafic chiffré

---

## 🆘 Dépannage

### Problème: Webhook ne se déclenche pas

```bash
# 1. Vérifier que ngrok tourne
# Terminal ngrok doit afficher "Session Status: online"

# 2. Vérifier les logs backend
kubectl logs --tail=50 deployment/cicd-backend -n cicd-platform

# 3. Vérifier le webhook GitHub
# GitHub → Settings → Webhooks → Recent Deliveries
# Cliquez sur un delivery pour voir la réponse
```

### Problème: Pipeline en erreur

```bash
# Voir les logs détaillés
kubectl logs deployment/cicd-backend -n cicd-platform | grep -A 20 "pipeline"

# Vérifier le mode
kubectl get configmap cicd-backend-config -n cicd-platform -o jsonpath='{.data.PIPELINE_MODE}'
# Doit afficher: production
```

### Problème: ngrok "ERR_NGROK_108"

Vous avez dépassé la limite gratuite (trop de connexions).
- Attendez 1 heure
- Ou créez un nouveau compte gratuit

---

## 🚀 Prochaines Étapes

1. **Configurer SonarQube Token** (pour l'analyse de code)
2. **Configurer la VM de déploiement** (pour le déploiement réel)
3. **Ajouter des notifications** (email, Slack)
4. **Configurer des environnements** (dev, staging, prod)

---

## 💰 ngrok Version Gratuite vs Payante

### Gratuit (Suffisant pour développement)
- ✅ 1 tunnel actif
- ✅ HTTPS
- ✅ 40 connexions/minute
- ⚠️ URL change à chaque redémarrage
- ⚠️ Session timeout après 2h d'inactivité

### Payant ($8/mois)
- ✅ URL fixe (sous-domaine personnalisé)
- ✅ Pas de timeout
- ✅ Plus de connexions
- ✅ Multi-tunnels

**Pour ce projet**: La version gratuite suffit largement !
