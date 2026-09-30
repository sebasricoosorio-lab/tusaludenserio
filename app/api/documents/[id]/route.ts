// DELETE /api/documents/{id} → borra un documento (fila + archivo en Storage)

import { z } from 'zod';
import { route, ok, ApiError, dbError } from '@/lib/http';
import { requireUser } from '@/lib/guard';

const BUCKET = 'documentos-clinicos';
const uuid = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new ApiError(404, 'NOT_FOUND', 'Documento no encontrado.');
  const { supabase } = await requireUser();

  // El RLS limita el borrado a documentos propios; select('file_path') nos
  // dice si de verdad existía y qué archivo borrar del Storage.
  const { data, error } = await supabase.from('documents').delete().eq('id', id).select('file_path').maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new ApiError(404, 'NOT_FOUND', 'Documento no encontrado.');

  await supabase.storage.from(BUCKET).remove([data.file_path]);
  return ok({ id, deleted: true });
});
