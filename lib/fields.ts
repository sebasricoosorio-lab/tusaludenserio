// Configuración de la interfaz: qué campos tiene cada entidad y cómo se muestra
// cada fila. Los nombres de campo coinciden con los de la API/base de datos.

import type { Row } from '@/lib/client-api';

export type Field = {
  name: string;
  label: string;
  kind?: 'text' | 'date' | 'datetime' | 'select' | 'textarea' | 'email';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  full?: boolean; // ocupa las dos columnas
};

export const PATIENT_FIELDS: Field[] = [
  { name: 'full_name', label: 'Nombre completo', required: true, full: true, placeholder: 'Ej: María Fernanda Ríos' },
  { name: 'document_number', label: 'Documento de identidad', required: true, placeholder: 'CC 12.345.678' },
  { name: 'insurance_eps', label: 'EPS / seguro médico', required: true, placeholder: 'Ej: Nueva EPS' },
  { name: 'birth_date', label: 'Fecha de nacimiento', kind: 'date', required: true },
  { name: 'sex', label: 'Sexo', kind: 'select', options: ['Femenino', 'Masculino', 'Otro'] },
  { name: 'blood_type', label: 'Tipo de sangre', kind: 'select', options: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
  { name: 'phone', label: 'Teléfono' },
  { name: 'contact_email', label: 'Correo de contacto', kind: 'email' },
  { name: 'address', label: 'Dirección', full: true },
  { name: 'emergency_contact_name', label: 'Contacto de emergencia (nombre)' },
  { name: 'emergency_contact_phone', label: 'Contacto de emergencia (teléfono)' },
];

export type EntityUi = {
  title: string; // singular, para el botón "Agregar …"
  fields: Field[];
  // Cómo se muestra una fila
  view: (r: Row) => { title: string; sub?: string; lines?: (string | null | undefined)[]; tag?: { text: string; tone?: 'alto' | 'normal' } };
};

const STATUS_TRAT = ['En curso', 'Continuo', 'Por confirmar', 'Finalizado'];
const STATUS_LAB = ['Normal', 'Alto', 'Bajo', 'Seguimiento'];

export const fechaCorta = (iso?: string | null) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fechaHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const ENTITY_UI: Record<string, EntityUi> = {
  specialties: {
    title: 'consulta',
    fields: [
      { name: 'specialty_name', label: 'Especialidad', required: true, placeholder: 'Ej: Neurología' },
      { name: 'doctor_name', label: 'Médico', required: true },
      { name: 'visit_date', label: 'Fecha de la consulta', kind: 'date', required: true },
      { name: 'diagnosis', label: 'Diagnóstico', required: true, full: true },
      { name: 'note', label: 'Nota clínica', kind: 'textarea', full: true },
      { name: 'recommendation', label: 'Recomendación', kind: 'textarea', full: true },
    ],
    view: (r) => ({
      title: r.specialty_name,
      sub: `${r.doctor_name} · ${fechaCorta(r.visit_date)}`,
      lines: [`Diagnóstico: ${r.diagnosis}`, r.note, r.recommendation ? `Recomendación: ${r.recommendation}` : null],
    }),
  },
  treatments: {
    title: 'tratamiento',
    fields: [
      { name: 'name', label: 'Tratamiento', required: true, full: true },
      { name: 'specialty_name', label: 'Especialidad', required: true },
      { name: 'status', label: 'Estado', kind: 'select', options: STATUS_TRAT, required: true },
      { name: 'started_on', label: 'Fecha de inicio', kind: 'date', required: true },
      { name: 'instructions', label: 'Instrucciones', kind: 'textarea', full: true },
    ],
    view: (r) => ({
      title: r.name,
      sub: `${r.specialty_name} · desde ${fechaCorta(r.started_on)}`,
      lines: [r.instructions],
      tag: { text: r.status },
    }),
  },
  labs: {
    title: 'examen',
    fields: [
      { name: 'test_name', label: 'Examen', required: true, full: true },
      { name: 'performed_on', label: 'Fecha', kind: 'date', required: true },
      { name: 'status', label: 'Estado', kind: 'select', options: STATUS_LAB, required: true },
      { name: 'result', label: 'Resultado', required: true },
      { name: 'reference_range', label: 'Rango de referencia' },
    ],
    view: (r) => ({
      title: r.test_name,
      sub: fechaCorta(r.performed_on),
      lines: [`Resultado: ${r.result}`, r.reference_range ? `Rango: ${r.reference_range}` : null],
      tag: { text: r.status, tone: r.status === 'Alto' || r.status === 'Bajo' ? 'alto' : r.status === 'Normal' ? 'normal' : undefined },
    }),
  },
  medications: {
    title: 'medicamento',
    fields: [
      { name: 'name', label: 'Medicamento', required: true, full: true },
      { name: 'dose', label: 'Dosis', required: true, placeholder: 'Ej: 1 tableta' },
      { name: 'frequency', label: 'Frecuencia', required: true, placeholder: 'Ej: cada 12 h' },
    ],
    view: (r) => ({ title: r.name, sub: `${r.dose} · ${r.frequency}` }),
  },
  allergies: {
    title: 'alergia',
    fields: [
      { name: 'allergen', label: 'Alérgeno', required: true },
      { name: 'reaction', label: 'Reacción' },
    ],
    view: (r) => ({ title: r.allergen, sub: r.reaction ?? undefined, tag: { text: 'Alergia', tone: 'alto' } }),
  },
  appointments: {
    title: 'cita',
    fields: [
      { name: 'appointment_date', label: 'Fecha y hora', kind: 'datetime', required: true },
      { name: 'specialty_name', label: 'Especialidad', required: true },
      { name: 'doctor_name', label: 'Médico', required: true },
      { name: 'location', label: 'Lugar', required: true, full: true },
    ],
    view: (r) => ({ title: `${fechaHora(r.appointment_date)} — ${r.specialty_name}`, sub: `${r.doctor_name} · ${r.location}` }),
  },
  timeline: {
    title: 'evento',
    fields: [
      { name: 'event_date', label: 'Fecha', kind: 'date', required: true },
      { name: 'event_type', label: 'Tipo', kind: 'select', options: ['visita', 'tratamiento', 'examen'], required: true },
      { name: 'label', label: 'Descripción', required: true, full: true },
    ],
    view: (r) => ({ title: r.label, sub: `${fechaCorta(r.event_date)} · ${r.event_type}` }),
  },
};

export const ENTITY_KEYS = Object.keys(ENTITY_UI);

export const INSTITUCIONES = [
  { name: 'Fundación Santa Fe de Bogotá', city: 'Bogotá', type: 'Clínica' },
  { name: 'Hospital Universitario San Ignacio', city: 'Bogotá', type: 'Hospital' },
  { name: 'Clínica del Country', city: 'Bogotá', type: 'Clínica' },
  { name: 'Clínica Reina Sofía', city: 'Bogotá', type: 'Clínica' },
  { name: 'Hospital Pablo Tobón Uribe', city: 'Medellín', type: 'Hospital' },
  { name: 'Clínica Imbanaco', city: 'Cali', type: 'Clínica' },
  { name: 'IPS Colsubsidio', city: 'Bogotá', type: 'IPS' },
];

export const ENSERIO_URL = 'https://cheerful-salmiakki-df3a1a.netlify.app/#generar';
