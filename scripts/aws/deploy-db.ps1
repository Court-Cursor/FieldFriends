param(
    [string]$ConfigFile = "scripts/aws/deploy-db.env"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$deployScript = Join-Path $PSScriptRoot "deploy.ps1"
& $deployScript -ConfigFile $ConfigFile -DeployDatabase -SkipBackend -SkipFrontend
exit $LASTEXITCODE
