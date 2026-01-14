# Script para convertir iconos SVG a PNG en Windows
# Requisitos: ImageMagick instalado (https://imagemagick.org/script/download.php#windows)

Write-Host "Convertiendo SVG a PNG con ImageMagick..." -ForegroundColor Green
Write-Host ""

# Verificar si ImageMagick está instalado
$magick = Get-Command convert -ErrorAction SilentlyContinue
if (-not $magick) {
    Write-Host "ERROR: ImageMagick no está instalado o no está en el PATH" -ForegroundColor Red
    Write-Host "Descárgalo desde: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    exit 1
}

# Icon 192x192
Write-Host "Generando icon-192.png..." -ForegroundColor Cyan
convert -background white -density 192 -resize 192x192 `
  icons/icon-192.svg icons/icon-192.png

# Icon 512x512
Write-Host "Generando icon-512.png..." -ForegroundColor Cyan
convert -background white -density 512 -resize 512x512 `
  icons/icon-512.svg icons/icon-512.png

Write-Host ""
Write-Host "✓ Iconos generados correctamente:" -ForegroundColor Green
Write-Host "  - icons/icon-192.png (192x192)" -ForegroundColor Green
Write-Host "  - icons/icon-512.png (512x512)" -ForegroundColor Green
Write-Host ""
Write-Host "Los archivos PNG están listos para Cloudflare Pages" -ForegroundColor Green
