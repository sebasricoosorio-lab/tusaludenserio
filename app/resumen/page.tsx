'use client';
// Resumen para consulta médica: un solo documento, siempre actualizado (se arma
// en el momento con los datos reales del paciente), pensado para llevarlo en el
// celular o imprimirlo antes de ver a un especialista — así no hay que repetir
// la historia desde cero en cada cita.
//
// No usa datos de ejemplo ni caché: cada vez que se abre, vuelve a pedir todo a
// la API (y por lo tanto a Supabase, filtrado por RLS al propio paciente).

import { useEffect, useState } from 'react';
import { api, ApiFail, mensajeDeError, type Row } from '@/lib/client-api';
import { ENTITY_KEYS, fechaCorta, fechaHora } from '@/lib/fields';
import { generarResumenPdf } from '@/lib/pdf-resumen';
import { obtenerRecientes } from '@/lib/recientes';

type Estado = 'cargando' | 'listo' | 'incompleto' | 'error';

function edad(birth?: string | null) {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const hoy = new Date();
  let a = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) a--;
  return a;
}

// Ordena una lista de filas por un campo de fecha/fecha-hora.
function porFecha(campo: string, orden: 'asc' | 'desc' = 'desc') {
  return (a: Row, b: Row) => {
    const da = new Date(a[campo]).getTime();
    const db = new Date(b[campo]).getTime();
    return orden === 'desc' ? db - da : da - db;
  };
}

