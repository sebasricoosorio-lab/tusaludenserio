// Documentos clínicos: solo se guarda el archivo (PDF o foto), sin OCR.
// El archivo vive en Supabase Storage (bucket 'documentos-clinicos', bajo la
// carpeta del propio usuario); esta tabla solo guarda su metadata.
//
// GET  /api/documents  → listar mis documentos (con enlace temporal de descarga)
// POST /api/documents  → subir un documento (multipart/form-data, campo "file")

import { route, ok, ApiError, dbError } from '@/lib/http';
import { requireUser, requireConsent, requirePatientId, auditRead } from '@/lib/guard';

const BUCKET = 'documentos-clinicos';
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB: bajo el límite de subida de Vercel
const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const URL_VIGENCIA_SEGUNDOS = 60 * 10; // 10 minutos, suficiente para ver/descargar

export const GET = route(async () => {
  const { supabase } = await requireUser();
  await auditRead(supabase, 'documents', null);

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(200);
  if (error) throw dbError(error);

  const conEnlace = await Promise.all(
    (data ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.file_path, URL_VIGENCIA_SEGUNDOS);
      return { ...doc, url: signed?.signedUrl ?? null };
    }),
  );
  return ok(conEnlace);
});

export const POST = route(async (req) => {
  const { supabase, user } = await requireUser();
  await requireConsent(supabase);
  const patientId = await requirePatientId(supabase);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, 'INVALID_FORM', 'La petición debe ser multipart/form-data con un archivo.');
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(422, 'MISSING_FILE', 'No se recibió ningún archivo.');
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError(422, 'FILE_TOO_LARGE', 'El archivo supera el tamaño máximo permitido (4 MB).');
  }
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new ApiError(422, 'UNSUPPORTED_TYPE', 'Solo se aceptan archivos PDF, JPG, PNG, HEIC o WEBP.');
  }

  const especialidad = String(form.get('specialty_name') ?? '').trim().slice(0, 120) || null;
  const descripcion = String(form.get('description') ?? '').trim().slice(0, 300) || null;

  const nombreSeguro = file.name.replace(/[^\w.\-() ]/g, '_').slice(0, 120) || 'documento';
  const filePath = `${user.id}/${crypto.randomUUID()}-${nombreSeguro}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new ApiError(500, 'UPLOAD_FAILED', 'No se pudo guardar el archivo. Intenta de nuevo.');

  const { data, error } = await supabase
    .from('documents')
    .insert({
      patient_id: patientId,
      file_path: filePath,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      specialty_name: especialidad,
      description: descripcion,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([filePath]); // evita dejar el archivo huérfano
    throw dbError(error);
  }
  return ok(data, 201);
});
