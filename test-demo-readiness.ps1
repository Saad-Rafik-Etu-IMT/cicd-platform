# 🧪 Script de Test Pré-Démonstration
# Date: 7 janvier 2026
# Usage: .\test-demo-readiness.ps1

Write-Host "🎬 VÉRIFICATION DE LA PRÉPARATION POUR LA DÉMO" -ForegroundColor Cyan
Write-Host "=" * 60

$global:passCount = 0
$global:failCount = 0
$global:warnCount = 0

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$Level = "CRITICAL" # CRITICAL, IMPORTANT, OPTIONAL
    )
    
    Write-Host "`n[$Level] $Name..." -NoNewline
    try {
        $result = & $Test
        if ($result) {
            Write-Host " ✅ PASS" -ForegroundColor Green
            $global:passCount++
            return $true
        } else {
            if ($Level -eq "CRITICAL") {
                Write-Host " ❌ FAIL" -ForegroundColor Red
                $global:failCount++
            } else {
                Write-Host " ⚠️ WARN" -ForegroundColor Yellow
                $global:warnCount++
            }
            return $false
        }
    } catch {
        Write-Host " ❌ ERROR: $_" -ForegroundColor Red
        $global:failCount++
        return $false
    }
}

# 1. INFRASTRUCTURE
Write-Host "`n📦 1. TESTS INFRASTRUCTURE" -ForegroundColor Yellow

Test-Check "Docker est démarré" {
    docker version > $null 2>&1
    return $LASTEXITCODE -eq 0
} -Level "CRITICAL"

Test-Check "Tous les conteneurs sont UP" {
    $containers = docker ps --filter "name=cicd-" --format "{{.Names}}"
    $expected = @("cicd-backend", "cicd-frontend", "cicd-postgres", "cicd-redis")
    $expected | ForEach-Object {
        if ($containers -notcontains $_) { return $false }
    }
    return $true
} -Level "CRITICAL"

Test-Check "Backend est healthy" {
    $status = docker inspect cicd-backend --format '{{.State.Health.Status}}'
    return $status -eq "healthy"
} -Level "CRITICAL"

Test-Check "PostgreSQL est accessible" {
    docker exec cicd-postgres pg_isready -U cicd_user -d cicd_db > $null 2>&1
    return $LASTEXITCODE -eq 0
} -Level "CRITICAL"

Test-Check "Redis est accessible" {
    $pong = docker exec cicd-redis redis-cli PING
    return $pong -eq "PONG"
} -Level "CRITICAL"

# 2. API ENDPOINTS
Write-Host "`n🌐 2. TESTS API ENDPOINTS" -ForegroundColor Yellow

Test-Check "Health check endpoint" {
    $response = Invoke-RestMethod -Uri "http://localhost:3002/health" -Method GET
    return $response.status -eq "ok"
} -Level "CRITICAL"

Test-Check "Frontend est accessible" {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
} -Level "CRITICAL"

Test-Check "Routes protégées nécessitent auth" {
    try {
        Invoke-RestMethod -Uri "http://localhost:3002/api/pipelines" -Method GET -ErrorAction Stop
        return $false # Ne devrait pas réussir sans token
    } catch {
        return $_.Exception.Response.StatusCode -eq 401
    }
} -Level "IMPORTANT"

# 3. BASE DE DONNÉES
Write-Host "`n🗄️ 3. TESTS BASE DE DONNÉES" -ForegroundColor Yellow

Test-Check "Toutes les tables existent" {
    $tables = docker exec cicd-postgres psql -U cicd_user -d cicd_db -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';"
    $expected = @("users", "pipelines", "pipeline_logs", "deployments", "env_variables", "pentest_reports")
    $tableList = $tables -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $expected | ForEach-Object {
        if ($tableList -notcontains $_) { return $false }
    }
    return $true
} -Level "CRITICAL"

Test-Check "Des utilisateurs existent" {
    $count = docker exec cicd-postgres psql -U cicd_user -d cicd_db -t -c "SELECT COUNT(*) FROM users;"
    return [int]$count.Trim() -gt 0
} -Level "IMPORTANT"

Test-Check "Des pipelines existent" {
    $count = docker exec cicd-postgres psql -U cicd_user -d cicd_db -t -c "SELECT COUNT(*) FROM pipelines;"
    return [int]$count.Trim() -gt 0
} -Level "OPTIONAL"

