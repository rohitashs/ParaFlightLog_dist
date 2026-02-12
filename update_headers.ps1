$files = Get-ChildItem "Code" -Include *.gs, *.html -Recurse
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

foreach ($file in $files) {
    if ($file.Extension -eq ".html") {
         $header = "<!--" + "`r`n" + " * Paragliding Flight Log v2.0" + "`r`n" + " * Updated: $dateStr" + "`r`n" + " -->"
    } else {
         $header = "/**" + "`r`n" + " * Paragliding Flight Log v2.0" + "`r`n" + " * Updated: $dateStr" + "`r`n" + " */"
    }
    
    $content = Get-Content $file.FullName -Raw
    
    # Check if header exists (Simple check for " * Updated: ")
    if ($content -match "\* Updated: \d{4}-\d{2}-\d{2}") {
        # Update existing
        $content = $content -replace "\* Updated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", "* Updated: $dateStr"
        # Also catch short dates if any
        $content = $content -replace "\* Updated: \d{4}-\d{2}-\d{2}(\r\n|\n)", "* Updated: $dateStr`r`n"
    } else {
        # Prepend new header
        $content = $header + "`r`n" + $content
    }
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
    Write-Host "Updated $($file.Name)"
}
Write-Host "All timestamps updated to $dateStr"
