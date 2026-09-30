import './globals.css';
import RegisterSW from '@/components/RegisterSW';
import type { Viewport } from 'next';

export const metadata = {
  title: 'Portal del Paciente — tusaludenserio',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Mi Portal' },
};

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Tipografías del diseño: Instrument Serif (títulos) y Barlow (texto) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&display=swap" />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
