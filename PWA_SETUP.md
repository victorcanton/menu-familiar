# PWA Setup - Menú Familiar

Esta aplicación está configurada como Progressive Web App (PWA) y se puede instalar en Android como app nativa, así como en tablets en modo pantalla completa.

## ✅ Estado actual

- ✅ `manifest.json` - Configurado para instalación en Android
- ✅ `sw.js` - Service Worker activo para soporte offline y cacheo
- ✅ Meta tags - Configurados en el HTML (`<head>`)
- ✅ CSS - Optimizado para pantalla completa (`100dvh`)
- ✅ Viewport - Configurado para tablets y móviles
- ⚠️ Iconos - Placeholders SVG (requieren conversión a PNG)

## 📦 Archivos PWA creados

```
/manifest.json                          # Configuración de la app
/sw.js                                  # Service Worker
/icons/icon-192.svg    → icon-192.png   # Icono 192×192 (PENDIENTE CONVERSIÓN)
/icons/icon-512.svg    → icon-512.png   # Icono 512×512 (PENDIENTE CONVERSIÓN)
/PWA_SETUP.md                           # Este archivo
/convert-icons.sh                       # Script para Linux/Mac
/convert-icons.ps1                      # Script para Windows
```

## 🎨 Iconos - IMPORTANTE

Los SVG actuales son placeholders. Debes convertirlos a PNG antes de deployar:

### Opción 1: Usar los scripts incluidos

**En Linux/Mac:**
```bash
chmod +x convert-icons.sh
./convert-icons.sh
```

**En Windows (PowerShell):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\convert-icons.ps1
```

### Opción 2: Conversión manual con ImageMagick

```bash
# Instalar ImageMagick:
# - Ubuntu/Debian: sudo apt-get install imagemagick
# - Mac: brew install imagemagick
# - Windows: https://imagemagick.org/script/download.php#windows

# Convertir
convert -background white -density 192 -resize 192x192 icons/icon-192.svg icons/icon-192.png
convert -background white -density 512 -resize 512x512 icons/icon-512.svg icons/icon-512.png
```

### Opción 3: Herramientas online

1. [CloudConvert](https://cloudconvert.com/svg-to-png)
2. [Online-convert.com](https://image.online-convert.com/convert-to-png)
3. [Convertio](https://convertio.co/svg-png/)

Subir `icon-192.svg` y `icon-512.svg`, descargar los PNG y reemplazar.

### Opción 4: Diseño personalizado

Si quieres un icono personalizado:
1. Crear en Figma, Adobe Illustrator o Photoshop
2. Exportar como PNG: 192×192 y 512×512
3. Reemplazar los archivos en `/icons/`

## 🚀 Testing en Android

### Con Chrome:

1. **Acceder a la web:**
   - Ir a `https://tu-dominio.pages.dev`
   
2. **Buscar "Instalar app":**
   - Si ves el botón "Instalar" → PWA detectada ✅
   - Si no aparece → Verificar manifest.json
   
3. **Al instalar:**
   - Se descarga en Home screen
   - Se abre sin barra de navegador (standalone)
   - Funciona offline (si está en caché)

### Con Firefox:

1. Ir a la web
2. Menú (⋮) → "Instalar aplicación"
3. Aparecerá en la pantalla de inicio

### Troubleshooting:

**"No aparece el botón de instalar":**
- Abrir DevTools (F12)
- Ir a Application → Manifest
- Verificar que está cargando correctamente
- Comprobar console por errores

**"La app no funciona offline":**
- DevTools → Application → Service Workers
- Verificar que `sw.js` está registered
- Comprobar Cache Storage

**"Los iconos no aparecen":**
- Asegurar que los PNG están en `/icons/`
- Verificar rutas en `manifest.json`
- Hard refresh (Ctrl+Shift+R)

## 🌐 Despliegue en Cloudflare Pages

### Archivos que sirve automáticamente:

```
✅ /manifest.json → Servido en raíz
✅ /sw.js → Servido en raíz
✅ /icons/*.png → Servidos en /icons/
✅ /index.html → Servido como raíz
```

### NO requiere configuración especial

Cloudflare Pages sirve automáticamente:
- Archivos estáticos (JSON, JS, PNG)
- Con headers CORS correctos
- Con Content-Type apropiados

### (Opcional) Validar headers:

```bash
curl -I https://tu-dominio.pages.dev/manifest.json
# Debe mostrar: Content-Type: application/json
```

## 📋 Checklist antes de producción

- [ ] Convertir SVG a PNG (192×192 y 512×512)
- [ ] Verificar que los PNG están en `/icons/`
- [ ] Testear en Chrome Android - debe permitir instalar
- [ ] Testear en tablet - debe ocupar pantalla completa
- [ ] Verificar offline - debe cargar la página en caché
- [ ] Comprobar DevTools → Application → Manifest
- [ ] Comprobar DevTools → Application → Service Workers
- [ ] Push a producción en Cloudflare Pages

## 🔧 Meta tags añadidos

```html
<!-- Manifest para Android -->
<link rel="manifest" href="/manifest.json" />

<!-- Favicon y Apple touch icon -->
<link rel="icon" type="image/svg+xml" href="/icons/icon-192.svg" />
<link rel="apple-touch-icon" href="/icons/icon-192.svg" />

<!-- Ya existía en viewport -->
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content" />
<meta name="theme-color" content="#ffffff" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

## 📱 Configuración responsive

CSS actualizado para tablets:

```css
html { height: 100%; }
body {
  min-height: 100vh;      /* Fallback para navegadores antiguos */
  min-height: 100dvh;     /* Dynamic Viewport Height (soporta notch) */
}
```

Esto asegura que la app ocupe toda la pantalla, incluso con notch en tablets.

## 📚 Recursos útiles

- [MDN - Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [MDN - Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Google Developers - PWA](https://developers.google.com/web/progressive-web-apps)
- [PWA Builder](https://www.pwabuilder.com/)

## ❓ Preguntas frecuentes

**P: ¿Necesito certificado SSL?**
A: Sí, PWA requiere HTTPS. Cloudflare Pages lo proporciona automáticamente.

**P: ¿Funciona sin internet?**
A: Sí, el Service Worker cachea el HTML y recursos. API calls fallarán si no hay conexión.

**P: ¿Puedo actualizar la app automáticamente?**
A: Sí, el Service Worker chequea actualizaciones. Usa `sw.js` versioning.

**P: ¿Es seguro desplegar?**
A: Sí, cuando los PNG estén generados, todo está listo para producción.

