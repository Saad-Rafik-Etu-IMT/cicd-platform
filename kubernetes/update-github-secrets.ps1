# Script pour mettre à jour les secrets GitHub OAuth
# Usage: .\update-github-secrets.ps1 -ClientId "YOUR_CLIENT_ID" -ClientSecret "YOUR_CLIENT_SECRET"

param(
    [Parameter(Mandatory=$true)]
    [string]$ClientId,
    
    [Parameter(Mandatory=$true)]
    [string]$ClientSecret
)

Write-Host "🔐 Mise à jour des secrets GitHub OAuth..." -ForegroundColor Cyan

# Mettre à jour les secrets
kubectl patch secret cicd-backend-secrets -n cicd-platform `
    --type='json' `
    -p="[
        {`"op`": `"replace`", `"path`": `"/data/GITHUB_CLIENT_ID`", `"value`": `"$([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($ClientId)))`"},
        {`"op`": `"replace`", `"path`": `"/data/GITHUB_CLIENT_SECRET`", `"value`": `"$([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($ClientSecret)))`"}
    ]"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Secrets mis à jour avec succès" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔄 Redémarrage du backend..." -ForegroundColor Cyan
    kubectl rollout restart deployment/cicd-backend -n cicd-platform
    Write-Host "✅ Backend redémarré" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la mise à jour des secrets" -ForegroundColor Red
    exit 1
}
