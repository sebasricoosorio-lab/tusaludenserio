'use client';
// Tarjeta desplegable. Se abre/cierra con clic en la cabecera (no con el cursor:
// ahora hay formularios dentro y no deben cerrarse al mover el mouse).

import type { ReactNode } from 'react';
import { IconChevron } from '@/components/icons';

type Props = {
  id: string;
  kicker: string;
  title: string;
  icon: ReactNode;
  preview: string;
  isOpen: boolean;
  onToggle: () => void;
  info?: boolean;
  className?: string;
  children: ReactNode;
};

export default function Tile({ id, kicker, title, icon, preview, isOpen, onToggle, info, className, children }: Props) {
  return (
    <section id={id} className={`card tile${isOpen ? ' open' : ''}${info ? ' info' : ''}${className ? ' ' + className : ''}`}>
      <button type="button" className="tile-head" onClick={onToggle} aria-expanded={isOpen} aria-controls={`${id}-body`}>
        <span className="tile-icon">{icon}</span>
        <span className="tile-titles">
          <span className="tile-kicker" style={{ display: 'block' }}>{kicker}</span>
          <span className="serif tile-title" style={{ display: 'block' }}>{title}</span>
        </span>
        <span className="tile-chevron"><IconChevron /></span>
      </button>
      {!isOpen && <p className="tile-preview">{preview}</p>}
      {isOpen && <div id={`${id}-body`} className="tile-body">{children}</div>}
    </section>
  );
}
