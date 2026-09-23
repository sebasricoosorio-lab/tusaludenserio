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
export const IconTratamientos = () => <Svg><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>;
export const IconLabs = () => <Svg><path d="M9 2v6L4 20a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L15 8V2" /><path d="M9 2h6" /></Svg>;
export const IconMeds = () => <Svg><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" /><line x1="9.5" y1="9.5" x2="14.5" y2="14.5" /></Svg>;
export const IconCitas = () => <Svg><rect x="3" y="4" width="18" height="18" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>;
export const IconAsistente = () => <Svg><path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5z" /><path d="M9 12l2 2 4-4" /></Svg>;
export const IconInstituciones = () => <Svg><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" /></Svg>;
export const IconDerechos = () => <Svg><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;
export const IconChevron = () => <Svg size={16}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconArrow = () => <Svg size={16}><path d="M7 17L17 7" /><path d="M7 7h10v10" /></Svg>;
