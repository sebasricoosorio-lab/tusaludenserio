/** @type {import('next').NextConfig} */

// Cabeceras de seguridad para todas las respuestas.
const securityHeaders = [
  // TLS obligatorio: el navegador nunca volverá a usar HTTP en este dominio (2 años).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  poweredByHeader: false, // no anunciar el framework
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Las respuestas de la API contienen datos de salud: jamás deben quedar en caché.
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
