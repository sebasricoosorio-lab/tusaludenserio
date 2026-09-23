// Mapa de entidades con CRUD genérico. Solo las claves de este objeto son
// válidas en /api/[entity]; cualquier otra ruta responde 404.
// (patients tiene su propia ruta: /api/patient, porque es 1 por cuenta.)

import type { ZodObject, ZodRawShape } from 'zod';
import { ApiError } from '@/lib/http';
import {
  specialtyCreate,
  treatmentCreate,
  labCreate,
  medicationCreate,
  allergyCreate,
  appointmentCreate,
  timelineCreate,
} from '@/lib/schemas';

export type EntityConfig = {
  table: string;
  create: ZodObject<ZodRawShape>;
  orderBy: string; // columna para ordenar la lista (más reciente primero)
};

export const ENTITIES: Record<string, EntityConfig> = {
  specialties: { table: 'specialties', create: specialtyCreate, orderBy: 'visit_date' },
  treatments: { table: 'treatments', create: treatmentCreate, orderBy: 'started_on' },
  labs: { table: 'labs', create: labCreate, orderBy: 'performed_on' },
  medications: { table: 'medications', create: medicationCreate, orderBy: 'created_at' },
  allergies: { table: 'allergies', create: allergyCreate, orderBy: 'created_at' },
  appointments: { table: 'appointments', create: appointmentCreate, orderBy: 'appointment_date' },
  timeline: { table: 'timeline', create: timelineCreate, orderBy: 'event_date' },
};

// Lista blanca: evita que un nombre de entidad arbitrario llegue a la consulta.
export function getEntity(name: string): EntityConfig {
  if (!Object.prototype.hasOwnProperty.call(ENTITIES, name)) {
    throw new ApiError(404, 'NOT_FOUND', 'Recurso no encontrado.');
  }
  return ENTITIES[name];
}
