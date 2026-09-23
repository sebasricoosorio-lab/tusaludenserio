// Cliente de la API para el navegador. Las cookies de sesión son httpOnly: el
// navegador las envía solo, este código nunca ve ni guarda el token.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export class ApiFail extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T = Row>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Row | null = null;
  try {
    json = await res.json();
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  if (!res.ok) {
    throw new ApiFail(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Ocurrió un error. Intenta de nuevo.', json?.error?.fields);
  }
  return json?.data as T;
}

export function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error. Intenta de nuevo.';
}
