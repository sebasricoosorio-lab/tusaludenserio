'use client';
// Registra el service worker del "cascarón" de la app (ver public/sw.js).
// No hace nada más: no pide notificaciones, no cachea datos clínicos.

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* si falla, la app sigue funcionando igual */ });
    }
  }, []);
  return null;
}
