param(
  [string]$WorkbookPath = "B:\Cabling\BS-C Dlugosci przewodow2.xlsm",
  [string]$OutputPath = "B:\Cabling\data\seed.json"
)

$ErrorActionPreference = 'Stop'

function New-Id([string]$prefix, [int]$index) {
  return "$prefix-$index"
}

function Normalize-Key([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return '' }
  return (($value -replace '\s+', '')).ToLowerInvariant()
}

function Split-Values([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return @() }
  return ($value -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
}

function Read-SingleColumn($table) {
  $items = @()
  for ($r = 1; $r -le $table.ListRows.Count; $r++) {
    $items += [string]$table.DataBodyRange.Cells.Item($r, 1).Text
  }
  return $items
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
  $workbook = $excel.Workbooks.Open($WorkbookPath, $false, $false)
  $sheetOutput = $workbook.Worksheets.Item(1)
  $sheetTables = $workbook.Worksheets.Item(2)

  $tableMain = $sheetTables.ListObjects.Item(1)
  $tableIndex = $sheetTables.ListObjects.Item(3)
  $tableWlk = $sheetTables.ListObjects.Item(8)
  $tableConfig = $sheetTables.ListObjects.Item(9)
  $tableHeat = $sheetTables.ListObjects.Item(10)
  $tableFan = $sheetTables.ListObjects.Item(11)
  $tableDamper = $sheetTables.ListObjects.Item(12)
  $tableBoolean = $sheetTables.ListObjects.Item(13)

  $tablePrint = $sheetOutput.ListObjects.Item(1)
  $tableData = $sheetOutput.ListObjects.Item(2)
  $tableSummary = $sheetOutput.ListObjects.Item(3)

  $issues = New-Object System.Collections.Generic.List[object]

  $variantCodes = Read-SingleColumn $tableWlk
  $dimensionRange = $sheetTables.Range('AN3:AP9')
  $variants = @()
  for ($i = 1; $i -le $variantCodes.Count; $i++) {
    $variants += [ordered]@{
      id = New-Id 'variant' $i
      code = $variantCodes[$i - 1]
      lengthMm = [int]$dimensionRange.Cells.Item($i, 1).Value2
      widthMm = [int]$dimensionRange.Cells.Item($i, 2).Value2
      heightMm = [int]$dimensionRange.Cells.Item($i, 3).Value2
      isActive = $true
    }
  }

  $optionGroups = @(
    [ordered]@{ id = 'group-wlk'; code = 'wlk'; label = 'Wlk'; type = 'single-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-konfiguracja'; code = 'konfiguracja'; label = 'Konfiguracja'; type = 'single-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-nagrzewnica'; code = 'Nagrzewnica'; label = 'Nagrzewnica'; type = 'single-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-fan-nw'; code = 'Wentylator NW'; label = 'Wentylator NW'; type = 'single-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-fan-w'; code = 'Wentylator W'; label = 'Wentylator W'; type = 'single-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-damper'; code = 'Przepustnica na Wyciagu'; label = 'Przepustnica na Wyciagu'; type = 'single-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-rec'; code = 'Recyrkulacja'; label = 'Recyrkulacja'; type = 'boolean-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-presostat-filra'; code = 'Presostat Filra'; label = 'Presostat Filra'; type = 'boolean-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-presostat-wym'; code = 'Presostat Wymiennika'; label = 'Presostat Wymiennika'; type = 'boolean-select'; isVisibleInConfigurator = $true },
    [ordered]@{ id = 'group-przetwornik'; code = 'Przetwornik cisnienia went.'; label = 'Przetwornik cisnienia went.'; type = 'boolean-select'; isVisibleInConfigurator = $true }
  )

  $dictionaries = @{
    'wlk' = $variantCodes
    'konfiguracja' = (Read-SingleColumn $tableConfig)
    'Nagrzewnica' = (Read-SingleColumn $tableHeat)
    'Wentylator NW' = (Read-SingleColumn $tableFan)
    'Wentylator W' = (Read-SingleColumn $tableFan)
    'Przepustnica na Wyciagu' = (Read-SingleColumn $tableDamper)
    'Recyrkulacja' = (Read-SingleColumn $tableBoolean)
    'Presostat Filra' = (Read-SingleColumn $tableBoolean)
    'Presostat Wymiennika' = (Read-SingleColumn $tableBoolean)
    'Przetwornik cisnienia went.' = (Read-SingleColumn $tableBoolean)
  }

  $optionValues = @()
  $optionCounter = 1
  foreach ($group in $optionGroups) {
    foreach ($value in $dictionaries[$group.code]) {
      $optionValues += [ordered]@{
        id = New-Id 'option' $optionCounter
        groupCode = $group.code
        value = $value
        label = $value
        isActive = $true
      }
      $optionCounter++
    }
  }

  $configLookup = @{}
  foreach ($value in $dictionaries['konfiguracja']) { $configLookup[(Normalize-Key $value)] = $value }
  $fanLookup = @{}
  foreach ($value in $dictionaries['Wentylator NW']) { $fanLookup[(Normalize-Key $value)] = $value }
  $heatLookup = @{}
  foreach ($value in $dictionaries['Nagrzewnica']) { $heatLookup[(Normalize-Key $value)] = $value }
  $damperLookup = @{}
  foreach ($value in $dictionaries['Przepustnica na Wyciagu']) { $damperLookup[(Normalize-Key $value)] = $value }
  $boolLookup = @{}
  foreach ($value in $dictionaries['Recyrkulacja']) { $boolLookup[(Normalize-Key $value)] = $value }

  function Normalize-OptionValue([string]$value) {
    $key = Normalize-Key $value
    foreach ($lookup in @($configLookup, $fanLookup, $heatLookup, $damperLookup, $boolLookup)) {
      if ($lookup.ContainsKey($key)) { return $lookup[$key] }
    }
    return $value
  }

  function Get-ConfigurationActivationMap($workbook, $tableData, $tablePrint, [string[]]$configurationValues) {
    $map = @{}
    $originalValue = [string]$tableData.DataBodyRange.Cells.Item(2, 2).Text

    foreach ($configurationValue in $configurationValues) {
      $tableData.DataBodyRange.Cells.Item(2, 2).Value2 = $configurationValue
      $workbook.Application.CalculateFullRebuild()

      for ($row = 1; $row -le $tablePrint.ListRows.Count; $row++) {
        $element = [string]$tablePrint.DataBodyRange.Cells.Item($row, 2).Text
        if ([string]::IsNullOrWhiteSpace($element)) { continue }
        if (-not $map.ContainsKey($element)) {
          $map[$element] = New-Object System.Collections.Generic.List[string]
        }
        if (-not $map[$element].Contains($configurationValue)) {
          $map[$element].Add($configurationValue)
        }
      }
    }

    $tableData.DataBodyRange.Cells.Item(2, 2).Value2 = $originalValue
    $workbook.Application.CalculateFullRebuild()
    return $map
  }

  function Infer-ConditionField([string[]]$values, [string]$categoryCode) {
    if ($categoryCode -eq 'standard') { return $null }
    if ($values.Count -eq 0) { return $null }

    $configMatches = ($values | Where-Object { $dictionaries['konfiguracja'] -contains $_ }).Count -eq $values.Count
    if ($configMatches) { return 'konfiguracja' }

    $heatMatches = ($values | Where-Object { $dictionaries['Nagrzewnica'] -contains $_ }).Count -eq $values.Count
    if ($heatMatches) { return 'Nagrzewnica' }

    $damperMatches = ($values | Where-Object { $dictionaries['Przepustnica na Wyciagu'] -contains $_ }).Count -eq $values.Count
    if ($damperMatches) { return 'Przepustnica na Wyciagu' }

    $boolMatches = ($values | Where-Object { $dictionaries['Recyrkulacja'] -contains $_ }).Count -eq $values.Count
    if ($boolMatches) { return $categoryCode }

    $fanMatches = ($values | Where-Object { $dictionaries['Wentylator NW'] -contains $_ }).Count -eq $values.Count
    if ($fanMatches) {
      if ($categoryCode -eq 'Wentylator NW' -or $categoryCode -eq 'Wentylator W') {
        return $categoryCode
      }
      return 'Wentylator NW'
    }

    return $categoryCode
  }

  $lengthDrivers = @(
    [ordered]@{ id = 'driver-width-half'; code = 'widthHalf'; label = 'B/2'; unit = 'mm'; expression = '(widthMm - 100) / 2'; isActive = $true; notes = 'Imported from Excel formula for B/2' },
    [ordered]@{ id = 'driver-width-service'; code = 'widthService'; label = 'B obsluga'; unit = 'mm'; expression = '100'; isActive = $true; notes = 'Imported from Excel constant for service width' },
    [ordered]@{ id = 'driver-height-petra'; code = 'heightPetra'; label = 'H petra'; unit = 'mm'; expression = '(heightMm - 100 - 50) / 4'; isActive = $true; notes = 'Imported from Excel formula for height petra' }
  )

  $rawCableTypes = @()
  for ($r = 1; $r -le $tableMain.ListRows.Count; $r++) {
    $cable = [string]$tableMain.DataBodyRange.Cells.Item($r, 11).Text
    if (-not [string]::IsNullOrWhiteSpace($cable)) {
      $rawCableTypes += $cable
    }
  }
  $rawCableTypes = $rawCableTypes | Sort-Object -Unique
  $cableTypes = @()
  $cableCounter = 1
  foreach ($cable in $rawCableTypes) {
    $cableTypes += [ordered]@{ id = New-Id 'cable' $cableCounter; code = $cable; label = $cable; isActive = $true }
    $cableCounter++
  }

  $configActivationMap = Get-ConfigurationActivationMap $workbook $tableData $tablePrint $dictionaries['konfiguracja']

  $rules = @()
  for ($r = 1; $r -le $tableMain.ListRows.Count; $r++) {
    $lp = [string]$tableMain.DataBodyRange.Cells.Item($r, 1).Text
    $element = [string]$tableMain.DataBodyRange.Cells.Item($r, 2).Text
    $categoryCode = [string]$tableMain.DataBodyRange.Cells.Item($r, 3).Text
    $rawSelection = [string]$tableMain.DataBodyRange.Cells.Item($r, 4).Text
    $indexCode = ([string]$tableMain.DataBodyRange.Cells.Item($r, 6).Text).Trim()
    $exitValue = $tableMain.DataBodyRange.Cells.Item($r, 8).Value2
    $exitFormula = [string]$tableMain.DataBodyRange.Cells.Item($r, 8).Formula
    $slackIn = $tableMain.DataBodyRange.Cells.Item($r, 9).Value2
    $slackOut = $tableMain.DataBodyRange.Cells.Item($r, 10).Value2
    $cableType = ([string]$tableMain.DataBodyRange.Cells.Item($r, 11).Text).Trim()
    if ([string]::IsNullOrWhiteSpace($cableType)) { $cableType = $null }

    $allowedValues = @()
    foreach ($value in (Split-Values $rawSelection)) {
      $normalized = Normalize-OptionValue $value
      if ($normalized -ne $value) {
        $issues.Add([ordered]@{ severity = 'warning'; code = 'normalized-option-value'; message = "Normalized option '$value' to '$normalized' in rule '$element'"; context = [ordered]@{ element = $element; original = $value; normalized = $normalized } })
      }
      $allowedValues += $normalized
    }

    $isRuleActive = $true
    if ($categoryCode -eq 'konfiguracja') {
      if ($configActivationMap.ContainsKey($element)) {
        $allowedValues = @($configActivationMap[$element])
        $issues.Add([ordered]@{ severity = 'warning'; code = 'config-rule-overridden-by-workbook-output'; message = "Rule '$element' uses configuration values inferred from workbook output, not raw selection text"; context = [ordered]@{ element = $element; inferredValues = $allowedValues; rawValues = (Split-Values $rawSelection) } })
      } else {
        $allowedValues = @()
        $isRuleActive = $false
        $issues.Add([ordered]@{ severity = 'warning'; code = 'config-rule-disabled-by-reference-output'; message = "Rule '$element' was disabled because it never appears in workbook output for any configuration value"; context = [ordered]@{ element = $element; rawValues = (Split-Values $rawSelection) } })
      }
    }

    $conditions = @()
    $conditionField = Infer-ConditionField $allowedValues $categoryCode
    if ($categoryCode -ne 'standard' -and $allowedValues.Count -gt 0) {
      $conditions += [ordered]@{ id = "condition-$r-1"; field = $conditionField; operator = 'in'; values = $allowedValues }
    }
    if ($categoryCode -ne 'standard' -and $allowedValues.Count -eq 0 -and $isRuleActive) {
      $issues.Add([ordered]@{ severity = 'warning'; code = 'empty-condition-values'; message = "Rule '$element' has no activation values"; context = [ordered]@{ element = $element; categoryCode = $categoryCode } })
    }

    $components = @()
    $componentCounter = 1
    if (-not [string]::IsNullOrWhiteSpace($indexCode)) {
      $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = "Index $indexCode"; kind = 'index-distance'; indexCode = $indexCode }
      $componentCounter++
    }

    if (-not [string]::IsNullOrWhiteSpace($exitFormula)) {
      if ($exitFormula -match '\$AI\$3\+\$AK\$3') {
        $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = 'B/2'; kind = 'driver'; driverCode = 'widthHalf' }
        $componentCounter++
        $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = 'H petra'; kind = 'driver'; driverCode = 'heightPetra' }
        $componentCounter++
      } elseif ($exitFormula -match '\$AI\$4\+\$AK\$3') {
        $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = 'B obsluga'; kind = 'driver'; driverCode = 'widthService' }
        $componentCounter++
        $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = 'H petra'; kind = 'driver'; driverCode = 'heightPetra' }
        $componentCounter++
      } elseif ($null -ne $exitValue -and "$exitValue" -ne '' -and [double]$exitValue -gt 0) {
        $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = 'Exit to element'; kind = 'constant'; valueMm = [double]$exitValue }
        $componentCounter++
      }
    }

    if ($null -ne $slackIn -and "$slackIn" -ne '' -and [double]$slackIn -gt 0) {
      $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = 'Slack IN'; kind = 'constant'; valueMm = [double]$slackIn }
      $componentCounter++
    }
    if ($null -ne $slackOut -and "$slackOut" -ne '' -and [double]$slackOut -gt 0) {
      $components += [ordered]@{ id = "rule-$r-component-$componentCounter"; label = 'Slack OUT'; kind = 'constant'; valueMm = [double]$slackOut }
      $componentCounter++
    }

    $rules += [ordered]@{
      id = New-Id 'rule' $r
      element = $element
      categoryCode = $categoryCode
      description = "Imported from Excel row $lp"
      showInReport = $true
      conditions = $conditions
      lengthComponents = $components
      cableTypeCode = $cableType
      notes = "Excel lp $lp"
      isActive = $isRuleActive
    }
  }

  $indexMappings = @()
  $seenKeys = @{}
  for ($r = 1; $r -le $tableIndex.ListRows.Count; $r++) {
    $variantCode = [string]$tableIndex.DataBodyRange.Cells.Item($r, 1).Text
    $indexCode = [string]$tableIndex.DataBodyRange.Cells.Item($r, 2).Text
    $distance = [double]$tableIndex.DataBodyRange.Cells.Item($r, 3).Value2
    $key = "$variantCode|$indexCode"
    if ($seenKeys.ContainsKey($key)) {
      $issues.Add([ordered]@{ severity = 'error'; code = 'duplicate-index-mapping'; message = "Duplicate index mapping for $variantCode / $indexCode"; context = [ordered]@{ variantCode = $variantCode; indexCode = $indexCode } })
    }
    $seenKeys[$key] = $true
    $indexMappings += [ordered]@{ id = New-Id 'index' $r; variantCode = $variantCode; indexCode = $indexCode; distanceMm = $distance }
  }

  $allRuleIndexes = $rules | ForEach-Object { $_.lengthComponents } | Where-Object { $_.kind -eq 'index-distance' } | ForEach-Object { $_.indexCode } | Sort-Object -Unique
  foreach ($variant in $variants) {
    $variantIndexes = $indexMappings | Where-Object { $_.variantCode -eq $variant.code } | ForEach-Object { $_.indexCode }
    $missing = $allRuleIndexes | Where-Object { $variantIndexes -notcontains $_ }
    if ($missing.Count -gt 0) {
      $issues.Add([ordered]@{ severity = 'warning'; code = 'missing-variant-index-coverage'; message = "Variant $($variant.code) is missing index coverage for: $($missing -join ', ')"; context = [ordered]@{ variantCode = $variant.code; missingIndexCodes = $missing } })
    }
  }

  $savedSelections = [ordered]@{}
  for ($r = 1; $r -le $tableData.ListRows.Count; $r++) {
    $group = [string]$tableData.DataBodyRange.Cells.Item($r, 1).Text
    $value = [string]$tableData.DataBodyRange.Cells.Item($r, 2).Text
    if ([string]::IsNullOrWhiteSpace($group)) { continue }
    switch ($group) {
      'Przepustnica na Wyciągu' { $group = 'Przepustnica na Wyciagu' }
      'Przetwornik ciśnienia went.' { $group = 'Przetwornik cisnienia went.' }
    }
    $savedSelections[$group] = Normalize-OptionValue $value
  }

  $savedConfigurations = @(
    [ordered]@{
      id = 'saved-reference'
      name = 'Scenariusz referencyjny'
      selections = $savedSelections
      createdAt = (Get-Date).ToString('s')
      updatedAt = (Get-Date).ToString('s')
    }
  )

  $referenceSummary = @()
  for ($r = 1; $r -le $tableSummary.ListRows.Count; $r++) {
    $referenceSummary += [ordered]@{ cableType = [string]$tableSummary.DataBodyRange.Cells.Item($r, 1).Text; totalM = [double]$tableSummary.DataBodyRange.Cells.Item($r, 2).Value2 }
  }

  $referenceRows = @()
  for ($r = 1; $r -le $tablePrint.ListRows.Count; $r++) {
    $referenceRows += [ordered]@{
      lp = [int]$tablePrint.DataBodyRange.Cells.Item($r, 1).Value2
      element = [string]$tablePrint.DataBodyRange.Cells.Item($r, 2).Text
      wlk = [string]$tablePrint.DataBodyRange.Cells.Item($r, 3).Text
      cableType = [string]$tablePrint.DataBodyRange.Cells.Item($r, 4).Text
      sumM = [double]$tablePrint.DataBodyRange.Cells.Item($r, 5).Value2
    }
  }

  $seed = [ordered]@{
    generatedAt = (Get-Date).ToString('s')
    sourceFile = $WorkbookPath
    referenceData = [ordered]@{
      variants = $variants
      indexMappings = $indexMappings
      lengthDrivers = $lengthDrivers
      optionGroups = $optionGroups
      optionValues = $optionValues
      cableTypes = $cableTypes
    }
    rules = $rules
    savedConfigurations = $savedConfigurations
    metadata = [ordered]@{
      referenceScenario = [ordered]@{
        selections = $savedSelections
        expectedSummary = $referenceSummary
        expectedRows = $referenceRows
      }
      issues = $issues
    }
  }

  $json = $seed | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($OutputPath, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Output "Seed data exported to $OutputPath"
}
finally {
  if ($workbook) { $workbook.Close($false) | Out-Null }
  if ($excel) {
    $excel.Quit() | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  }
}
