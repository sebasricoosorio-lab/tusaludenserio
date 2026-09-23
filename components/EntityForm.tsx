'use client';
// Formulario genérico: se construye a partir de una lista de campos y envía a la
// API real. Si la API rechaza por datos faltantes, muestra exactamente cuáles.

import { useState, type FormEvent } from 'react';
import { api, ApiFail, mensajeDeError, type Row } from '@/lib/client-api';
import type { Field } from '@/lib/fields';

// Arma el cuerpo JSON. Al crear se omiten los opcionales vacíos; al corregir se
// envían como null (= "borrar ese dato").
export function buildPayload(fields: Field[], values: Record<string, string>, mode: 'create' | 'edit'): Row {
  const body: Row = {};
  for (const f of fields) {
    const raw = (values[f.name] ?? '').trim();
    if (raw === '') {
      if (mode === 'edit' && !f.required) body[f.name] = null;
      continue;
    }
    body[f.name] = f.kind === 'datetime' ? new Date(raw).toISOString() : raw;
  }
  return body;
}

// Convierte un valor de la API al valor de un <input> (para editar).
export function toInputValue(f: Field, v: unknown): string {
  if (v == null) return '';
  if (f.kind === 'datetime') {
    const d = new Date(String(v));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(v);
}

type Props = {
  fields: Field[];
  method: 'POST' | 'PATCH';
  path: string;
  initial?: Record<string, string>;
  extra?: Row; // valores fijos que se agregan al envío (ej. lugar de una cita)
  submitLabel: string;
  onSaved: (saved: Row) => void;
  onCancel?: () => void;
};

export default function EntityForm({ fields, method, path, initial, extra, submitLabel, onSaved, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMissing([]);
    try {
      const body = { ...buildPayload(fields, values, method === 'POST' ? 'create' : 'edit'), ...(extra ?? {}) };
      const saved = await api<Row>(method, path, body);
      onSaved(saved);
    } catch (err) {
      setError(mensajeDeError(err));
      if (err instanceof ApiFail && err.fields) setMissing(err.fields.map((f) => f.field));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        {fields.map((f) => {
          const id = `f-${path}-${f.name}`;
          const common = { id, value: values[f.name] ?? '', 'aria-invalid': missing.includes(f.name) || undefined };
          return (
            <div key={f.name} className={'field' + (f.full ? ' full' : '')}>
              <label htmlFor={id}>
                {f.label}
                {f.required ? ' *' : ''}
              </label>
              {f.kind === 'select' ? (
                <select {...common} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">{f.required ? 'Selecciona…' : '—'}</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.kind === 'textarea' ? (
                <textarea {...common} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <input
                  {...common}
                  type={f.kind === 'date' ? 'date' : f.kind === 'datetime' ? 'datetime-local' : f.kind === 'email' ? 'email' : 'text'}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="msg-error" role="alert">{error}</div>}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-sm" disabled={busy}>
          {busy ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
