'use client';
// Documentos clínicos: subir un PDF o foto y tenerlo a la mano. No hay OCR:
// solo se guarda el archivo (Supabase Storage) y su nombre/fecha.

import { useRef, useState } from 'react';
import { api, apiUpload, mensajeDeError, type Row } from '@/lib/client-api';

const MAX_MB = 4;

function tamano(bytes?: number | null) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Props = {
  rows: Row[];
  onChanged: () => void;
  onNotice: (msg: string) => void;
};

export default function Documentos({ rows, onChanged, onNotice }: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function subir(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      onNotice(`El archivo supera el tamaño máximo permitido (${MAX_MB} MB).`);
      return;
    }
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiUpload('/api/documents', form);
      onChanged();
      onNotice('Documento guardado.');
    } catch (e) {
      onNotice(mensajeDeError(e));
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
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
      {rows.length === 0 && <p className="empty">Aún no has subido ningún documento.</p>}
      {rows.map((r) => (
        <div className="row-item" key={r.id}>
          <div className="row-main">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer"><strong>{r.file_name}</strong></a>
            ) : (
              <strong>{r.file_name}</strong>
            )}
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

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 8 }}
        disabled={subiendo}
        onClick={() => inputRef.current?.click()}
      >
        {subiendo ? 'Subiendo…' : '+ Subir documento (PDF o foto, máx. 4 MB)'}
      </button>
    </div>
  );
}
