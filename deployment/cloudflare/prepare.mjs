import { readFile, writeFile, copyFile } from 'node:fs/promises';

// Runs only after the dedicated Cloudflare build; Vercel's build is unchanged.
const file = new URL('../../dist/index.html', import.meta.url);
const html = await readFile(file, 'utf8');
await writeFile(file, html.replaceAll('mnbagzwdlvyjrmoyroqg.supabase.co', 'ndwozjlasabsdfqcyeoy.supabase.co'));
await copyFile(new URL('./worker.js', import.meta.url), new URL('../../dist/_worker.js', import.meta.url));
await writeFile(new URL('../../dist/_routes.json', import.meta.url), JSON.stringify({
  version: 1, include: ['/api/*'], exclude: [],
}));
await writeFile(new URL('../../dist/_headers', import.meta.url), `/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
`);
console.log('Cloudflare trial prepared: API proxy, static assets, noindex, current Supabase CSP.');
