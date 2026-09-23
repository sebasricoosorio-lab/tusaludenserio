// Respuestas y manejo de errores comunes a todas las rutas.
//
// REGLA DE PRIVACIDAD: nunca se registra (console.*) el cuerpo de una petición,
// ni el mensaje/detalle de un error de Postgres (puede incluir valores de la
// fila, es decir, datos médicos). Solo se registra método, ruta, estado y un
// código de error.

import { NextResponse, type NextRequest } from 'next/server';
import type { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

function failResponse(e: ApiError) {
  return NextResponse.json(
    { error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } },
    { status: e.status },
  );
}

// Traduce errores de Postgres/PostgREST a errores de API seguros (sin filtrar detalles).
export function dbError(error: { code?: string }): ApiError {
  switch (error.code) {
    case '42501': // violación de política RLS o falta de permiso
      return new ApiError(
        403,
        'FORBIDDEN',
        'No tienes permiso para esta operación. Si intentabas guardar datos, verifica que hayas aceptado el consentimiento vigente.',
      );
    case '23505': // clave única duplicada
      return new ApiError(409, 'ALREADY_EXISTS', 'Ya existe un registro con esos datos.');
    case '23502': // NOT NULL
    case '23514': // CHECK
    case '23503': // llave foránea
    case '22P02': // formato inválido
    case '22007':
    case '22008':
      return new ApiError(422, 'INVALID_DATA', 'Alguno de los datos enviados no es válido o está incompleto.');
    default:
      return new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno. Intenta de nuevo.');
  }
}

// Convierte los errores de validación de zod en un mensaje claro que pide el dato faltante.
export function validationError(err: ZodError): ApiError {
  const fields = err.issues.map((i) =>
    i.code === 'unrecognized_keys'
      ? { field: '(cuerpo)', message: `Campo(s) no permitido(s): ${i.keys.join(', ')}` }
      : { field: i.path.join('.') || '(cuerpo)', message: i.message },
  );
  const resumen = fields.map((f) => f.message).join('; ');
  return new ApiError(
    422,
    'MISSING_OR_INVALID_DATA',
    `No se guardó nada. Completa o corrige estos datos: ${resumen}.`,
    fields,
  );
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse>;

// Envuelve cada ruta: atrapa errores y responde siempre con el mismo formato.
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    let status = 200;
    try {
      const res = await handler(req, ctx);
      status = res.status;
      return res;
    } catch (e) {
      if (e instanceof ApiError) {
        status = e.status;
        return failResponse(e);
      }
      status = 500;
      // Solo el tipo de error, nunca su mensaje.
      console.error(`[api] error no controlado: ${e instanceof Error ? e.name : 'desconocido'}`);
      return failResponse(new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno. Intenta de nuevo.'));
    } finally {
      // Log mínimo, sin datos personales ni médicos.
      console.info(`[api] ${req.method} ${req.nextUrl.pathname} -> ${status}`);
    }
  };
}
