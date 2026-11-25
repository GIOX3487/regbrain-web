const UPSTREAM = 'https://ndwozjlasabsdfqcyeoy.supabase.co';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path;
    if (url.pathname === '/api/verify-site-password') {
      path = '/functions/v1/verify-site-password';
    } else if (url.pathname.startsWith('/api/supabase/')) {
      path = url.pathname.slice('/api/supabase'.length);
    } else if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    } else {
      return env.ASSETS.fetch(request);
    }
    // Fixed origin, never an arbitrary URL supplied by a caller.
    const upstream = new URL(UPSTREAM);
    upstream.pathname = path;
    upstream.search = url.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cookie');
    try {
      const response = await fetch(new Request(upstream, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
        duplex: 'half',
      }));
      const result = new Response(response.body, response);
      result.headers.set('Cache-Control', 'private, no-store');
      result.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return result;
    } catch {
      return new Response('Upstream unavailable', {
        status: 502,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
  },
};
