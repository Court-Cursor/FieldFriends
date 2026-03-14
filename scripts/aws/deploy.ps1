param(
    [string]$ConfigFile = "scripts/aws/deploy.env",
    [switch]$DeployDatabase,
    [switch]$SkipBackend,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message"
}

function Resolve-ConfigPath {
    param(
        [string]$BasePath,
        [string]$CandidatePath
    )

    if ([System.IO.Path]::IsPathRooted($CandidatePath)) {
        return (Resolve-Path $CandidatePath).Path
    }

    return (Resolve-Path (Join-Path $BasePath $CandidatePath)).Path
}

function Read-KeyValueFile {
    param([string]$Path)

    $values = @{}
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) {
            throw "Invalid line in $Path: $line"
        }

        $values[$parts[0].Trim()] = $parts[1].Trim()
    }

    return $values
}

function Get-ConfigValue {
    param(
        [string]$Name,
        [string]$Default = "",
        [switch]$Required
    )

    $envValue = [Environment]::GetEnvironmentVariable($Name)
    if (-not [string]::IsNullOrWhiteSpace($envValue)) {
        return $envValue
    }

    if ($script:config.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($script:config[$Name])) {
        return $script:config[$Name]
    }

    if ($Required -and [string]::IsNullOrWhiteSpace($Default)) {
        throw "Missing required config value: $Name"
    }

    return $Default
}

function Get-ConfigList {
    param([string]$Name)

    $rawValue = Get-ConfigValue -Name $Name
    if ([string]::IsNullOrWhiteSpace($rawValue)) {
        return @()
    }

    return @(
        $rawValue.Split(",") |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}

function Get-ConfigBool {
    param(
        [string]$Name,
        [bool]$Default = $false
    )

    $rawValue = Get-ConfigValue -Name $Name
    if ([string]::IsNullOrWhiteSpace($rawValue)) {
        return $Default
    }

    switch ($rawValue.Trim().ToLowerInvariant()) {
        "1" { return $true }
        "true" { return $true }
        "yes" { return $true }
        "y" { return $true }
        "0" { return $false }
        "false" { return $false }
        "no" { return $false }
        "n" { return $false }
        default { throw "Invalid boolean value for $Name: $rawValue" }
    }
}

function Invoke-ExternalCommand {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [switch]$ParseJson,
        [string]$WorkingDirectory = ""
    )

    if ($WorkingDirectory) {
        Push-Location $WorkingDirectory
    }

    try {
        $output = & $Command @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        if ($WorkingDirectory) {
            Pop-Location
        }
    }

    if ($exitCode -ne 0) {
        $message = ($output | Out-String).Trim()
        throw "$Command failed with exit code $exitCode.`n$message"
    }

    $text = ($output | Out-String).Trim()
    if ($ParseJson) {
        if ([string]::IsNullOrWhiteSpace($text)) {
            return $null
        }

        return $text | ConvertFrom-Json
    }

    return $text
}

function Invoke-Aws {
    param(
        [string[]]$Arguments,
        [switch]$ParseJson,
        [string]$WorkingDirectory = ""
    )

    $fullArguments = @()
    if (-not [string]::IsNullOrWhiteSpace($script:awsProfile)) {
        $fullArguments += @("--profile", $script:awsProfile)
    }
    if (-not [string]::IsNullOrWhiteSpace($script:awsRegion)) {
        $fullArguments += @("--region", $script:awsRegion)
    }
    $fullArguments += $Arguments

    return Invoke-ExternalCommand -Command "aws" -Arguments $fullArguments -ParseJson:$ParseJson -WorkingDirectory $WorkingDirectory
}

function Invoke-Docker {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory = ""
    )

    return Invoke-ExternalCommand -Command "docker" -Arguments $Arguments -WorkingDirectory $WorkingDirectory
}

function Invoke-Npm {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory = ""
    )

    return Invoke-ExternalCommand -Command "npm" -Arguments $Arguments -WorkingDirectory $WorkingDirectory
}

function Write-JsonFile {
    param(
        [object]$Value,
        [string]$Path
    )

    $Value | ConvertTo-Json -Depth 10 | Set-Content -Path $Path -Encoding ASCII
}

