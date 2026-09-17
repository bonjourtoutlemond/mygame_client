param(
    [int]$Port = 8088,
    [string]$HostName = "127.0.0.1",
    [string]$GameHost = "127.0.0.1",
    [int]$Game1Port = 5001,
    [int]$Game2Port = 5002,
    [switch]$Hidden
)

$ErrorActionPreference = "Stop"
$clientRoot = [string](Resolve-Path (Join-Path $PSScriptRoot ".."))
$gateway = Join-Path $clientRoot "gateway\web_gateway.js"
$webRoot = Join-Path $clientRoot "web"

$nodePath = $env:NODE_EXE
if (-not $nodePath) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $nodePath = $node.Source
    }
}
if (-not $nodePath) {
    $bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (Test-Path $bundledNode) {
        $nodePath = $bundledNode
    }
}
if (-not $nodePath) {
    throw "Node.js was not found. Set NODE_EXE to node.exe or install Node.js."
}

$arguments = @(
    $gateway,
    "--host", $HostName,
    "--port", "$Port",
    "--game-host", $GameHost,
    "--game1-port", "$Game1Port",
    "--game2-port", "$Game2Port",
    "--web-root", $webRoot
)

$windowStyle = if ($Hidden) { "Hidden" } else { "Normal" }
$process = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $clientRoot -WindowStyle $windowStyle -PassThru
Write-Host "web client gateway pid=$($process.Id)"
Write-Host "open http://$HostName`:$Port"
