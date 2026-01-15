## Solución para el problema de Login en Cloudflare Pages

### Problema
Después de mover los archivos a la carpeta `public/` y configurar Cloudflare Pages, el login dejó de funcionar porque los endpoints API no eran accesibles.

### Causa raíz
En Cloudflare Pages, la estructura debe ser:
- `public/` - archivos estáticos (HTML, CSS, JS, etc.)
- `functions/` - funciones serverless (DEBE estar en la raíz del proyecto, no dentro de public/)

Los archivos estaban en `public/functions/`, por lo que Cloudflare no los reconocía como funciones serverless.

### Solución aplicada

1. **Creado `wrangler.toml` en la raíz** del proyecto con la configuración correcta para Cloudflare Pages
   
2. **Copiada la carpeta `functions/`** de `public/functions/` a la raíz del proyecto:
   - `functions/api/` - endpoints API (login, me, menu, recipes, family)
   - `functions/_lib/` - librerías compartidas (auth, crypto, jwt)

3. **Creado `public/_worker.js`** para manejar el enrutamiento SPA:
   - Rutas `/api/*` → manejadas por functions/
   - Rutas sin extensión → sirve index.html para SPA routing
   - Archivos estáticos → servidos desde public/

### Estructura final
```
menu-familiar/
├── public/                    # Archivos estáticos
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── icons/
│   ├── _worker.js            # Nuevo: manejo de rutas SPA
│   └── functions/            # (Copia antigua, puede eliminarse)
├── functions/                # Nuevo: funciones serverless en la raíz
│   ├── api/
│   │   ├── login.js
│   │   ├── me.js
│   │   ├── menu.js
│   │   ├── recipes.js
│   │   └── family.js
│   └── _lib/
│       ├── auth.js
│       ├── crypto.js
│       └── jwt.js
├── wrangler.toml             # Nuevo: configuración Cloudflare
└── [otros archivos]
```

### Próximos pasos

1. **Eliminar `public/functions/`** ya que ahora está duplicada en la raíz
2. **Hacer commit y push** a Git
3. **Redeploy** en Cloudflare Pages
4. **Probar el login** - debería funcionar ahora

### Verificación
Para verificar que la estructura es correcta:
- El archivo `wrangler.toml` debe estar en la raíz
- La carpeta `functions/` debe estar en la raíz (no dentro de public/)
- El archivo `public/_worker.js` debe existir para manejar SPA routing

### Notas técnicas
- Cloudflare Pages reconoce automáticamente las carpetas `functions/` en la raíz como funciones serverless
- Las funciones usan el formato `onRequestGET/POST` de Cloudflare Workers
- El `_worker.js` en la carpeta public/ es opcional pero recomendado para SPA
- Los endpoints API responden a rutas como `/api/login`, `/api/me`, etc.