# 4. PROJET DEMO
Write-Host "`n☕ 4. TESTS PROJET DEMO (Java)" -ForegroundColor Yellow

Test-Check "Projet demo existe" {
    return Test-Path "c:\Users\QL6479\SchoolDevs\Devops\demo\pom.xml"
} -Level "CRITICAL"

Test-Check "Tests JUnit ont été exécutés" {
    $reportCount = (Get-ChildItem "c:\Users\QL6479\SchoolDevs\Devops\demo\target\surefire-reports\*.txt" -ErrorAction SilentlyContinue).Count
    return $reportCount -gt 0
} -Level "IMPORTANT"

Test-Check "Couverture JaCoCo existe" {
    return Test-Path "c:\Users\QL6479\SchoolDevs\Devops\demo\target\jacoco.exec"
} -Level "IMPORTANT"

Test-Check "JAR compilé existe" {
    $jar = Get-ChildItem "c:\Users\QL6479\SchoolDevs\Devops\demo\target\*.jar" -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $jar
} -Level "OPTIONAL"

# 5. SÉCURITÉ
Write-Host "`n🔐 5. TESTS SÉCURITÉ" -ForegroundColor Yellow

Test-Check "JWT_SECRET est configuré" {
    $envContent = Get-Content "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\.env" -Raw
    return $envContent -match "JWT_SECRET=.+"
} -Level "CRITICAL"

Test-Check "GITHUB_CLIENT_ID est configuré" {
    $envContent = Get-Content "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\.env" -Raw
    return $envContent -match "GITHUB_CLIENT_ID=.+"
} -Level "CRITICAL"

Test-Check "Middleware d erreur global existe" {
    $serverContent = Get-Content "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\backend\src\server.js" -Raw
    return $serverContent -match "Global error handler"
} -Level "IMPORTANT"

# 6. UI/UX
Write-Host "`n🎨 6. TESTS UI/UX" -ForegroundColor Yellow

Test-Check "Composant LoadingSpinner existe" {
    return Test-Path "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\frontend\src\components\LoadingSpinner.jsx"
} -Level "IMPORTANT"

Test-Check "Composant ConfirmModal existe" {
    return Test-Path "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\frontend\src\components\ConfirmModal.jsx"
} -Level "IMPORTANT"

Test-Check "Icônes SVG étendues" {
    $iconsContent = Get-Content "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\frontend\src\components\Icons.jsx" -Raw
    return ($iconsContent -match "chart:") -and ($iconsContent -match "crown:") -and ($iconsContent -match "lightbulb:")
} -Level "IMPORTANT"

Test-Check "Formatters utilitaires existent" {
    return Test-Path "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\frontend\src\utils\formatters.js"
} -Level "OPTIONAL"

# 7. FICHIERS DE DÉMONSTRATION
Write-Host "`n📄 7. FICHIERS DE DÉMONSTRATION" -ForegroundColor Yellow

Test-Check "Plan de démo existe" {
    return Test-Path "c:\Users\QL6479\SchoolDevs\Devops\PLAN-DEMO.md"
} -Level "IMPORTANT"

Test-Check "README backend existe" {
    return Test-Path "c:\Users\QL6479\SchoolDevs\Devops\cicd-platform\README.md"
} -Level "OPTIONAL"

# RÉSUMÉ
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ DES TESTS" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

$total = $global:passCount + $global:failCount + $global:warnCount

Write-Host "`n✅ PASS: " -NoNewline -ForegroundColor Green
Write-Host "$global:passCount/$total"

if ($global:failCount -gt 0) {
    Write-Host "❌ FAIL: " -NoNewline -ForegroundColor Red
    Write-Host "$global:failCount/$total"
}

if ($global:warnCount -gt 0) {
    Write-Host "⚠️  WARN: " -NoNewline -ForegroundColor Yellow
    Write-Host "$global:warnCount/$total"
}

Write-Host "`n"

if ($global:failCount -eq 0) {
    Write-Host "🎉 TOUS LES TESTS CRITIQUES SONT PASSÉS !" -ForegroundColor Green
    Write-Host "✅ La plateforme est prête pour la démonstration du 9 janvier." -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  ATTENTION: $global:failCount test(s) critique(s) ont échoué." -ForegroundColor Red
    Write-Host "❌ Veuillez corriger les problèmes avant la démonstration." -ForegroundColor Red
    exit 1
}
