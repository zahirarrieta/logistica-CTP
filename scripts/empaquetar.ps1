$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Raíz del proyecto: la carpeta que contiene a scripts/.
$root = Split-Path -Parent $PSScriptRoot

function New-Paquete {
    param([string]$ZipPath, [object[]]$Entradas)

    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    $fs  = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::Create)
    $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
    foreach ($e in $Entradas) {
        if (-not (Test-Path -LiteralPath $e.src)) { throw "Falta el archivo: $($e.src)" }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $e.src, $e.entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    $zip.Dispose()
    $fs.Dispose()
}

function Show-Zip {
    param([string]$ZipPath)

    $z = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    $malos = @($z.Entries | Where-Object { $_.FullName -match '\\' })
    Write-Output "== $(Split-Path $ZipPath -Leaf) : $($z.Entries.Count) entradas =="
    $z.Entries | ForEach-Object { Write-Output "   $($_.FullName)" }
    if ($malos.Count -gt 0) { Write-Output "   !! $($malos.Count) entradas con backslash" }
    $z.Dispose()
}

# ---------------------------------------------------------------------------
# server-deploy.zip : se extrae en /home/USUARIO/server y debe conservar la
# carpeta src/, porque app.js hace require('./src/index.js').
# Nunca incluir .env (secretos), node_modules, storage (evidencias de
# producción), tmp ni test.
# ---------------------------------------------------------------------------
$servidor = @()
foreach ($n in @('app.js', 'dev.js', 'package.json', 'package-lock.json')) {
    $servidor += @{ src = (Join-Path $root "server\$n"); entry = $n }
}
Get-ChildItem -LiteralPath (Join-Path $root 'server\src') -File -Filter '*.js' |
    Sort-Object Name |
    ForEach-Object { $servidor += @{ src = $_.FullName; entry = ('src/' + $_.Name) } }

New-Paquete -ZipPath (Join-Path $root 'server-deploy.zip') -Entradas $servidor

# ---------------------------------------------------------------------------
# frontend-deploy.zip : todo dist/ tal cual, con '/' como separador.
# ---------------------------------------------------------------------------
$distRoot = Join-Path $root 'dist'

# Cortafuego del aviso «NUEVA VERSIÓN DISPONIBLE»: vite.config.js cuece en el
# bundle la versión de public/version.json, y la app la compara con el
# version.json que sirve el hosting. Si dist/ se construyó ANTES del último
# cambio de versión, el bundle dice una y el servidor otra, la comparación nunca
# coincide y el modal aparece en cada carga sin forma de cerrarlo.
$versionPublica = (Get-Content -LiteralPath (Join-Path $root 'public\version.json') -Raw | ConvertFrom-Json).version
$versionDist = (Get-Content -LiteralPath (Join-Path $distRoot 'version.json') -Raw | ConvertFrom-Json).version
if ($versionPublica -ne $versionDist) {
    throw "public/version.json dice $versionPublica pero dist/version.json dice $versionDist. Corre 'npm run build' primero."
}
$enBundle = Get-ChildItem -LiteralPath (Join-Path $distRoot 'assets') -Filter '*.js' -File |
    Where-Object { Select-String -LiteralPath $_.FullName -SimpleMatch -Pattern ('"' + $versionDist + '"') -Quiet }
if (-not $enBundle) {
    throw "Ningún JS de dist/assets lleva cocida la versión ${versionDist}: el build es anterior al cambio de version.json. Corre 'npm run build' primero."
}
Write-Output "versión verificada: $versionDist (coincide en public/, dist/ y el bundle)"

$front = @()
Get-ChildItem -LiteralPath $distRoot -Recurse -File -Force |
    Sort-Object FullName |
    ForEach-Object {
        $rel = $_.FullName.Substring($distRoot.Length).TrimStart('\', '/').Replace('\', '/')
        $front += @{ src = $_.FullName; entry = $rel }
    }

New-Paquete -ZipPath (Join-Path $root 'frontend-deploy.zip') -Entradas $front

Show-Zip (Join-Path $root 'server-deploy.zip')
Show-Zip (Join-Path $root 'frontend-deploy.zip')
