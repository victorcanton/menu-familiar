# 🚀 QUICK START - PWA Setup

## Para desplegar, solo falta 1 paso:

### Convertir iconos SVG → PNG

**Linux/Mac:**
```bash
./convert-icons.sh
```

**Windows:**
```powershell
.\convert-icons.ps1
```

**Sin scripts? Usa online:** https://cloudconvert.com/svg-to-png
- Convertir `icons/icon-192.svg` → `icon-192.png`
- Convertir `icons/icon-512.svg` → `icon-512.png`

---

## Verificar que está todo listo:

```bash
# Listar archivos
ls -la icons/
# Debe mostrar: icon-192.png, icon-512.png

# Si hay error, usa ImageMagick:
convert icons/icon-192.svg icons/icon-192.png
convert icons/icon-512.svg icons/icon-512.png
```

---

## Desplegar:

```bash
git add .
git commit -m "feat: Add PWA support"
git push
```

---

## Testear en Android:

1. Abrir en Chrome: `https://tu-dominio.pages.dev`
2. Debe mostrar botón "Instalar"
3. Al instalar → abre sin barra de navegador ✅

---

## Más info:

Ver `PWA_SETUP.md` para guía completa
Ver `CHANGES_PWA.md` para lista de cambios
