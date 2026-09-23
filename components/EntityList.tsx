'use client';
// Lista de registros de una entidad con "Agregar" y "Borrar", todo contra la API real.

import { useState } from 'react';
import { api, mensajeDeError, type Row } from '@/lib/client-api';
import { ENTITY_UI } from '@/lib/fields';
import EntityForm from '@/components/EntityForm';

type Props = {
  entity: string;
  rows: Row[];
  heading?: string;
  onChanged: () => void; // pide recargar esta entidad
  onNotice: (msg: string) => void;
};

export default function EntityList({ entity, rows, heading, onChanged, onNotice }: Props) {
  const ui = ENTITY_UI[entity];
  const [adding, setAdding] = useState(false);

  async function borrar(row: Row) {
    if (!window.confirm('¿Borrar este registro? Esta acción no se puede deshacer.')) return;
    try {
      await api('DELETE', `/api/${entity}/${row.id}`);
      onChanged();
      onNotice('Registro borrado.');
    } catch (e) {
      onNotice(mensajeDeError(e));
    }
  }

  return (
    <div>
      {heading && <h3 className="sub-title">{heading}</h3>}
      {rows.length === 0 && <p className="empty">Aún no hay registros.</p>}
      {rows.map((r) => {
        const v = ui.view(r);
        return (
          <div className="row-item" key={r.id}>
            <div className="row-main">
              <strong>{v.title}</strong>
              {v.tag && <span className={`tag${v.tag.tone ? ' tag-' + v.tag.tone : ''}`}>{v.tag.text}</span>}
              {v.sub && <div className="row-sub">{v.sub}</div>}
              {v.lines?.filter(Boolean).map((l, i) => (
                <div className="row-line" key={i}>{l}</div>
              ))}
            </div>
            <button type="button" className="icon-btn" onClick={() => borrar(r)} aria-label={`Borrar ${v.title}`}>
              Borrar
            </button>
          </div>
        );
      })}

      {adding ? (
        <div className="add-box">
          <EntityForm
            fields={ui.fields}
            method="POST"
            path={`/api/${entity}`}
            submitLabel="Guardar"
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              onChanged();
              onNotice('Guardado.');
            }}
          />
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>
          + Agregar {ui.title}
        </button>
      )}
    </div>
  );
}
