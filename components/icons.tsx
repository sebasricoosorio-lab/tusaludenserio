// Iconos (estilo lucide, trazo = color del texto).
import type { ReactNode } from 'react';

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconPersonal = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Svg>;
export const IconEspecialidad = () => <Svg><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></Svg>;
export const IconCitas = () => <Svg><rect x="3" y="4" width="18" height="18" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>;
export const IconDerechos = () => <Svg><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;
export const IconArrow = () => <Svg size={16}><path d="M7 17L17 7" /><path d="M7 7h10v10" /></Svg>;
export const IconChevron = () => <Svg size={16}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconDocumento = () => <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Svg>;
export const IconInicio = () => <Svg><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Svg>;
