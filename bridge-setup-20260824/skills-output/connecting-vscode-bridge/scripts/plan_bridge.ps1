param(
    [Parameter(Mandatory = $true)]
    [string]$WorkspacePath,
    [int]$BasePort = 3333,
    [int]$MaxPort = 3399
)

$resolvedPath = [System.IO.Path]::GetFullPath($WorkspacePath).TrimEnd('\', '/')
if (-not (Test-Path -LiteralPath $resolvedPath -PathType Container)) {
    throw "Workspace does not exist: $resolvedPath"
}

$normalizedPath = $resolvedPath.ToLowerInvariant().Replace('\', '/')
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($normalizedPath))
} finally {
    $sha256.Dispose()
}
$pathHash = ([System.BitConverter]::ToString($hashBytes).Replace('-', '').ToLowerInvariant()).Substring(0, 8)
$projectName = [System.IO.Path]::GetFileName($resolvedPath)
$safeName = ($projectName.ToLowerInvariant() -replace '[^a-z0-9-]+', '-') -replace '^-|-$', ''
if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = 'workspace' }

function Test-PortAvailable([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try {
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        try { $listener.Stop() } catch { }
    }
}

$selectedPort = $null
for ($port = $BasePort; $port -le $MaxPort; $port++) {
    if (Test-PortAvailable $port) {
        $selectedPort = $port
        break
    }
}
if ($null -eq $selectedPort) {
    throw "No free Bridge port in range $BasePort-$MaxPort"
}

[ordered]@{
    workspacePath = $resolvedPath
    mcpName = "vscode-$safeName-$pathHash"
    port = $selectedPort
    healthUrl = "http://127.0.0.1:$selectedPort/health"
    sseUrl = "http://127.0.0.1:$selectedPort/sse"
} | ConvertTo-Json