function Test-S3BucketExists {
    param([string]$BucketName)

    try {
        Invoke-Aws -Arguments @("s3api", "head-bucket", "--bucket", $BucketName) | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Ensure-S3Bucket {
    param([string]$BucketName)

    if (Test-S3BucketExists -BucketName $BucketName) {
        return
    }

    Write-Step "Creating S3 bucket $BucketName"
    if ($script:awsRegion -eq "us-east-1") {
        Invoke-Aws -Arguments @("s3api", "create-bucket", "--bucket", $BucketName) -ParseJson | Out-Null
        return
    }

    Invoke-Aws -Arguments @(
        "s3api",
        "create-bucket",
        "--bucket",
        $BucketName,
        "--create-bucket-configuration",
        "LocationConstraint=$($script:awsRegion)"
    ) -ParseJson | Out-Null
}

function Get-DefaultVpcId {
    $vpcId = (Invoke-Aws -Arguments @("ec2", "describe-vpcs", "--filters", "Name=isDefault,Values=true", "--query", "Vpcs[0].VpcId", "--output", "text")).Trim()
    if ([string]::IsNullOrWhiteSpace($vpcId) -or $vpcId -eq "None") {
        throw "No default VPC found. Set VPC_ID and VPC_SUBNET_IDS in scripts/aws/deploy.env."
    }

    return $vpcId
}

function Get-VpcSubnetIds {
    param([string]$VpcId)

    $configuredSubnets = Get-ConfigList -Name "VPC_SUBNET_IDS"
    if ($configuredSubnets.Count -gt 0) {
        if ($configuredSubnets.Count -lt 2) {
            throw "VPC_SUBNET_IDS must contain at least 2 subnet IDs."
        }

        return $configuredSubnets
    }

    $response = Invoke-Aws -Arguments @(
        "ec2",
        "describe-subnets",
        "--filters",
        "Name=vpc-id,Values=$VpcId",
        "Name=state,Values=available",
        "--output",
        "json"
    ) -ParseJson

    $subnetIds = @(
        $response.Subnets |
        Sort-Object AvailabilityZone, SubnetId |
        Select-Object -ExpandProperty SubnetId
    )

    if ($subnetIds.Count -lt 2) {
        throw "At least 2 available subnets are required in VPC $VpcId."
    }

    return $subnetIds
}

function Get-SecurityGroupIdByName {
    param(
        [string]$VpcId,
        [string]$GroupName
    )

    $response = Invoke-Aws -Arguments @(
        "ec2",
        "describe-security-groups",
        "--filters",
        "Name=vpc-id,Values=$VpcId",
        "Name=group-name,Values=$GroupName",
        "--output",
        "json"
    ) -ParseJson

    if (-not $response.SecurityGroups -or $response.SecurityGroups.Count -eq 0) {
        return ""
    }

    return $response.SecurityGroups[0].GroupId
}

function Ensure-SecurityGroup {
    param(
        [string]$VpcId,
        [string]$GroupName,
        [string]$Description
    )

    $groupId = Get-SecurityGroupIdByName -VpcId $VpcId -GroupName $GroupName
    if (-not [string]::IsNullOrWhiteSpace($groupId)) {
        return $groupId
    }

    Write-Step "Creating security group $GroupName"
    $response = Invoke-Aws -Arguments @(
        "ec2",
        "create-security-group",
        "--group-name",
        $GroupName,
        "--description",
        $Description,
        "--vpc-id",
        $VpcId,
        "--output",
        "json"
    ) -ParseJson

    return $response.GroupId
}

function Ensure-SecurityGroupIngressFromGroup {
    param(
        [string]$TargetGroupId,
        [string]$SourceGroupId,
        [int]$Port
    )

    try {
        Invoke-Aws -Arguments @(
            "ec2",
            "authorize-security-group-ingress",
            "--group-id",
            $TargetGroupId,
            "--protocol",
            "tcp",
            "--port",
            $Port.ToString(),
            "--source-group",
            $SourceGroupId
        ) | Out-Null
    }
    catch {
        if ($_.Exception.Message -notmatch "InvalidPermission\.Duplicate") {
            throw
        }
    }
}

function Ensure-SecurityGroupIngressFromCidr {
    param(
        [string]$TargetGroupId,
        [string]$Cidr,
        [int]$Port
    )

    try {
        Invoke-Aws -Arguments @(
            "ec2",
            "authorize-security-group-ingress",
            "--group-id",
            $TargetGroupId,
            "--protocol",
            "tcp",
            "--port",
            $Port.ToString(),
            "--cidr",
            $Cidr
        ) | Out-Null
    }
    catch {
        if ($_.Exception.Message -notmatch "InvalidPermission\.Duplicate") {
            throw
        }
    }
}

function Get-RdsInstance {
    param([string]$DbInstanceIdentifier)

    try {
        $response = Invoke-Aws -Arguments @(
            "rds",
            "describe-db-instances",
            "--db-instance-identifier",
            $DbInstanceIdentifier,
            "--output",
            "json"
        ) -ParseJson
        return $response.DBInstances[0]
    }
    catch {
        if ($_.Exception.Message -match "DBInstanceNotFound") {
            return $null
        }

        throw
    }
}

function Ensure-DbSubnetGroup {
    param(
        [string]$SubnetGroupName,
        [string[]]$SubnetIds
    )

    try {
        Invoke-Aws -Arguments @(
            "rds",
            "describe-db-subnet-groups",
            "--db-subnet-group-name",
            $SubnetGroupName,
            "--output",
            "json"
        ) -ParseJson | Out-Null
        return
    }
    catch {
        if ($_.Exception.Message -notmatch "DBSubnetGroupNotFoundFault") {
            throw
        }
    }

    Write-Step "Creating DB subnet group $SubnetGroupName"
    $arguments = @(
        "rds",
        "create-db-subnet-group",
        "--db-subnet-group-name",
        $SubnetGroupName,
        "--db-subnet-group-description",
        "FieldFriends DB subnet group",
        "--subnet-ids"
    )
    $arguments += $SubnetIds
    Invoke-Aws -Arguments $arguments -ParseJson | Out-Null
}

function Get-AppRunnerVpcConnectorSummary {
    param([string]$ConnectorName)

    $response = Invoke-Aws -Arguments @("apprunner", "list-vpc-connectors", "--output", "json") -ParseJson
    if (-not $response) {
        return $null
    }

    return $response.VpcConnectors | Where-Object { $_.VpcConnectorName -eq $ConnectorName } | Select-Object -First 1
}

function Get-AppRunnerVpcConnector {
    param([string]$VpcConnectorArn)

    $response = Invoke-Aws -Arguments @(
        "apprunner",
        "describe-vpc-connector",
        "--vpc-connector-arn",
        $VpcConnectorArn,
        "--output",
        "json"
    ) -ParseJson

    return $response.VpcConnector
}

function Wait-AppRunnerVpcConnector {
    param([string]$VpcConnectorArn)

    while ($true) {
        $connector = Get-AppRunnerVpcConnector -VpcConnectorArn $VpcConnectorArn
        Write-Host "App Runner VPC connector status: $($connector.Status)"

        if ($connector.Status -eq "ACTIVE") {
            return $connector
        }

        if ($connector.Status -like "*FAILED*" -or $connector.Status -eq "INACTIVE") {
            throw "App Runner VPC connector failed with status $($connector.Status)."
        }

        Start-Sleep -Seconds 10
    }
}

function Ensure-AppRunnerVpcConnector {
    param(
        [string]$ConnectorName,
        [string[]]$SubnetIds,
        [string]$SecurityGroupId
    )

    $summary = Get-AppRunnerVpcConnectorSummary -ConnectorName $ConnectorName
    if ($summary) {
        $connector = Wait-AppRunnerVpcConnector -VpcConnectorArn $summary.VpcConnectorArn
        return $connector.VpcConnectorArn
    }

    Write-Step "Creating App Runner VPC connector $ConnectorName"
    $arguments = @(
        "apprunner",
        "create-vpc-connector",
        "--vpc-connector-name",
        $ConnectorName,
        "--subnets"
    )
    $arguments += $SubnetIds
    $arguments += @("--security-groups", $SecurityGroupId, "--output", "json")

    $response = Invoke-Aws -Arguments $arguments -ParseJson
    $connector = Wait-AppRunnerVpcConnector -VpcConnectorArn $response.VpcConnector.VpcConnectorArn
    return $connector.VpcConnectorArn
}

function Get-AppRunnerServiceSummary {
    param([string]$ServiceName)

    $response = Invoke-Aws -Arguments @("apprunner", "list-services", "--output", "json") -ParseJson
    if (-not $response) {
        return $null
    }

    return $response.ServiceSummaryList | Where-Object { $_.ServiceName -eq $ServiceName } | Select-Object -First 1
}

function Get-AppRunnerService {
    param([string]$ServiceArn)

    $response = Invoke-Aws -Arguments @("apprunner", "describe-service", "--service-arn", $ServiceArn, "--output", "json") -ParseJson
    return $response.Service
}

function Wait-AppRunnerService {
    param([string]$ServiceArn)

    while ($true) {
        $service = Get-AppRunnerService -ServiceArn $ServiceArn
        Write-Host "App Runner status: $($service.Status)"

        if ($service.Status -eq "RUNNING") {
            return $service
        }

        if ($service.Status -like "*FAILED*") {
            throw "App Runner deployment failed with status $($service.Status)."
        }

        Start-Sleep -Seconds 10
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$configPath = Resolve-ConfigPath -BasePath $repoRoot -CandidatePath $ConfigFile
$script:config = Read-KeyValueFile -Path $configPath

$script:awsProfile = Get-ConfigValue -Name "AWS_PROFILE"
$script:awsRegion = Get-ConfigValue -Name "AWS_REGION"
if ([string]::IsNullOrWhiteSpace($script:awsRegion)) {
    $script:awsRegion = (Invoke-ExternalCommand -Command "aws" -Arguments @("configure", "get", "region")).Trim()
}
if ([string]::IsNullOrWhiteSpace($script:awsRegion)) {
    throw "Set AWS_REGION in scripts/aws/deploy.env or configure a default region in the AWS CLI."
}

foreach ($requiredCommand in @("aws")) {
    if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $requiredCommand"
    }
}

if (-not $SkipBackend) {
    foreach ($requiredCommand in @("docker")) {
        if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
            throw "Required command not found: $requiredCommand"
        }
    }
}

if (-not $SkipFrontend) {
    foreach ($requiredCommand in @("npm")) {
        if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
            throw "Required command not found: $requiredCommand"
        }
    }
}

$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$tempDir = Join-Path $env:TEMP "fieldfriends-deploy"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$accountId = (Invoke-Aws -Arguments @("sts", "get-caller-identity", "--query", "Account", "--output", "text")).Trim()
$backendPort = "8000"

$ecrRepository = Get-ConfigValue -Name "ECR_REPOSITORY" -Default "fieldfriends-backend"
$backendImageTag = Get-ConfigValue -Name "BACKEND_IMAGE_TAG" -Default "latest"
$appRunnerServiceName = Get-ConfigValue -Name "APP_RUNNER_SERVICE" -Default "fieldfriends-backend"
$appRunnerCpu = Get-ConfigValue -Name "APP_RUNNER_CPU" -Default "1024"
$appRunnerMemory = Get-ConfigValue -Name "APP_RUNNER_MEMORY" -Default "2048"

$backendUrl = ""
$frontendBucket = ""
$databaseEndpoint = ""
$databaseName = ""
$databaseUsername = ""
$databaseSecurityGroupId = ""
$appRunnerVpcConnectorArn = ""

if ($DeployDatabase) {
    $vpcId = Get-ConfigValue -Name "VPC_ID"
    if ([string]::IsNullOrWhiteSpace($vpcId)) {
        $vpcId = Get-DefaultVpcId
    }

    $subnetIds = Get-VpcSubnetIds -VpcId $vpcId
    $dbInstanceIdentifier = Get-ConfigValue -Name "DB_INSTANCE_IDENTIFIER" -Default "fieldfriends-db"
    $dbSubnetGroup = Get-ConfigValue -Name "DB_SUBNET_GROUP" -Default "fieldfriends-db-subnets"
    $dbSecurityGroupName = Get-ConfigValue -Name "DB_SECURITY_GROUP" -Default "fieldfriends-db-sg"
    $appRunnerSecurityGroupName = Get-ConfigValue -Name "APP_RUNNER_VPC_SECURITY_GROUP" -Default "fieldfriends-apprunner-sg"
    $appRunnerVpcConnectorName = Get-ConfigValue -Name "APP_RUNNER_VPC_CONNECTOR" -Default "fieldfriends-apprunner-vpc"
    $databaseName = Get-ConfigValue -Name "DB_NAME" -Default "fieldfriends"
    $databaseUsername = Get-ConfigValue -Name "DB_USERNAME" -Default "fieldfriends"
    $databasePassword = Get-ConfigValue -Name "DB_MASTER_PASSWORD" -Required
    $dbInstanceClass = Get-ConfigValue -Name "DB_INSTANCE_CLASS" -Default "db.t3.micro"
    $dbAllocatedStorage = Get-ConfigValue -Name "DB_ALLOCATED_STORAGE" -Default "20"
    $dbEngineVersion = Get-ConfigValue -Name "DB_ENGINE_VERSION" -Default "16.3"
    $dbPublicAccess = Get-ConfigBool -Name "DB_PUBLIC_ACCESS" -Default $false
    $dbAllowedCidrs = Get-ConfigList -Name "DB_ALLOWED_CIDRS"

    $databaseSecurityGroupId = Ensure-SecurityGroup -VpcId $vpcId -GroupName $dbSecurityGroupName -Description "FieldFriends RDS access"
    if (-not $SkipBackend) {
        $appRunnerSecurityGroupId = Ensure-SecurityGroup -VpcId $vpcId -GroupName $appRunnerSecurityGroupName -Description "FieldFriends App Runner VPC connector"
        Ensure-SecurityGroupIngressFromGroup -TargetGroupId $databaseSecurityGroupId -SourceGroupId $appRunnerSecurityGroupId -Port 5432
    }
    if ($dbPublicAccess) {
        if ($dbAllowedCidrs.Count -eq 0) {
            throw "DB_ALLOWED_CIDRS is required when DB_PUBLIC_ACCESS=true."
        }

        foreach ($cidr in $dbAllowedCidrs) {
            Ensure-SecurityGroupIngressFromCidr -TargetGroupId $databaseSecurityGroupId -Cidr $cidr -Port 5432
        }
    }

    Ensure-DbSubnetGroup -SubnetGroupName $dbSubnetGroup -SubnetIds $subnetIds

    $existingDb = Get-RdsInstance -DbInstanceIdentifier $dbInstanceIdentifier
    if (-not $existingDb) {
        Write-Step "Creating RDS instance $dbInstanceIdentifier"
        $createArguments = @(
            "rds",
            "create-db-instance",
            "--db-instance-identifier",
            $dbInstanceIdentifier,
            "--engine",
            "postgres",
            "--engine-version",
            $dbEngineVersion,
            "--db-instance-class",
            $dbInstanceClass,
            "--allocated-storage",
            $dbAllocatedStorage,
            "--storage-type",
            "gp3",
            "--master-username",
            $databaseUsername,
            "--master-user-password",
            $databasePassword,
            "--db-name",
            $databaseName,
            "--db-subnet-group-name",
            $dbSubnetGroup,
            "--vpc-security-group-ids",
            $databaseSecurityGroupId,
            "--backup-retention-period",
            "7",
            "--no-multi-az",
            "--output",
            "json"
        )
        if ($dbPublicAccess) {
            $createArguments += "--publicly-accessible"
        }
        else {
            $createArguments += "--no-publicly-accessible"
        }
        Invoke-Aws -Arguments $createArguments -ParseJson | Out-Null
    }
    else {
        Write-Step "Using existing RDS instance $dbInstanceIdentifier"
    }

    Write-Step "Waiting for RDS instance $dbInstanceIdentifier"
    Invoke-Aws -Arguments @("rds", "wait", "db-instance-available", "--db-instance-identifier", $dbInstanceIdentifier) | Out-Null
    $dbInstance = Get-RdsInstance -DbInstanceIdentifier $dbInstanceIdentifier
    $databaseEndpoint = $dbInstance.Endpoint.Address

    if (-not $SkipBackend) {
        $appRunnerVpcConnectorArn = Ensure-AppRunnerVpcConnector -ConnectorName $appRunnerVpcConnectorName -SubnetIds $subnetIds -SecurityGroupId $appRunnerSecurityGroupId
    }
}

if (-not $SkipBackend) {
    $backendEnvFileSetting = Get-ConfigValue -Name "BACKEND_ENV_FILE" -Default "backend/.env.aws"
    $backendEnvFile = Resolve-ConfigPath -BasePath $repoRoot -CandidatePath $backendEnvFileSetting
    $backendEnv = Read-KeyValueFile -Path $backendEnvFile

    if ($DeployDatabase) {
        $backendEnv["DATABASE_URL"] = "postgresql+psycopg://${databaseUsername}:${databasePassword}@${databaseEndpoint}:5432/${databaseName}"
    }

    Write-Step "Ensuring ECR repository $ecrRepository exists"
    try {
        Invoke-Aws -Arguments @("ecr", "describe-repositories", "--repository-names", $ecrRepository, "--output", "json") -ParseJson | Out-Null
    }
    catch {
        Invoke-Aws -Arguments @(
            "ecr",
            "create-repository",
            "--repository-name",
            $ecrRepository,
            "--image-scanning-configuration",
            "scanOnPush=true",
            "--output",
            "json"
        ) -ParseJson | Out-Null
    }

    $registry = "${accountId}.dkr.ecr.$($script:awsRegion).amazonaws.com"
    $imageUri = "${registry}/${ecrRepository}:${backendImageTag}"

    Write-Step "Logging Docker into ECR"
    $loginPassword = Invoke-Aws -Arguments @("ecr", "get-login-password")
    $loginPassword | & docker login --username AWS --password-stdin $registry
    if ($LASTEXITCODE -ne 0) {
        throw "Docker login to ECR failed."
    }

    Write-Step "Building backend image $imageUri"
    Invoke-Docker -Arguments @("build", "-t", $imageUri, ".") -WorkingDirectory $backendDir | Out-Null

    Write-Step "Pushing backend image to ECR"
    Invoke-Docker -Arguments @("push", $imageUri) | Out-Null

    $existingServiceSummary = Get-AppRunnerServiceSummary -ServiceName $appRunnerServiceName
    $existingService = $null
    if ($existingServiceSummary) {
        $existingService = Get-AppRunnerService -ServiceArn $existingServiceSummary.ServiceArn
    }

    $accessRoleArn = Get-ConfigValue -Name "APP_RUNNER_ACCESS_ROLE_ARN"
    if ([string]::IsNullOrWhiteSpace($accessRoleArn) -and $existingService) {
        $accessRoleArn = $existingService.SourceConfiguration.AuthenticationConfiguration.AccessRoleArn
    }
    if ([string]::IsNullOrWhiteSpace($accessRoleArn)) {
        throw "APP_RUNNER_ACCESS_ROLE_ARN is required for the first backend deployment."
    }

    $sourceConfiguration = @{
        AutoDeploymentsEnabled = $false
        AuthenticationConfiguration = @{
            AccessRoleArn = $accessRoleArn
        }
        ImageRepository = @{
            ImageIdentifier = $imageUri
            ImageRepositoryType = "ECR"
            ImageConfiguration = @{
                Port = $backendPort
                RuntimeEnvironmentVariables = $backendEnv
            }
        }
    }

    $instanceConfiguration = @{
        Cpu = $appRunnerCpu
        Memory = $appRunnerMemory
    }

    $healthCheckConfiguration = @{
        Protocol = "HTTP"
        Path = "/health"
        Interval = 10
        Timeout = 5
        HealthyThreshold = 1
        UnhealthyThreshold = 5
    }

    $servicePayloadPath = Join-Path $tempDir "apprunner-service.json"
    $payload = @{
        SourceConfiguration = $sourceConfiguration
        InstanceConfiguration = $instanceConfiguration
        HealthCheckConfiguration = $healthCheckConfiguration
    }

    if (-not [string]::IsNullOrWhiteSpace($appRunnerVpcConnectorArn)) {
        $payload["NetworkConfiguration"] = @{
            EgressConfiguration = @{
                EgressType = "VPC"
                VpcConnectorArn = $appRunnerVpcConnectorArn
            }
        }
    }

    if ($existingService) {
        Write-Step "Updating App Runner service $appRunnerServiceName"
        $payload["ServiceArn"] = $existingService.ServiceArn
        Write-JsonFile -Value $payload -Path $servicePayloadPath
        Invoke-Aws -Arguments @("apprunner", "update-service", "--cli-input-json", "file://$servicePayloadPath", "--output", "json") -ParseJson | Out-Null
        $service = Wait-AppRunnerService -ServiceArn $existingService.ServiceArn
    }
    else {
        Write-Step "Creating App Runner service $appRunnerServiceName"
        $payload["ServiceName"] = $appRunnerServiceName
        Write-JsonFile -Value $payload -Path $servicePayloadPath
        $createResponse = Invoke-Aws -Arguments @("apprunner", "create-service", "--cli-input-json", "file://$servicePayloadPath", "--output", "json") -ParseJson
        $service = Wait-AppRunnerService -ServiceArn $createResponse.Service.ServiceArn
    }

    $backendUrl = $service.ServiceUrl
    if (-not $backendUrl.StartsWith("http", [System.StringComparison]::OrdinalIgnoreCase)) {
        $backendUrl = "https://$backendUrl"
    }
}

if (-not $SkipFrontend) {
    $frontendBucket = Get-ConfigValue -Name "FRONTEND_BUCKET" -Required
    $cloudFrontDistributionId = Get-ConfigValue -Name "CLOUDFRONT_DISTRIBUTION_ID"
    $frontendApiUrl = Get-ConfigValue -Name "FRONTEND_API_URL"
    if ([string]::IsNullOrWhiteSpace($frontendApiUrl)) {
        $frontendApiUrl = $backendUrl
    }
    if ([string]::IsNullOrWhiteSpace($frontendApiUrl)) {
        throw "Set FRONTEND_API_URL or deploy the backend in the same run."
    }

    Write-Step "Ensuring S3 bucket $frontendBucket exists"
    Ensure-S3Bucket -BucketName $frontendBucket

    Write-Step "Configuring static website hosting for $frontendBucket"
    $websiteConfigPath = Join-Path $tempDir "s3-website.json"
    Write-JsonFile -Value @{
        IndexDocument = @{ Suffix = "index.html" }
        ErrorDocument = @{ Key = "index.html" }
    } -Path $websiteConfigPath

    Invoke-Aws -Arguments @(
        "s3api",
        "put-public-access-block",
        "--bucket",
        $frontendBucket,
        "--public-access-block-configuration",
        "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
    ) | Out-Null
    Invoke-Aws -Arguments @("s3api", "put-bucket-website", "--bucket", $frontendBucket, "--website-configuration", "file://$websiteConfigPath") | Out-Null

    $policyPath = Join-Path $tempDir "s3-policy.json"
    Write-JsonFile -Value @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Sid = "PublicReadForStaticSite"
                Effect = "Allow"
                Principal = "*"
                Action = @("s3:GetObject")
                Resource = "arn:aws:s3:::$frontendBucket/*"
            }
        )
    } -Path $policyPath
    Invoke-Aws -Arguments @("s3api", "put-bucket-policy", "--bucket", $frontendBucket, "--policy", "file://$policyPath") | Out-Null

    Write-Step "Installing frontend dependencies"
    Invoke-Npm -Arguments @("ci") -WorkingDirectory $frontendDir | Out-Null

    Write-Step "Building frontend with VITE_API_URL=$frontendApiUrl"
    $previousApiUrl = $env:VITE_API_URL
    $env:VITE_API_URL = $frontendApiUrl
    try {
        Invoke-Npm -Arguments @("run", "build") -WorkingDirectory $frontendDir | Out-Null
    }
    finally {
        $env:VITE_API_URL = $previousApiUrl
    }

    $distDir = Join-Path $frontendDir "dist"
    Write-Step "Uploading frontend assets to S3"
    Invoke-Aws -Arguments @("s3", "sync", $distDir, "s3://$frontendBucket", "--delete") | Out-Null
    Invoke-Aws -Arguments @(
        "s3",
        "cp",
        (Join-Path $distDir "index.html"),
        "s3://$frontendBucket/index.html",
        "--cache-control",
        "no-cache,no-store,must-revalidate",
        "--content-type",
        "text/html"
    ) | Out-Null

    if (-not [string]::IsNullOrWhiteSpace($cloudFrontDistributionId)) {
        Write-Step "Invalidating CloudFront distribution $cloudFrontDistributionId"
        Invoke-Aws -Arguments @(
            "cloudfront",
            "create-invalidation",
            "--distribution-id",
            $cloudFrontDistributionId,
            "--paths",
            "/*"
        ) -ParseJson | Out-Null
    }
}

Write-Host ""
Write-Host "Deployment finished."
if ($DeployDatabase) {
    Write-Host "Database:  $databaseName at $databaseEndpoint"
}
if (-not [string]::IsNullOrWhiteSpace($backendUrl)) {
    Write-Host "Backend:   $backendUrl"
}
if (-not $SkipFrontend) {
    $frontendUrl = "http://${frontendBucket}.s3-website-$($script:awsRegion).amazonaws.com"
    Write-Host "Frontend:  $frontendUrl"
}
