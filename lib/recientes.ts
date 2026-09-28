// Combina las distintas categorías de la historia clínica (consultas,
// tratamientos, laboratorios, línea de tiempo) en una sola lista ordenada por
// fecha, para mostrar "lo más reciente" de un vistazo antes del detalle
// completo por categoría.

import type { Row } from '@/lib/client-api';

export type EventoReciente = { fecha: string; tipo: string; texto: string };

export function obtenerRecientes(data: Record<string, Row[]>, limite = 5): EventoReciente[] {
  const eventos: EventoReciente[] = [];

  for (const s of data.specialties ?? []) {
    if (!s.visit_date) continue;
    eventos.push({ fecha: s.visit_date, tipo: 'Consulta', texto: `${s.specialty_name} — ${s.doctor_name}: ${s.diagnosis}` });
  }
  for (const t of data.treatments ?? []) {
    if (!t.started_on) continue;
    eventos.push({ fecha: t.started_on, tipo: 'Tratamiento', texto: `${t.name} (${t.status})` });
  }
  for (const l of data.labs ?? []) {
    if (!l.performed_on) continue;
    eventos.push({ fecha: l.performed_on, tipo: 'Laboratorio', texto: `${l.test_name}: ${l.result} (${l.status})` });
  }
  for (const e of data.timeline ?? []) {
    if (!e.event_date) continue;
    const tipo = typeof e.event_type === 'string' && e.event_type.length > 0
      ? e.event_type[0].toUpperCase() + e.event_type.slice(1)
      : 'Evento';
    eventos.push({ fecha: e.event_date, tipo, texto: String(e.label ?? '') });
  }

  return eventos
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, limite);
}
