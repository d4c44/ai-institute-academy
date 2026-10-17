# One-time local database setup (Windows). Creates the application role and database from init.sql,
# using the password from backend\.env (DATABASE_URL). psql will ask for the password of the
# PostgreSQL superuser "postgres": type it in this window; it is not stored anywhere.
#
#   & .\backend\db\setup-local.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root 'backend\.env'
if (-not (Test-Path $envFile)) { throw "backend\.env not found. Copy backend\.env.example to backend\.env first." }

$line = Select-String -Path $envFile -Pattern '^DATABASE_URL=postgres://ai_institute:([^@]+)@' | Select-Object -First 1
if (-not $line) { throw "DATABASE_URL in backend\.env must look like postgres://ai_institute:PASSWORD@localhost:5432/ai_institute" }
$password = $line.Matches[0].Groups[1].Value

$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
if (-not (Test-Path $psql)) { $psql = 'psql' }

& $psql -U postgres -h localhost -v "app_password=$password" -f (Join-Path $root 'backend\db\init.sql')
if ($LASTEXITCODE -ne 0) { throw "psql failed (exit code $LASTEXITCODE). If the role already exists, nothing more to do." }
Write-Host "Done: database ai_institute is ready." -ForegroundColor Green
