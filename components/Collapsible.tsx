'use client';
// Sub-sección contraíble dentro de un panel (ej. "Tratamientos" dentro de
// "Historia clínica"). Mismo estilo de texto que el resto del panel; solo
// controla si el contenido se ve o no.

import { useState, type ReactNode } from 'react';
import { IconChevron } from '@/components/icons';

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function Collapsible({ title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel-section">
      <button type="button" className="collapsible-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="sub-title" style={{ marginBottom: 0 }}>{title}</span>
        <span className="collapsible-chevron" style={open ? { transform: 'rotate(180deg)' } : undefined}>
          <IconChevron />
        </span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
