$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot
if ((git branch --show-current) -ne 'fix/auth-primeiro-acesso' -or
    (Split-Path $PSScriptRoot -Leaf) -ne 'SAP-auth-primeiro-acesso') { throw 'Wrong worktree/branch' }
$jdk = Join-Path $env:USERPROFILE '.jdks\ms-17.0.20.1'
& "$jdk\bin\java.exe" -version
if ($LASTEXITCODE -ne 0) { throw 'JDK 17 unavailable' }
& "$jdk\bin\javac.exe" -version
if ($LASTEXITCODE -ne 0) { throw 'JDK compiler unavailable' }
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker unavailable' }
$occupied = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -In 4187,4188,55486
if ($occupied) { throw 'Dedicated test ports already occupied; refusing reuse' }
$suffix = [guid]::NewGuid().ToString('N').Substring(0,12)
$container = "sap-auth-pg-$suffix"
$network = "sap-auth-private-$suffix"
$testProcess = $null
$exitCode = 1
try {
    docker network create --opt com.docker.network.bridge.enable_ip_masquerade=false $network
    if ($LASTEXITCODE -ne 0) { throw 'Network creation failed' }
    docker run --detach --pull never --name $container --network $network --publish 127.0.0.1:55486:5432 --tmpfs /var/lib/postgresql/data:rw --env POSTGRES_DB=auth_disposable --env POSTGRES_USER=auth_fictional --env POSTGRES_PASSWORD=fictional_pg_auth_2026 postgres:16-alpine
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL creation failed' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        docker exec $container pg_isready -U auth_fictional -d auth_disposable
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'PostgreSQL not ready' }
    $tcp = New-Object System.Net.Sockets.TcpClient
    try { $tcp.Connect('127.0.0.1', 55486) } finally { $tcp.Dispose() }
    # No bind mounts or persistent/anonymous volumes are permitted.
    $inspection = (docker inspect $container | ConvertFrom-Json)[0]
    if (@($inspection.Mounts | Where-Object Type -ne 'tmpfs').Count -ne 0) { throw 'Unexpected volume' }
    docker exec $container psql -U auth_fictional -d auth_disposable -tAc 'select current_database(), current_user, version();'
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = "$env:SystemRoot\System32\cmd.exe"
    $start.Arguments = '/d /c gradlew.bat test --tests br.com.sap.PostgresFirstAccessAuthenticationTests --offline --no-daemon --console=plain --rerun-tasks'
    $start.WorkingDirectory = Join-Path $PSScriptRoot 'backend'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    foreach ($key in @('SystemRoot','WINDIR','ComSpec','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA')) {
        $value = [Environment]::GetEnvironmentVariable($key)
        if ($value) { $start.EnvironmentVariables[$key] = $value }
    }
    $start.EnvironmentVariables['JAVA_HOME'] = $jdk
    $start.EnvironmentVariables['PATH'] = "$jdk\bin;C:\Program Files\nodejs;$env:SystemRoot\System32;$env:SystemRoot"
    $testProcess = [System.Diagnostics.Process]::Start($start)
    $stdout = $testProcess.StandardOutput.ReadToEndAsync()
    $stderr = $testProcess.StandardError.ReadToEndAsync()
    if (!$testProcess.WaitForExit(300000)) { throw 'Test timeout' }
    $exitCode = $testProcess.ExitCode
    $logPath = Join-Path $PSScriptRoot "auth-postgres-$suffix.log"
    [System.IO.File]::WriteAllText($logPath, ($stdout.Result + [Environment]::NewLine + $stderr.Result))
    Write-Output "Log: $logPath"
    Get-Content -LiteralPath $logPath -Tail 100
} finally {
    if ($testProcess -and !$testProcess.HasExited) { taskkill /PID $testProcess.Id /T /F }
    docker rm --force --volumes $container
    docker network rm $network
    Write-Output "Disposable services removed: $container, $network"
}
exit $exitCode