export default function ResumenPage() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [patient, setPatient] = useState<Row | null>(null);
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [generado, setGenerado] = useState('');
  const [compartiendo, setCompartiendo] = useState(false);
  const [avisoCompartir, setAvisoCompartir] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await api<Row>('GET', '/api/consents');
        if (!c.hasActiveConsent) { setEstado('incompleto'); return; }
        const p = await api<Row | null>('GET', '/api/patient');
        if (!p) { setEstado('incompleto'); return; }
        const results = await Promise.all(ENTITY_KEYS.map((k) => api<Row[]>('GET', `/api/${k}`)));
        const next: Record<string, Row[]> = {};
        ENTITY_KEYS.forEach((k, i) => (next[k] = results[i]));
        setPatient(p);
        setData(next);
        setGenerado(new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }));
        setEstado('listo');
      } catch (e) {
        if (e instanceof ApiFail && e.status === 401) { setEstado('incompleto'); return; }
        setMensaje(mensajeDeError(e));
        setEstado('error');
      }
    })();
  }, []);

  async function compartirConMedico() {
    if (!patient) return;
    setAvisoCompartir(null);
    setCompartiendo(true);
    try {
      const blob = await generarResumenPdf(patient, data, generado);
      const nombreArchivo = `resumen-${(patient.full_name ?? 'paciente').replace(/\s+/g, '-').toLowerCase()}.pdf`;
      const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });

      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare?.({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          title: 'Resumen para consulta médica',
          text: `Resumen clínico de ${patient.full_name} — tusaludenserio`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        a.click();
        URL.revokeObjectURL(url);
        setAvisoCompartir('Tu navegador no permite compartir directamente. Descargamos el PDF — envíalo por WhatsApp o correo desde tus archivos.');
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // el usuario cerró el menú de compartir
      setAvisoCompartir(mensajeDeError(e));
    } finally {
      setCompartiendo(false);
    }
  }

  if (estado === 'cargando') return <main className="gate"><p aria-live="polite">Preparando tu resumen…</p></main>;

  if (estado === 'incompleto') {
    return (
      <main className="gate">
        <div className="card gate-card" style={{ textAlign: 'center' }}>
          <h2 className="serif">Todavía no hay un resumen para mostrar</h2>
          <p className="lead">Primero inicia sesión, acepta el consentimiento y completa tu perfil en el portal.</p>
          <a className="btn" href="/">Ir al portal</a>
        </div>
      </main>
    );
  }

  if (estado === 'error' || !patient) {
    return (
      <main className="gate">
        <div className="card gate-card" style={{ textAlign: 'center' }}>
          <h2 className="serif">No se pudo preparar el resumen</h2>
          <p className="lead">{mensaje ?? 'Ocurrió un error. Intenta de nuevo.'}</p>
          <a className="btn btn-ghost" href="/">Volver al portal</a>
        </div>
      </main>
    );
  }

  const rows = (k: string) => data[k] ?? [];
  const a = edad(patient.birth_date);
  const especialidades = [...rows('specialties')].sort(porFecha('visit_date'));
  const tratamientos = [...rows('treatments')].sort(porFecha('started_on'));
  const labs = [...rows('labs')].sort(porFecha('performed_on'));
  const proximasCitas = [...rows('appointments')]
    .filter((c) => new Date(c.appointment_date).getTime() >= Date.now())
    .sort(porFecha('appointment_date', 'asc'));
  const recientes = obtenerRecientes(data);

  return (
    <>
      <div className="resumen-bar no-print">
        <a className="btn btn-ghost btn-sm" href="/">← Volver al portal</a>
        <button type="button" className="btn btn-sm" onClick={() => window.print()}>Imprimir / Guardar como PDF</button>
        <button type="button" className="btn btn-sm" onClick={compartirConMedico} disabled={compartiendo}>
          {compartiendo ? 'Preparando…' : 'Compartir con tu médico'}
        </button>
      </div>
      {avisoCompartir && <p className="resumen-aviso no-print">{avisoCompartir}</p>}

      <main className="resumen">
        <header className="resumen-header">
          <div className="kicker">Resumen para tu consulta médica</div>
          <h1 className="serif">{patient.full_name}</h1>
          <div className="tag-row" style={{ justifyContent: 'flex-start' }}>
            <span className="pill">{patient.document_number}</span>
            {a !== null && <span className="pill">{a} años{patient.sex ? ` · ${patient.sex}` : ''}</span>}
            {patient.blood_type && <span className="pill">Tipo {patient.blood_type}</span>}
            <span className="pill pill-solid">{patient.insurance_eps}</span>
          </div>
          <p className="resumen-meta">Generado el {generado} · tusaludenserio</p>
        </header>

        <section className="resumen-section resumen-alert">
          <h2>Alergias</h2>
          {rows('allergies').length === 0 ? (
            <p className="empty">Sin alergias registradas.</p>
          ) : (
            rows('allergies').map((al) => (
              <p key={al.id}><strong>{al.allergen}</strong>{al.reaction ? ` — ${al.reaction}` : ''}</p>
            ))
          )}
        </section>

        <section className="resumen-section">
          <h2>Lo más reciente</h2>
          {recientes.length === 0 ? (
            <p className="empty">Sin actividad registrada todavía.</p>
          ) : (
            recientes.map((r, i) => (
              <div className="resumen-item" key={`${r.tipo}-${r.fecha}-${i}`}>
                <p><span className="tag">{r.tipo}</span> {fechaCorta(r.fecha)}</p>
                <p>{r.texto}</p>
              </div>
            ))
          )}
        </section>

        <section className="resumen-section">
          <h2>Medicamentos actuales</h2>
          {rows('medications').length === 0 ? (
            <p className="empty">Sin medicamentos registrados.</p>
          ) : (
            <ul>
              {rows('medications').map((m) => (
                <li key={m.id}><strong>{m.name}</strong> — {m.dose} · {m.frequency}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="resumen-section">
          <h2>Tratamientos</h2>
          {tratamientos.length === 0 ? (
            <p className="empty">Sin tratamientos registrados.</p>
          ) : (
            tratamientos.map((t) => (
              <div className="resumen-item" key={t.id}>
                <p><strong>{t.name}</strong> <span className="tag">{t.status}</span></p>
                <p className="resumen-sub">{t.specialty_name} · desde {fechaCorta(t.started_on)}</p>
                {t.instructions && <p>{t.instructions}</p>}
              </div>
            ))
          )}
        </section>

        <section className="resumen-section">
          <h2>Historia por especialidad</h2>
          {especialidades.length === 0 ? (
            <p className="empty">Sin registros.</p>
          ) : (
            especialidades.map((s) => (
              <div className="resumen-item" key={s.id}>
                <p><strong>{s.specialty_name}</strong> · {s.doctor_name} · {fechaCorta(s.visit_date)}</p>
                <p>Diagnóstico: {s.diagnosis}</p>
                {s.note && <p>{s.note}</p>}
                {s.recommendation && <p>Recomendación: {s.recommendation}</p>}
              </div>
            ))
          )}
        </section>

        <section className="resumen-section">
          <h2>Exámenes de laboratorio</h2>
          {labs.length === 0 ? (
            <p className="empty">Sin resultados registrados.</p>
          ) : (
            labs.map((l) => (
              <div className="resumen-item" key={l.id}>
                <p><strong>{l.test_name}</strong> <span className={`tag${l.status === 'Alto' || l.status === 'Bajo' ? ' tag-alto' : ''}`}>{l.status}</span></p>
                <p className="resumen-sub">{fechaCorta(l.performed_on)} — {l.result}{l.reference_range ? ` (rango: ${l.reference_range})` : ''}</p>
              </div>
            ))
          )}
        </section>

        {proximasCitas.length > 0 && (
          <section className="resumen-section">
            <h2>Próximas citas</h2>
            {proximasCitas.map((c) => (
              <p key={c.id}><strong>{fechaHora(c.appointment_date)}</strong> — {c.specialty_name}, {c.doctor_name} ({c.location})</p>
            ))}
          </section>
        )}

        <p className="footnote">Este resumen se genera automáticamente con los datos que el paciente ha registrado en el Portal del Paciente (tusaludenserio) y no reemplaza la historia clínica oficial de una IPS o EPS.</p>
      </main>
    </>
  );
}
