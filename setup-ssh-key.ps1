# Script pour configurer la clé SSH pour le CI/CD

Write-Host "🔑 Configuration de la clé SSH pour le déploiement..." -ForegroundColor Cyan

# Créer le dossier ssh s'il n'existe pas
$sshDir = Join-Path $PSScriptRoot "ssh"
if (!(Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
    Write-Host "✅ Dossier ssh créé" -ForegroundColor Green
}

# Copier la clé privée
$sourceKey = Join-Path $env:USERPROFILE ".ssh\bfb-cicd-deploy"
$destKey = Join-Path $sshDir "vm_deployer"

if (Test-Path $sourceKey) {
    Copy-Item $sourceKey -Destination $destKey -Force
    Write-Host "✅ Clé SSH copiée: $destKey" -ForegroundColor Green
    
    # Vérifier la clé
    $firstLine = Get-Content $destKey | Select-Object -First 1
    Write-Host "   Premier ligne de la clé: $firstLine" -ForegroundColor Gray
} else {
    Write-Host "❌ Clé source introuvable: $sourceKey" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Configuration SSH terminée!" -ForegroundColor Green
Write-Host "📝 Clé disponible pour Docker: ./ssh/vm_deployer" -ForegroundColor Cyan
