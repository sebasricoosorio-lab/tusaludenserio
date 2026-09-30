// Esquemas de validación (zod) de cada entidad.
//
// Requisito 7: si falta un dato obligatorio, el mensaje dice EXACTAMENTE cuál
// falta y se rechaza la operación. Nunca se inventa un valor ni se guarda null
// en un campo obligatorio.
//
// Todos los esquemas son .strict(): si el cliente envía campos que no conoce
// (por ejemplo owner_user_id, patient_id o id), se rechaza. Esos valores los
// pone siempre el servidor / la base de datos.

import { z } from 'zod';

// --- Bloques reutilizables -------------------------------------------------

// Texto obligatorio: sin espacios sobrantes, mínimo 1 carácter.
const texto = (etiqueta: string, max = 300) =>
  z
    .string({ required_error: `Falta ${etiqueta}`, invalid_type_error: `${etiqueta} debe ser texto` })
    .trim()
    .min(1, `Falta ${etiqueta}`)
    .max(max, `${etiqueta} es demasiado largo (máximo ${max} caracteres)`);

// Texto opcional: puede omitirse o enviarse null (= el paciente no lo tiene / no lo quiere dar).
const textoOpc = (etiqueta: string, max = 2000) => texto(etiqueta, max).nullable().optional();

// Fecha AAAA-MM-DD válida de verdad (rechaza 2026-02-30).
const fecha = (etiqueta: string) =>
  z
    .string({ required_error: `Falta ${etiqueta}`, invalid_type_error: `${etiqueta} debe ser texto` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${etiqueta} debe tener formato AAAA-MM-DD`)
    .refine((v) => {
      const [y, m, d] = v.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    }, `${etiqueta} no es una fecha válida`);

// Fecha y hora ISO 8601 con zona horaria (para citas).
const fechaHora = (etiqueta: string) =>
  z
    .string({ required_error: `Falta ${etiqueta}`, invalid_type_error: `${etiqueta} debe ser texto` })
    .datetime({ offset: true, message: `${etiqueta} debe ser fecha y hora ISO con zona horaria (ej. 2026-09-30T10:30:00-05:00)` });

const enumerado = <T extends [string, ...string[]]>(etiqueta: string, valores: T) =>
  z.enum(valores, {
    // (zod no permite mezclar errorMap con required_error, por eso se distingue aquí)
    errorMap: (_issue, ctx) => ({
      message:
        ctx.data === undefined
          ? `Falta ${etiqueta}`
          : `${etiqueta} debe ser uno de: ${valores.join(', ')}`,
    }),
  });

// Convierte un esquema de creación en uno de corrección parcial (PATCH):
// todos los campos opcionales, pero al menos uno.
export function paraCorreccion<S extends z.ZodObject<z.ZodRawShape>>(schema: S) {
  return schema
    .partial()
    .refine((o) => Object.keys(o).length > 0, { message: 'No enviaste ningún dato para corregir' });
}

// --- Paciente -------------------------------------------------------------

export const patientCreate = z
  .object({
    full_name: texto('el nombre completo', 200),
    document_number: texto('el número de documento de identidad', 40),
    birth_date: fecha('la fecha de nacimiento'),
    insurance_eps: texto('la EPS o seguro médico', 200),
    sex: enumerado('el sexo', ['Femenino', 'Masculino', 'Otro']).nullable().optional(),
    blood_type: enumerado('el tipo de sangre', ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'])
      .nullable()
      .optional(),
    phone: textoOpc('el teléfono', 40),
    contact_email: z
      .string({ invalid_type_error: 'El correo de contacto debe ser texto' })
      .trim()
      .email('El correo de contacto no es válido')
      .max(200)
      .nullable()
      .optional(),
    address: textoOpc('la dirección', 300),
    emergency_contact_name: textoOpc('el nombre del contacto de emergencia', 200),
    emergency_contact_phone: textoOpc('el teléfono del contacto de emergencia', 40),
  })
  .strict();
export const patientUpdate = paraCorreccion(patientCreate);

// --- Historia clínica por especialidad ------------------------------------

export const specialtyCreate = z
  .object({
    specialty_name: texto('la especialidad', 120),
    doctor_name: texto('el nombre del médico', 200),
    visit_date: fecha('la fecha de la consulta'),
    diagnosis: texto('el diagnóstico', 1000),
    note: textoOpc('la nota clínica'),
    recommendation: textoOpc('la recomendación'),
  })
  .strict();

// --- Tratamientos ---------------------------------------------------------

export const treatmentCreate = z
  .object({
    name: texto('el nombre del tratamiento', 200),
    specialty_name: texto('la especialidad del tratamiento', 120),
    status: enumerado('el estado del tratamiento', ['En curso', 'Continuo', 'Por confirmar', 'Finalizado']),
    started_on: fecha('la fecha de inicio del tratamiento'),
    instructions: textoOpc('las instrucciones'),
  })
  .strict();

// --- Laboratorios ---------------------------------------------------------

export const labCreate = z
  .object({
    test_name: texto('el nombre del examen', 200),
    performed_on: fecha('la fecha del examen'),
    result: texto('el resultado del examen', 500),
    reference_range: textoOpc('el rango de referencia', 200),
    status: enumerado('el estado del resultado', ['Normal', 'Alto', 'Bajo', 'Seguimiento']),
  })
  .strict();

// --- Medicamentos ---------------------------------------------------------

export const medicationCreate = z
  .object({
    name: texto('el nombre del medicamento', 200),
    dose: texto('la dosis', 120),
    frequency: texto('la frecuencia', 200),
  })
  .strict();

// --- Alergias -------------------------------------------------------------

export const allergyCreate = z
  .object({
    allergen: texto('el alérgeno', 200),
    reaction: textoOpc('la reacción', 500),
  })
  .strict();

// --- Citas ----------------------------------------------------------------

export const appointmentCreate = z
  .object({
    appointment_date: fechaHora('la fecha y hora de la cita'),
    doctor_name: texto('el nombre del médico', 200),
    specialty_name: texto('la especialidad de la cita', 120),
    location: texto('el lugar de la cita', 300),
  })
  .strict();

// --- Línea de tiempo ------------------------------------------------------

export const timelineCreate = z
  .object({
    event_date: fecha('la fecha del evento'),
    label: texto('la descripción del evento', 300),
    event_type: enumerado('el tipo de evento', ['visita', 'tratamiento', 'examen']),
  })
  .strict();

// --- Consentimiento y eliminación ----------------------------------------

export const consentBody = z
  .object({
    action: enumerado('la acción', ['accepted', 'revoked']),
    version: texto('la versión del texto de consentimiento', 20),
  })
  .strict();

export const deletionBody = z
  .object({ reason: textoOpc('el motivo', 1000) })
  .strict();

// --- Autenticación --------------------------------------------------------

const correo = z
  .string({ required_error: 'Falta el correo electrónico' })
  .trim()
  .toLowerCase()
  .email('El correo electrónico no es válido')
  .max(254);

// 72 = límite de bcrypt. Mínimo 10 para una contraseña razonable.
const contrasenaNueva = z
  .string({ required_error: 'Falta la contraseña' })
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres');

export const registerBody = z.object({ email: correo, password: contrasenaNueva }).strict();

export const loginBody = z
  .object({ email: correo, password: z.string({ required_error: 'Falta la contraseña' }).min(1, 'Falta la contraseña').max(72) })
  .strict();

export const magicLinkBody = z.object({ email: correo }).strict();

export const resetPasswordBody = z.object({ email: correo }).strict();

export const newPasswordBody = z.object({ password: contrasenaNueva }).strict();
