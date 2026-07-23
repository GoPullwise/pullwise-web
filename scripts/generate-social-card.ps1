param(
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\public\social-card.png")
)

Add-Type -AssemblyName System.Drawing

$bitmap = New-Object System.Drawing.Bitmap 1200, 630
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$background = [System.Drawing.ColorTranslator]::FromHtml("#0b0d12")
$surface = [System.Drawing.ColorTranslator]::FromHtml("#11141b")
$line = [System.Drawing.ColorTranslator]::FromHtml("#303644")
$lineStrong = [System.Drawing.ColorTranslator]::FromHtml("#454c5c")
$text = [System.Drawing.ColorTranslator]::FromHtml("#f7f8fb")
$textMuted = [System.Drawing.ColorTranslator]::FromHtml("#aeb5c4")
$textQuiet = [System.Drawing.ColorTranslator]::FromHtml("#8a93a6")
$accent = [System.Drawing.ColorTranslator]::FromHtml("#6366f1")

$graphics.Clear($background)

$linePen = New-Object System.Drawing.Pen $line, 1
$lineStrongPen = New-Object System.Drawing.Pen $lineStrong, 1
$accentPen = New-Object System.Drawing.Pen $accent, 2
$textBrush = New-Object System.Drawing.SolidBrush $text
$textMutedBrush = New-Object System.Drawing.SolidBrush $textMuted
$textQuietBrush = New-Object System.Drawing.SolidBrush $textQuiet
$accentBrush = New-Object System.Drawing.SolidBrush $accent
$surfaceBrush = New-Object System.Drawing.SolidBrush $surface
$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

$graphics.DrawLine($linePen, 0, 96, 1200, 96)
$graphics.DrawLine($linePen, 0, 534, 1200, 534)
$graphics.DrawLine($linePen, 88, 0, 88, 630)
$graphics.DrawLine($linePen, 1112, 0, 1112, 630)
$graphics.DrawRectangle($lineStrongPen, 88, 96, 1024, 438)

$graphics.FillRectangle($accentBrush, 128, 132, 34, 34)
$graphics.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 2), 137, 149, 153, 149)
$graphics.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 2), 145, 141, 145, 157)

$brandFont = New-Object System.Drawing.Font "Segoe UI", 20, ([System.Drawing.FontStyle]::Bold)
$headlineFont = New-Object System.Drawing.Font "Segoe UI", 43, ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Regular)
$monoBoldFont = New-Object System.Drawing.Font "Consolas", 11, ([System.Drawing.FontStyle]::Bold)
$monoFont = New-Object System.Drawing.Font "Consolas", 10, ([System.Drawing.FontStyle]::Regular)

$graphics.DrawString("Pullwise", $brandFont, $textBrush, 180, 132)
$graphics.DrawString("Find repository-wide risks.", $headlineFont, $textBrush, 120, 214)
$graphics.DrawString("Ship fixes with evidence.", $headlineFont, $textMutedBrush, 120, 282)
$graphics.DrawString("AI code review for GitHub repositories", $subtitleFont, $textQuietBrush, 124, 365)

$graphics.FillRectangle($surfaceBrush, 128, 424, 944, 70)
$graphics.DrawRectangle($linePen, 128, 424, 944, 70)
$graphics.FillEllipse($accentBrush, 152, 453, 12, 12)
$graphics.DrawString("VALIDATED FINDING", $monoBoldFont, $textBrush, 180, 441)
$graphics.DrawString(
  "exact file location  /  evidence  /  impact  /  next step",
  $monoFont,
  $textQuietBrush,
  180,
  466
)
$graphics.DrawLine($lineStrongPen, 888, 459, 1020, 459)
$graphics.DrawLine($accentPen, 1012, 453, 1020, 459)
$graphics.DrawLine($accentPen, 1012, 465, 1020, 459)

$footerFont = New-Object System.Drawing.Font "Consolas", 9, ([System.Drawing.FontStyle]::Regular)
$graphics.DrawString(
  "PULL-WISE.COM  /  FULL-REPOSITORY REVIEW",
  $footerFont,
  $textQuietBrush,
  128,
  568
)

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
if (-not [System.IO.Directory]::Exists($outputDirectory)) {
  [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
}
$bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)

$footerFont.Dispose()
$monoFont.Dispose()
$monoBoldFont.Dispose()
$subtitleFont.Dispose()
$headlineFont.Dispose()
$brandFont.Dispose()
$whiteBrush.Dispose()
$surfaceBrush.Dispose()
$accentBrush.Dispose()
$textQuietBrush.Dispose()
$textMutedBrush.Dispose()
$textBrush.Dispose()
$accentPen.Dispose()
$lineStrongPen.Dispose()
$linePen.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $resolvedOutput
