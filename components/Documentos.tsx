'use client';
// Documentos clínicos: subir un PDF o foto y tenerlo a la mano. No hay OCR:
// solo se guarda el archivo (Supabase Storage), su nombre/fecha, y —
// opcionalmente— una especialidad y una descripción corta para poder
// agruparlos en vez de verlos todos en una sola lista plana.

import { useRef, useState, type FormEvent } from 'react';
import { api, apiUpload, mensajeDeError, type Row } from '@/lib/client-api';

const MAX_MB = 4;
const SIN_CATEGORIA = 'Sin categoría';

function tamano(bytes?: number | null) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function agrupar(rows: Row[]) {
  const grupos = new Map<string, Row[]>();
  for (const r of rows) {
    const clave = r.specialty_name || SIN_CATEGORIA;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(r);
  }
  // Las categorías con nombre primero (orden alfabético), "Sin categoría" al final.
  return [...grupos.entries()].sort(([a], [b]) => {
    if (a === SIN_CATEGORIA) return 1;
    if (b === SIN_CATEGORIA) return -1;
    return a.localeCompare(b, 'es');
  });
}

type Props = {
  rows: Row[];
  onChanged: () => void;
  onNotice: (msg: string) => void;
};

export default function Documentos({ rows, onChanged, onNotice }: Props) {
  const [especialidad, setEspecialidad] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(e: FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      onNotice('Elige un archivo primero.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      onNotice(`El archivo supera el tamaño máximo permitido (${MAX_MB} MB).`);
      return;
    }
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (especialidad.trim()) form.append('specialty_name', especialidad.trim());
      if (descripcion.trim()) form.append('description', descripcion.trim());
      await apiUpload('/api/documents', form);
      onChanged();
      onNotice('Documento guardado.');
      setEspecialidad('');
      setDescripcion('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      onNotice(mensajeDeError(e));
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar(row: Row) {
    if (!window.confirm(`¿Borrar "${row.file_name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api('DELETE', `/api/documents/${row.id}`);
      onChanged();
      onNotice('Documento borrado.');
    } catch (e) {
      onNotice(mensajeDeError(e));
    }
  }

  return (
    <div>
      {rows.length === 0 ? (
        <p className="empty">Aún no has subido ningún documento.</p>
      ) : (
        agrupar(rows).map(([categoria, docs]) => (
          <div key={categoria} style={{ marginBottom: 14 }}>
            <h4 className="sub-title" style={{ marginBottom: 4 }}>{categoria}</h4>
            {docs.map((r) => (
              <div className="row-item" key={r.id}>
                <div className="row-main">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"><strong>{r.file_name}</strong></a>
                  ) : (
                    <strong>{r.file_name}</strong>
                  )}
                  {r.description && <div className="row-line">{r.description}</div>}
                  <div className="row-sub">
                    {new Date(r.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {r.size_bytes ? ` · ${tamano(r.size_bytes)}` : ''}
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={() => borrar(r)} aria-label={`Borrar ${r.file_name}`}>
                  Borrar
                </button>
              </div>
            ))}
          </div>
        ))
      )}

      <form onSubmit={subir} className="add-box">
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="field">
            <label htmlFor="doc-especialidad">Especialidad (opcional)</label>
            <input id="doc-especialidad" type="text" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Ej: Cardiología" />
          </div>
          <div className="field">
            <label htmlFor="doc-descripcion">Descripción (opcional)</label>
            <input id="doc-descripcion" type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Resultado resonancia" />
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
          style={{ marginBottom: 10, fontSize: 13 }}
        />
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" className="btn btn-sm" disabled={subiendo}>
            {subiendo ? 'Subiendo…' : 'Subir documento'}
          </button>
        </div>
        <p style={{ fontSize: 11, opacity: .6, marginTop: 8 }}>PDF, JPG, PNG, HEIC o WEBP · máx. {MAX_MB} MB</p>
      </form>
    </div>
  );
}
