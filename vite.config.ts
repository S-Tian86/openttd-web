import { defineConfig, type Plugin } from 'vite';

// Strict Content Security Policy (docs/plan/00-master.md §2.10).
// data:/blob: are needed by Phaser for generated textures.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  // Relative base: the same build works on GitHub Pages (/openttd-web/), itch.io or any sub-path.
  base: './',
  plugins: [contentSecurityPolicy()],
  // Phaser alone is ~1.3 MB minified (~350 kB gzipped); warn only above that.
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
