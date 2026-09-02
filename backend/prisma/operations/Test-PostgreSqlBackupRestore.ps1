[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z_][a-zA-Z0-9_]*$')]
  [string] $SourceDatabase,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^ruta_emocional_restore_verify_[a-zA-Z0-9_]+$')]
  [string] $VerificationDatabase,

  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Container })]
  [string] $PostgresBinPath,

  [Parameter(Mandatory = $true)]
  [string] $DatabaseHost,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int] $DatabasePort,

  [Parameter(Mandatory = $true)]
  [string] $DatabaseUser,

  [Parameter()]
  [switch] $Passwordless,

  [Parameter()]
  [ValidatePattern('^[A-Z][A-Z0-9_]*$')]
  [string] $PasswordEnvironmentVariable
)

$ErrorActionPreference = 'Stop'
if ($SourceDatabase -eq $VerificationDatabase) {
  throw 'VerificationDatabase must be different from SourceDatabase.'
}
if ($Passwordless -and $PasswordEnvironmentVariable) {
  throw 'Passwordless and PasswordEnvironmentVariable are mutually exclusive.'
}

$executableSuffix = if ($env:OS -eq 'Windows_NT') { '.exe' } else { '' }
$requiredExecutables = @('pg_dump', 'pg_restore', 'psql', 'createdb', 'dropdb')
$executables = @{}
foreach ($executable in $requiredExecutables) {
  $candidate = Join-Path $PostgresBinPath ($executable + $executableSuffix)
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    throw "PostgreSQL executable not found: $candidate"
  }
  $executables[$executable] = $candidate
}

$secretPointer = [IntPtr]::Zero
if (-not $Passwordless -and -not $PasswordEnvironmentVariable) {
  $securePassword = Read-Host 'PostgreSQL password' -AsSecureString
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
}
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) (
  'ruta-emocional-backup-verification-' + [Guid]::NewGuid().ToString('N')
)
$temporaryDirectoryCreated = $false
$verificationDatabaseCreated = $false

try {
  if ($secretPointer -ne [IntPtr]::Zero) {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $env:PGPASSWORD = $plainPassword
  } elseif ($PasswordEnvironmentVariable) {
    $injectedPassword = [Environment]::GetEnvironmentVariable($PasswordEnvironmentVariable)
    if (-not $injectedPassword) {
      throw "Password environment variable is missing: $PasswordEnvironmentVariable"
    }
    $env:PGPASSWORD = $injectedPassword
  } else {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
  $connectionArguments = @(
    '-h', $DatabaseHost,
    '-p', $DatabasePort.ToString(),
    '-U', $DatabaseUser
  )

  $existingDatabase = & $executables['psql'] @connectionArguments '-d' 'postgres' '-tAc' "SELECT 1 FROM pg_database WHERE datname = '$VerificationDatabase'"
  if ($LASTEXITCODE -ne 0) { throw 'Could not verify the disposable database name.' }
  if ($existingDatabase) {
    throw 'The verification database already exists. Refusing to overwrite it.'
  }

  New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
  $temporaryDirectoryCreated = $true
  $backupPath = Join-Path $temporaryDirectory 'database.dump'

  & $executables['pg_dump'] @connectionArguments '--format=custom' '--no-owner' '--no-privileges' "--file=$backupPath" $SourceDatabase
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
  if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
    throw 'The backup artifact was not created.'
  }

  & $executables['createdb'] @connectionArguments '--template=template0' '--encoding=UTF8' $VerificationDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the disposable restore database.' }
  $verificationDatabaseCreated = $true

  & $executables['pg_restore'] @connectionArguments "--dbname=$VerificationDatabase" '--no-owner' '--no-privileges' '--exit-on-error' $backupPath
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }

  $verificationResult = & $executables['psql'] @connectionArguments '-d' $VerificationDatabase '-tAc' @'
SELECT CASE WHEN
  to_regclass('public.users') IS NOT NULL
  AND to_regclass('public.service_requests') IS NOT NULL
  AND to_regclass('public.care_modalities') IS NOT NULL
  AND to_regclass('public.care_relationships') IS NOT NULL
  AND to_regclass('public.conversations') IS NOT NULL
  AND to_regclass('public.messages') IS NOT NULL
  AND to_regclass('public.appointments') IS NOT NULL
  AND to_regclass('public.clinical_records') IS NOT NULL
  AND to_regclass('public.clinical_note_versions') IS NOT NULL
  AND to_regclass('public.treatment_plans') IS NOT NULL
  AND to_regclass('public.triage_assessments') IS NOT NULL
  AND to_regclass('public.triage_rules') IS NOT NULL
  AND to_regclass('public.patient_consents') IS NOT NULL
  AND to_regclass('public.triage_consent_withdrawals') IS NOT NULL
  AND to_regclass('public.triage_erasure_requests') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)
THEN 'RESTORE_OK' ELSE 'RESTORE_INVALID' END;
'@
  if ($LASTEXITCODE -ne 0 -or $verificationResult.Trim() -ne 'RESTORE_OK') {
    throw 'The restored schema failed integrity verification.'
  }

  Write-Output 'Backup and restore verification passed.'
}
finally {
  if ($verificationDatabaseCreated) {
    & $executables['dropdb'] @connectionArguments '--if-exists' $VerificationDatabase
    if ($LASTEXITCODE -ne 0) {
      Write-Error 'Could not remove the disposable restore database.'
    }
  }
  if ($temporaryDirectoryCreated) {
    $resolvedTemporaryDirectory = [IO.Path]::GetFullPath($temporaryDirectory)
    $resolvedSystemTemporaryPath = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $safePrefix = 'ruta-emocional-backup-verification-'
    if (
      $resolvedTemporaryDirectory.StartsWith($resolvedSystemTemporaryPath, [StringComparison]::OrdinalIgnoreCase) -and
      ([IO.Path]::GetFileName($resolvedTemporaryDirectory)).StartsWith($safePrefix, [StringComparison]::Ordinal)
    ) {
      Remove-Item -LiteralPath $resolvedTemporaryDirectory -Recurse -Force
    }
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $injectedPassword = $null
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  $plainPassword = $null
}
