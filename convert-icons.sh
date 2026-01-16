#!/bin/bash

# Script para convertir iconos SVG a PNG para PWA
# Requisitos: ImageMagick (convert) o Inkscape

# Opción 1: Usando ImageMagick/convert
echo "Convertiendo SVG a PNG con ImageMagick..."

# Icon 192x192
convert -background white -density 192 -resize 192x192 \
  icons/icon-192.svg icons/icon-192.png

# Icon 512x512
convert -background white -density 512 -resize 512x512 \
  icons/icon-512.svg icons/icon-512.png

echo "✓ Iconos generados:"
echo "  - icons/icon-192.png (192x192)"
echo "  - icons/icon-512.png (512x512)"
echo ""
echo "Los archivos PNG están listos para Cloudflare Pages"
