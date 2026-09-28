// Genera el PDF del resumen para consulta médica en el navegador (texto real,
// no una captura de pantalla) para poder compartirlo con el médico.

import type { Row } from '@/lib/client-api';
import { fechaCorta, fechaHora } from '@/lib/fields';
import { obtenerRecientes } from '@/lib/recientes';

function edad(birth?: string | null) {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const hoy = new Date();
  let a = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) a--;
  return a;
}

export async function generarResumenPdf(
  patient: Row,
  data: Record<string, Row[]>,
  generado: string
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const margen = 48;
  const ancho = doc.internal.pageSize.getWidth() - margen * 2;
  const alto = doc.internal.pageSize.getHeight();
  let y = margen;

  const saltoDePagina = (espacioNecesario = 40) => {
    if (y + espacioNecesario > alto - margen) {
      doc.addPage();
      y = margen;
    }
  };

  const titulo = (texto: string) => {
    saltoDePagina(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(texto, margen, y);
    y += 8;
    doc.setLineWidth(0.5);
    doc.line(margen, y, margen + ancho, y);
    y += 16;
  };

  const parrafo = (texto: string, opts: { bold?: boolean; size?: number } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 10.5);
    const lineas = doc.splitTextToSize(texto, ancho);
    for (const linea of lineas) {
      saltoDePagina(16);
      doc.text(linea, margen, y);
      y += 14;
    }
  };

  const seccionVacia = (texto: string) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    saltoDePagina(16);
    doc.text(texto, margen, y);
    y += 18;
  };

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Resumen para consulta médica', margen, y);
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(String(patient.full_name ?? ''), margen, y);
  y += 16;

  const a = edad(patient.birth_date as string | null);
  const datos = [
    patient.document_number,
    a !== null ? `${a} años${patient.sex ? ` · ${patient.sex}` : ''}` : null,
    patient.blood_type ? `Tipo ${patient.blood_type}` : null,
    patient.insurance_eps,
  ]
    .filter(Boolean)
    .join(' · ');
  parrafo(datos, { size: 10.5 });
  parrafo(`Generado el ${generado} · tusaludenserio`, { size: 9 });
  y += 6;

  const rows = (k: string) => data[k] ?? [];
  const porFecha = (campo: string, orden: 'asc' | 'desc' = 'desc') => (r1: Row, r2: Row) => {
    const d1 = new Date(r1[campo]).getTime();
    const d2 = new Date(r2[campo]).getTime();
    return orden === 'desc' ? d2 - d1 : d1 - d2;
  };

  // Alergias
  titulo('Alergias');
  const alergias = rows('allergies');
  if (alergias.length === 0) seccionVacia('Sin alergias registradas.');
  else alergias.forEach((al) => parrafo(`${al.allergen}${al.reaction ? ` — ${al.reaction}` : ''}`, { bold: true }));
  y += 6;

  // Lo más reciente
  titulo('Lo más reciente');
  const recientes = obtenerRecientes(data);
  if (recientes.length === 0) seccionVacia('Sin actividad registrada todavía.');
  else recientes.forEach((r) => parrafo(`[${r.tipo} · ${fechaCorta(r.fecha)}] ${r.texto}`));
  y += 6;

  // Medicamentos
  titulo('Medicamentos actuales');
  const medicamentos = rows('medications');
  if (medicamentos.length === 0) seccionVacia('Sin medicamentos registrados.');
  else medicamentos.forEach((m) => parrafo(`• ${m.name} — ${m.dose} · ${m.frequency}`));
  y += 6;

  // Tratamientos
  titulo('Tratamientos');
  const tratamientos = [...rows('treatments')].sort(porFecha('started_on'));
  if (tratamientos.length === 0) seccionVacia('Sin tratamientos registrados.');
  else
    tratamientos.forEach((t) => {
      parrafo(`${t.name} (${t.status})`, { bold: true });
      parrafo(`${t.specialty_name} · desde ${fechaCorta(t.started_on)}`, { size: 9.5 });
      if (t.instructions) parrafo(String(t.instructions));
      y += 4;
    });

  // Historia por especialidad
  titulo('Historia por especialidad');
  const especialidades = [...rows('specialties')].sort(porFecha('visit_date'));
  if (especialidades.length === 0) seccionVacia('Sin registros.');
  else
    especialidades.forEach((s) => {
      parrafo(`${s.specialty_name} · ${s.doctor_name} · ${fechaCorta(s.visit_date)}`, { bold: true });
      parrafo(`Diagnóstico: ${s.diagnosis}`);
      if (s.note) parrafo(String(s.note));
      if (s.recommendation) parrafo(`Recomendación: ${s.recommendation}`);
      y += 4;
    });

  // Labs
  titulo('Exámenes de laboratorio');
  const labs = [...rows('labs')].sort(porFecha('performed_on'));
  if (labs.length === 0) seccionVacia('Sin resultados registrados.');
  else
    labs.forEach((l) => {
      parrafo(`${l.test_name} (${l.status})`, { bold: true });
      parrafo(`${fechaCorta(l.performed_on)} — ${l.result}${l.reference_range ? ` (rango: ${l.reference_range})` : ''}`, { size: 9.5 });
      y += 4;
    });

  // Próximas citas
  const proximasCitas = [...rows('appointments')]
    .filter((c) => new Date(c.appointment_date).getTime() >= Date.now())
    .sort(porFecha('appointment_date', 'asc'));
  if (proximasCitas.length > 0) {
    titulo('Próximas citas');
    proximasCitas.forEach((c) => parrafo(`${fechaHora(c.appointment_date)} — ${c.specialty_name}, ${c.doctor_name} (${c.location})`));
  }

  y += 10;
  saltoDePagina(30);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  parrafo(
    'Este resumen se genera automáticamente con los datos que el paciente ha registrado en el Portal del Paciente (tusaludenserio) y no reemplaza la historia clínica oficial de una IPS o EPS.'
  );

  return doc.output('blob');
}
