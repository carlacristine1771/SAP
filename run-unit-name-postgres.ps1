# Executa uma unica suite PostgreSQL, escolhida em lista fechada, contra um PostgreSQL
# local e descartavel (container e rede proprios, dados em tmpfs, porta so em loopback):
#   -Suite unit-name     br.com.sap.PostgresUnitNameUniquenessTests (padrao)
#   -Suite first-access  br.com.sap.PostgresFirstAccessAuthenticationTests (inclui Playwright)
# Cada suite so roda com a sua variavel de ativacao, definida apenas aqui; teste ignorado
# e falha. Nao inicia o Docker Desktop, nao baixa imagens e nao toca em containers, redes
# ou volumes que nao tenha criado: so remove recursos com o rotulo exclusivo desta
# execucao que nao existiam no inventario feito antes da criacao.
#
# Codigos de saida: 0 = testes aprovados e limpeza confirmada; 1 = falha de preparacao
# ou de testes (inclusive testes ignorados) com limpeza confirmada; 2 = limpeza nao
# confirmada (prevalece sobre os demais). Todo o percurso fica no log da execucao.
param(
    [ValidateSet('unit-name', 'first-access')]
    [string]$Suite = 'unit-name'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

# Portas: banco descartavel e, na suite de primeiro acesso, backend (4187) e Vite (4188).
$suites = @{
    'unit-name'    = @{ Class = 'br.com.sap.PostgresUnitNameUniquenessTests'; Activation = 'SAP_UNIT_NAME_POSTGRES'; Ports = @(55486) }
    'first-access' = @{ Class = 'br.com.sap.PostgresFirstAccessAuthenticationTests'; Activation = 'SAP_AUTH_POSTGRES'; Ports = @(55486, 4187, 4188) }
}
$suiteClass = $suites[$Suite].Class
$activation = $suites[$Suite].Activation
$ports = $suites[$Suite].Ports
$image = 'postgres:16-alpine'
$port = 55486
$database = 'auth_disposable'
$user = 'auth_fictional'
$password = 'fictional_pg_auth_2026'
$backend = Join-Path $PSScriptRoot 'backend'
$frontend = Join-Path $PSScriptRoot 'frontend'
$jdk = Join-Path $env:USERPROFILE '.jdks\ms-17.0.20.1'
$node = 'C:\Program Files\nodejs'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
$container = "sap-$Suite-pg-$suffix"
$network = "sap-$Suite-private-$suffix"
$runLabel = "sap.run-id=$suffix"
$labels = @('--label', 'sap.test-runner=unit-name-postgres', '--label', $runLabel)
$logDir = Join-Path $backend 'build\unit-name-postgres'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir "run-$Suite-$suffix.log"
$xmlPath = Join-Path $backend "build\test-results\test\TEST-$suiteClass.xml"
$utf8 = New-Object System.Text.UTF8Encoding $false

# Valores que nunca podem aparecer no log ou no console.
$secrets = @($password)

function Hide-Secrets([string]$Text) {
    foreach ($secret in $secrets) {
        if ($secret) { $Text = $Text.Replace($secret, '<redacted>') }
    }
    return $Text
}

function Write-Log([string]$Message) {
    $line = '{0:yyyy-MM-ddTHH:mm:ss.fffzzz} {1}' -f (Get-Date), (Hide-Secrets $Message)
    [System.IO.File]::AppendAllText($logPath, $line + [Environment]::NewLine, $utf8)
    Write-Host $line
}

# Executa um comando nativo sem que mensagens em stderr virem erro terminante (PowerShell
# 5.1) e sem reaproveitar um codigo de saida anterior; registra comando, codigo e saida.
function Invoke-Native([string]$FilePath, [string[]]$Arguments, [switch]$Quiet) {
    Write-Log ("RUN {0} {1}" -f $FilePath, ($Arguments -join ' '))
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = -1
    $output = @()
    $code = -1
    try {
        $output = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" })
        $code = $global:LASTEXITCODE
    } catch {
        $output = @("$($_.Exception.Message)")
        $code = -1
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($null -eq $code) { $code = -1 }
    Write-Log "    exit=$code"
    if (!$Quiet) {
        foreach ($line in $output) { Write-Log "    | $line" }
    }
    return [pscustomobject]@{ ExitCode = $code; Output = $output }
}

function Get-Lines($Result) {
    return @($Result.Output | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
}

# Inventario completo (IDs e nomes); $null se qualquer listagem falhar.
function Get-Inventory {
    $containers = Invoke-Native docker @('ps', '-a', '--no-trunc', '--format', '{{.ID}}|{{.Names}}') -Quiet
    $networks = Invoke-Native docker @('network', 'ls', '--no-trunc', '--format', '{{.ID}}|{{.Name}}') -Quiet
    $volumes = Invoke-Native docker @('volume', 'ls', '--format', '{{.Name}}') -Quiet
    if ($containers.ExitCode -ne 0 -or $networks.ExitCode -ne 0 -or $volumes.ExitCode -ne 0) { return $null }
    return [pscustomobject]@{
        Containers = @(Get-Lines $containers)
        Networks = @(Get-Lines $networks)
        Volumes = @(Get-Lines $volumes)
    }
}

# IDs com o rotulo desta execucao; $null se a listagem falhar. A virgula preserva a
# lista vazia (sem ela o PowerShell a converteria em $null, confundida com falha).
function Get-OwnedIds([string]$Kind) {
    $arguments = if ($Kind -eq 'container') {
        @('ps', '-a', '-q', '--no-trunc', '--filter', "label=$runLabel")
    } else {
        @('network', 'ls', '-q', '--no-trunc', '--filter', "label=$runLabel")
    }
    $result = Invoke-Native docker $arguments
    if ($result.ExitCode -ne 0) { return $null }
    return , @(Get-Lines $result)
}

function Get-Id([string]$Entry) { return $Entry.Split('|')[0] }

$before = $null
$creationAttempted = $false
$testProcess = $null
$testsPassed = $false
$cleanupConfirmed = $false

Write-Log "Runner started: suite=$suiteClass run-id=$suffix"
Write-Log "Planned resources: container=$container network=$network label=$runLabel image=$image port=127.0.0.1:$port"
try {
    # ----- preparacao: nada e criado se alguma condicao falhar --------------------
    $branch = (git branch --show-current)
    Write-Log "Worktree=$PSScriptRoot branch=$branch"
    if ($branch -ne 'fix/seguranca-autenticacao' -or (Split-Path $PSScriptRoot -Leaf) -ne 'SAP-seguranca-autenticacao') {
        throw 'Wrong worktree/branch'
    }

    # A configuracao carregada pela suite precisa apontar exclusivamente para o banco descartavel;
    # a propria suite ainda verifica a conexao efetiva antes de qualquer DDL (DisposablePostgresGuard).
    $properties = Get-Content -LiteralPath (Join-Path $backend 'src\test\resources\application-auth-postgres.properties')
    $url = ($properties | Where-Object { $_ -like 'spring.datasource.url=*' }) -replace '^spring\.datasource\.url=', ''
    Write-Log "Test JDBC URL: $url"
    if ($url -notlike "jdbc:postgresql://127.0.0.1:${port}/${database}?*") { throw "Unexpected test JDBC URL: $url" }

    if ((Invoke-Native "$jdk\bin\java.exe" @('-version')).ExitCode -ne 0) { throw 'JDK 17 unavailable' }
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI not found' }
    if ((Invoke-Native docker @('info', '--format', '{{.ServerVersion}}')).ExitCode -ne 0) {
        throw 'Docker unavailable (this script does not start it)'
    }
    if ((Invoke-Native docker @('image', 'inspect', '--format', '{{.Id}}', $image)).ExitCode -ne 0) {
        throw "Image $image not available locally (this script does not download it)"
    }
    if ($Suite -eq 'first-access') {
        # Playwright usa Node, o Edge instalado e as dependencias ja presentes no frontend.
        foreach ($required in @("$node\node.exe", $edge, (Join-Path $frontend 'node_modules\.bin\playwright.cmd'))) {
            if (!(Test-Path -LiteralPath $required)) { throw "Required for the browser test: $required" }
        }
        Write-Log 'Browser prerequisites: node, Edge and Playwright present'
    }
    foreach ($required in $ports) {
        $occupied = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -EQ $required)
        if ($occupied.Count -ne 0) {
            Write-Log "Port check: $required in use by PID(s) $(($occupied | ForEach-Object OwningProcess | Sort-Object -Unique) -join ',')"
            throw "Port $required already in use; refusing to reuse it"
        }
        Write-Log "Port check: $required free"
    }

    $before = Get-Inventory
    if ($null -eq $before) { throw 'Could not take the inventory of existing Docker resources' }
    Write-Log "Inventory before: $($before.Containers.Count) container(s), $($before.Networks.Count) network(s), $($before.Volumes.Count) volume(s)"
    foreach ($entry in $before.Containers + $before.Networks) { Write-Log "    preexisting $entry" }
    foreach ($entry in $before.Volumes) { Write-Log "    preexisting volume $entry" }
    foreach ($kind in @('container', 'network')) {
        $preOwned = Get-OwnedIds $kind
        if ($null -eq $preOwned) { throw "Could not list ${kind}s with label $runLabel" }
        if ($preOwned.Count -ne 0) { throw "A $kind with label $runLabel already exists" }
    }

    # ----- criacao dos recursos temporarios -------------------------------------------
    $creationAttempted = $true
    $created = Invoke-Native docker (@('network', 'create') + $labels + @('--opt', 'com.docker.network.bridge.enable_ip_masquerade=false', $network))
    if ($created.ExitCode -ne 0) { throw 'Network creation failed' }
    $created = Invoke-Native docker (@('run', '--detach', '--pull', 'never') + $labels + @(
        '--name', $container, '--network', $network,
        '--publish', "127.0.0.1:${port}:5432", '--tmpfs', '/var/lib/postgresql/data:rw',
        '--env', "POSTGRES_DB=$database", '--env', "POSTGRES_USER=$user", '--env', "POSTGRES_PASSWORD=$password",
        $image))
    if ($created.ExitCode -ne 0) { throw 'PostgreSQL creation failed' }
    Write-Log "Created container IDs: $((Get-OwnedIds 'container') -join ', ')"
    Write-Log "Created network IDs: $((Get-OwnedIds 'network') -join ', ')"

    # ----- verificacao de volumes, rotulos e porta --------------------------------------
    $inspected = Invoke-Native docker @('container', 'inspect', $container) -Quiet
    if ($inspected.ExitCode -ne 0) { throw 'Container inspection failed' }
    $inspection = (($inspected.Output -join "`n") | ConvertFrom-Json)[0]
    if ($inspection.Config.Labels.'sap.run-id' -ne $suffix) { throw 'Container is not labeled with this run id' }
    $mounts = @($inspection.Mounts | Where-Object { $_ })
    Write-Log "Mounts (docker): $($mounts.Count) $(($mounts | ForEach-Object { "$($_.Type):$($_.Destination)" }) -join ', ')"
    $tmpfs = @($inspection.HostConfig.Tmpfs.PSObject.Properties | ForEach-Object Name)
    Write-Log "Tmpfs: $($tmpfs -join ', ')"
    # Nenhum volume nem bind mount: somente tmpfs, que some com o container.
    if (@($mounts | Where-Object { $_.Type -ne 'tmpfs' }).Count -ne 0 -or $tmpfs -notcontains '/var/lib/postgresql/data') {
        throw 'Unexpected volume or missing tmpfs'
    }
    $bindings = @($inspection.HostConfig.PortBindings.'5432/tcp')
    Write-Log "Port bindings: $(($bindings | ForEach-Object { "$($_.HostIp):$($_.HostPort)" }) -join ', ')"
    if ($bindings.Count -ne 1 -or $bindings[0].HostIp -ne '127.0.0.1' -or $bindings[0].HostPort -ne "$port") {
        throw 'Unexpected port binding'
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ((Invoke-Native docker @('exec', $container, 'pg_isready', '-h', '127.0.0.1', '-U', $user, '-d', $database)).ExitCode -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'PostgreSQL not ready' }
    $identity = Invoke-Native docker @('exec', $container, 'psql', '-U', $user, '-d', $database, '-tAc',
        'select current_database(), current_user, version();')
    if ($identity.ExitCode -ne 0) { throw 'PostgreSQL query failed' }

    # ----- testes -----------------------------------------------------------------------
    if (Test-Path -LiteralPath $xmlPath) { Remove-Item -LiteralPath $xmlPath }
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = "$env:SystemRoot\System32\cmd.exe"
    $start.Arguments = "/d /c gradlew.bat test --tests $suiteClass --rerun --offline --no-daemon --console=plain"
    $start.WorkingDirectory = $backend
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    # Ambiente reconstruido: nenhuma variavel de banco, Spring, proxy ou Java herdada.
    $start.EnvironmentVariables.Clear()
    foreach ($key in @('SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA')) {
        $value = [Environment]::GetEnvironmentVariable($key)
        if ($value) { $start.EnvironmentVariables[$key] = $value }
    }
    $start.EnvironmentVariables['JAVA_HOME'] = $jdk
    $path = "$jdk\bin;$env:SystemRoot\System32;$env:SystemRoot"
    if ($Suite -eq 'first-access') { $path = "$jdk\bin;$node;$env:SystemRoot\System32;$env:SystemRoot" }
    $start.EnvironmentVariables['PATH'] = $path
    # Somente a variavel de ativacao da suite escolhida.
    $start.EnvironmentVariables[$activation] = 'true'
    Write-Log "RUN gradlew.bat test --tests $suiteClass --rerun --offline --no-daemon ($activation=true)"
    $testProcess = [System.Diagnostics.Process]::Start($start)
    $stdout = $testProcess.StandardOutput.ReadToEndAsync()
    $stderr = $testProcess.StandardError.ReadToEndAsync()
    if (!$testProcess.WaitForExit(600000)) { throw 'Test timeout' }
    $gradleExit = $testProcess.ExitCode
    Write-Log "    exit=$gradleExit (Gradle output follows)"
    [System.IO.File]::AppendAllText($logPath, (Hide-Secrets ($stdout.Result + [Environment]::NewLine + $stderr.Result)) + [Environment]::NewLine, $utf8)

    if (!(Test-Path -LiteralPath $xmlPath)) { throw "No JUnit report for $suiteClass (Gradle exit $gradleExit)" }
    [xml]$report = Get-Content -LiteralPath $xmlPath -Raw -Encoding UTF8
    $testsuite = $report.testsuite
    $total = [int]$testsuite.tests
    $skipped = [int]$testsuite.skipped
    $failures = [int]$testsuite.failures
    $errors = [int]$testsuite.errors
    $passed = $total - $skipped - $failures - $errors
    Write-Log "Test result: suite=$suiteClass total=$total passed=$passed failed=$failures errors=$errors skipped=$skipped gradle-exit=$gradleExit"
    Write-Log "Report: $xmlPath"
    if ($total -eq 0) { throw 'No tests executed' }
    if ($skipped -ne 0) { throw "$skipped test(s) skipped" }
    if ($failures -ne 0 -or $errors -ne 0 -or $gradleExit -ne 0) { throw 'Test failures' }
    $testsPassed = $true
} catch {
    Write-Log "FAILED: $($_.Exception.Message)"
} finally {
    # ----- limpeza: so recursos desta execucao, confirmada por evidencia positiva --------
    $problems = New-Object System.Collections.Generic.List[string]
    try {
        if ($testProcess -and !$testProcess.HasExited) {
            Invoke-Native taskkill @('/PID', "$($testProcess.Id)", '/T', '/F') | Out-Null
        }
        if (!$creationAttempted) {
            Write-Log 'Cleanup: no resource creation was attempted; nothing to remove'
        } else {
            $preexisting = @($before.Containers + $before.Networks | ForEach-Object { Get-Id $_ })
            foreach ($kind in @('container', 'network')) {
                $owned = Get-OwnedIds $kind
                if ($null -eq $owned) {
                    $problems.Add("could not list $kind resources with label $runLabel")
                    continue
                }
                foreach ($id in $owned) {
                    if ($preexisting -contains $id) {
                        $problems.Add("refusing to remove preexisting $kind $id")
                        continue
                    }
                    $removal = if ($kind -eq 'container') {
                        Invoke-Native docker @('rm', '--force', '--volumes', $id)
                    } else {
                        Invoke-Native docker @('network', 'rm', $id)
                    }
                    if ($removal.ExitCode -ne 0) { $problems.Add("removal of $kind $id failed (exit $($removal.ExitCode))") }
                }
            }

            # Evidencia positiva: listagens bem-sucedidas sem nenhum recurso desta execucao.
            foreach ($kind in @('container', 'network')) {
                $left = Get-OwnedIds $kind
                if ($null -eq $left) { $problems.Add("could not confirm removal of ${kind}s") }
                elseif ($left.Count -ne 0) { $problems.Add("$kind(s) still present: $($left -join ', ')") }
            }
            $after = Get-Inventory
            if ($null -eq $after) {
                $problems.Add('could not take the inventory after cleanup')
            } else {
                $names = @($after.Containers + $after.Networks | ForEach-Object { $_.Split('|')[1] })
                if ($names -contains $container -or $names -contains $network) { $problems.Add('created names still present') }
                $ids = @($after.Containers + $after.Networks | ForEach-Object { Get-Id $_ })
                foreach ($entry in $before.Containers + $before.Networks) {
                    if ($ids -notcontains (Get-Id $entry)) { $problems.Add("preexisting resource missing: $entry") }
                }
                foreach ($volume in $before.Volumes) {
                    if ($after.Volumes -notcontains $volume) { $problems.Add("preexisting volume missing: $volume") }
                }
                foreach ($volume in $after.Volumes) {
                    if ($before.Volumes -notcontains $volume) { $problems.Add("volume not present before the run: $volume") }
                }
                Write-Log "Inventory after: $($after.Containers.Count) container(s), $($after.Networks.Count) network(s), $($after.Volumes.Count) volume(s)"
            }
            foreach ($released in $ports) {
                $listening = $true
                for ($attempt = 0; $attempt -lt 10 -and $listening; $attempt++) {
                    $listening = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -EQ $released).Count -ne 0
                    if ($listening) { Start-Sleep -Seconds 1 }
                }
                if ($listening) { $problems.Add("port $released still listening") } else { Write-Log "Port check after cleanup: $released free" }
            }
        }
        foreach ($problem in $problems) { Write-Log "Cleanup problem: $problem" }
        $cleanupConfirmed = $problems.Count -eq 0
    } catch {
        Write-Log "Cleanup problem: $($_.Exception.Message)"
        $cleanupConfirmed = $false
    }
    Write-Log "Cleanup confirmed: $(if ($cleanupConfirmed) { 'yes' } else { 'NO' }) (container=$container network=$network)"
}

$exitCode = if (!$cleanupConfirmed) { 2 } elseif ($testsPassed) { 0 } else { 1 }
Write-Log "Log: $logPath"
Write-Log "Runner exit code: $exitCode"
exit $exitCode
