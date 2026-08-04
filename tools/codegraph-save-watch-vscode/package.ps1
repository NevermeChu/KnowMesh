$ErrorActionPreference = 'Stop'

$extensionRoot = $PSScriptRoot
$stagingPath = Join-Path $extensionRoot '.vsix-staging'
$archivePath = Join-Path $extensionRoot 'codegraph-save-watch-0.1.1.zip'
$outputPath = Join-Path $extensionRoot 'codegraph-save-watch-0.1.1.vsix'

if (Test-Path -LiteralPath $stagingPath) {
  Remove-Item -LiteralPath $stagingPath -Recurse -Force
}

New-Item -ItemType Directory -Path (Join-Path $stagingPath 'extension') | Out-Null
Copy-Item -LiteralPath (Join-Path $extensionRoot 'package.json') -Destination (Join-Path $stagingPath 'extension/package.json')
Copy-Item -LiteralPath (Join-Path $extensionRoot 'extension.cjs') -Destination (Join-Path $stagingPath 'extension/extension.cjs')
Copy-Item -LiteralPath (Join-Path $extensionRoot 'core.cjs') -Destination (Join-Path $stagingPath 'extension/core.cjs')
Copy-Item -LiteralPath (Join-Path $extensionRoot 'README.md') -Destination (Join-Path $stagingPath 'extension/README.md')
Copy-Item -LiteralPath (Join-Path $extensionRoot 'extension.vsixmanifest') -Destination (Join-Path $stagingPath 'extension.vsixmanifest')
Copy-Item -LiteralPath (Join-Path $extensionRoot '[Content_Types].xml') -Destination (Join-Path $stagingPath '[Content_Types].xml')

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
if (Test-Path -LiteralPath $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

Compress-Archive -Path (Join-Path $stagingPath '*') -DestinationPath $archivePath
Move-Item -LiteralPath $archivePath -Destination $outputPath
Remove-Item -LiteralPath $stagingPath -Recurse -Force

Write-Output "Created $outputPath"
