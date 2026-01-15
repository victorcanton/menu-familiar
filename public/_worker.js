export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Las rutas /api/* se manejan automáticamente por functions/
    // Las rutas de archivos estáticos se sirven desde public/

    // Para rutas que no son /api/ y no son archivos estáticos,
    // se devuelve index.html para SPA routing
    if (!pathname.match(/\.\w+$/) && !pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
    }

    return env.ASSETS.fetch(request);
  },
};
