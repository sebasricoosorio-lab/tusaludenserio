'use client';
// Portal del Paciente — interfaz conectada al backend real.
// Flujo: sesión → consentimiento → perfil → portal. Todos los datos vienen de /api/*
// (Supabase con RLS); aquí no hay datos de ejemplo ni simulaciones.

import { useCallback, useEffect, useState } from 'react';
import { api, ApiFail, mensajeDeError, type Row } from '@/lib/client-api';
import { ENTITY_KEYS, ENSERIO_URL, INSTITUCIONES, PATIENT_FIELDS, fechaCorta } from '@/lib/fields';
import { AuthScreen, ConsentGate, ProfileGate } from '@/components/Gates';
import EntityList from '@/components/EntityList';
import EntityForm, { toInputValue } from '@/components/EntityForm';
import Documentos from '@/components/Documentos';
import Tile from '@/components/Tile';
import {
  IconArrow, IconAsistente, IconCitas, IconDerechos, IconDocumento, IconEspecialidad,
  IconInstituciones, IconLabs, IconMeds, IconPersonal, IconTratamientos,
} from '@/components/icons';

type Phase = 'loading' | 'auth' | 'consent' | 'profile' | 'portal';
const ALL_KEYS = [...ENTITY_KEYS, 'documents'];

// Arma el texto de la solicitud de cita para enviar por WhatsApp o correo.
// No inventa ni asume ningún dato de contacto de la institución: el propio
// paciente elige a quién enviárselo desde su celular/correo.
function mensajeSolicitud(inst: { name: string; city: string }, patient: Row, especialidad: string, fecha: string) {
  const partes = [
    `Hola, soy ${patient.full_name}, documento ${patient.document_number}, afiliado(a) a ${patient.insurance_eps}.`,
    `Quisiera solicitar una cita${especialidad ? ` de ${especialidad}` : ''} en ${inst.name} (${inst.city})${fecha ? `, preferiblemente ${fecha}` : ''}.`,
    'Gracias.',
  ];
  return partes.join(' ');
}
function edad(birth?: string | null) {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const hoy = new Date();
  let a = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) a--;
  return a;
}

export default function PortalApp() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [consent, setConsent] = useState<Row | null>(null);
  const [patient, setPatient] = useState<Row | null>(null);
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [bookingFor, setBookingFor] = useState<string | null>(null);
  const [solEspecialidad, setSolEspecialidad] = useState('');
  const [solFecha, setSolFecha] = useState('');

  function abrirSolicitud(nombre: string) {
    setSolEspecialidad('');
    setSolFecha('');
    setBookingFor(bookingFor === nombre ? null : nombre);
  }

  const toast = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const loadAll = useCallback(async () => {
    const results = await Promise.all(ALL_KEYS.map((k) => api<Row[]>('GET', `/api/${k}`)));
    const next: Record<string, Row[]> = {};
    ALL_KEYS.forEach((k, i) => (next[k] = results[i]));
    setData(next);
  }, []);

  const refresh = useCallback(async (entity: string) => {
    try {
      const rows = await api<Row[]>('GET', `/api/${entity}`);
      setData((d) => ({ ...d, [entity]: rows }));
    } catch (e) {
      toast(mensajeDeError(e));
    }
  }, [toast]);

  // Decide en qué pantalla estamos según lo que responde el servidor.
  const bootstrap = useCallback(async () => {
    try {
      const c = await api<Row>('GET', '/api/consents');
      setConsent(c);
      if (!c.hasActiveConsent) return setPhase('consent');
      const p = await api<Row | null>('GET', '/api/patient');
      setPatient(p);
      if (!p) return setPhase('profile');
      await loadAll();
      setPhase('portal');
    } catch (e) {
      if (!(e instanceof ApiFail && e.status === 401)) toast(mensajeDeError(e));
      setPhase('auth');
    }
  }, [loadAll, toast]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  async function salir() {
    try { await api('POST', '/api/auth/logout'); } catch { /* aun así se limpia la pantalla */ }
    setPatient(null);
    setData({});
    setOpen(null);
    setPhase('auth');
  }

  async function solicitarEliminacion() {
    if (!window.confirm('Se registrará tu solicitud de eliminación de datos. Un responsable verificará tu identidad y te responderá. ¿Continuar?')) return;
    try {
      const r = await api<Row>('POST', '/api/deletion-request', {});
      toast(r.message ?? 'Solicitud registrada.');
    } catch (e) {
      toast(mensajeDeError(e));
    }
  }

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  // ------------------------------------------------------------ pantallas previas
  if (phase === 'loading') return <main className="gate"><p aria-live="polite">Cargando…</p></main>;
  if (phase === 'auth') return <><AuthScreen onLoggedIn={bootstrap} />{notice && <div className="card toast" role="status">{notice}</div>}</>;
  if (phase === 'consent' && consent) return <ConsentGate consent={consent} onAccepted={bootstrap} onLogout={salir} />;
  if (phase === 'profile') return <ProfileGate onCreated={bootstrap} onLogout={salir} />;
  if (!patient) return null;

  // --------------------------------------------------------------------- portal
  const rows = (k: string) => data[k] ?? [];
  const proxima = rows('appointments')[0];
  const espPreview = rows('specialties').length
    ? rows('specialties').slice(0, 2).map((s) => s.specialty_name).join(', ') + (rows('specialties').length > 2 ? ` +${rows('specialties').length - 2}` : '')
    : 'Sin registros todavía';
  const a = edad(patient.birth_date);

  return (
    <>
      <nav className="navbar" aria-label="Navegación principal">
        <span className="card serif nav-brand">portal</span>
        <div className="card nav-links">
          <a href="#portal">Mi historia</a>
          <a href="/resumen" target="_blank" rel="noopener noreferrer">Resumen para consulta</a>
          <a href="#tile-derechos">Mis derechos</a>
        </div>
        <div className="nav-right">
          <a className="btn btn-sm" href={ENSERIO_URL} target="_blank" rel="noopener noreferrer">EnSERIO <IconArrow /></a>
          <button className="btn btn-ghost btn-sm" type="button" onClick={salir}>Salir</button>
        </div>
      </nav>

      <main id="portal" className="portal">
        <div className="portal-inner">
          <div className="portal-header">
            <div className="kicker">// Tu portal</div>
            <h2 className="serif">{patient.full_name}</h2>
            <p className="serif slogan">Tu salud, <b>en SERIO</b></p>
            <div className="tag-row">
              <span className="pill">{patient.document_number}</span>
              {a !== null && <span className="pill">{a} años{patient.sex ? ` · ${patient.sex}` : ''}</span>}
              {patient.blood_type && <span className="pill">Tipo {patient.blood_type}</span>}
              <span className="pill pill-solid">{patient.insurance_eps}</span>
            </div>
          </div>

          <div className="card resumen-cta">
            <div>
              <strong>Resumen para tu consulta</strong>
              <p>Un solo documento con tus alergias, medicamentos, tratamientos y diagnósticos al día — muéstralo o imprímelo la próxima vez que veas a un especialista, sin tener que contar todo de nuevo.</p>
            </div>
            <a className="btn btn-sm" href="/resumen" target="_blank" rel="noopener noreferrer">Ver resumen <IconArrow /></a>
          </div>

          <div className="tile-grid">
            <Tile id="tile-asistente" className="assistant-tile" info kicker="Apoyo legal" title="¿Tu EPS negó tu tratamiento?" icon={<IconAsistente />}
              preview="Genera tu Derecho de Petición o Acción de Tutela en EnSERIO." isOpen={open === 'asistente'} onToggle={() => toggle('asistente')}>
              <p style={{ fontSize: 13, marginBottom: 14 }}>EnSERIO te guía con un cuestionario y arma el borrador de tu Derecho de Petición o Acción de Tutela con tus datos.</p>
              <a className="btn" href={ENSERIO_URL} target="_blank" rel="noopener noreferrer">Generar mi documento en EnSERIO <IconArrow /></a>
            </Tile>

            <Tile id="tile-citas" kicker="Agenda" title="Citas y línea de tiempo" icon={<IconCitas />}
              preview={proxima ? `Próxima: ${proxima.specialty_name} — ${new Date(proxima.appointment_date).toLocaleDateString('es-CO')}` : 'Sin citas registradas'}
              isOpen={open === 'citas'} onToggle={() => toggle('citas')}>
              <div className="two-cols">
                <EntityList entity="appointments" heading="Citas" rows={rows('appointments')} onChanged={() => refresh('appointments')} onNotice={toast} />
                <EntityList entity="timeline" heading="Línea de tiempo" rows={rows('timeline')} onChanged={() => refresh('timeline')} onNotice={toast} />
              </div>
            </Tile>

            <Tile id="tile-personal" kicker="Perfil" title="Información personal" icon={<IconPersonal />}
              preview={`${patient.document_number} · ${patient.insurance_eps}`} isOpen={open === 'personal'} onToggle={() => toggle('personal')}>
              {editing ? (
                <EntityForm
                  fields={PATIENT_FIELDS} method="PATCH" path="/api/patient" submitLabel="Guardar cambios"
                  initial={Object.fromEntries(PATIENT_FIELDS.map((f) => [f.name, toInputValue(f, patient[f.name])]))}
                  onCancel={() => setEditing(false)}
                  onSaved={(p) => { setPatient(p); setEditing(false); toast('Datos corregidos.'); }}
                />
              ) : (
                <>
                  <div className="fields-grid">
                    {[
                      ['Fecha de nacimiento', fechaCorta(patient.birth_date)], ['Teléfono', patient.phone], ['Correo de contacto', patient.contact_email],
                      ['Dirección', patient.address], ['Contacto de emergencia', [patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' — ')],
                      ['EPS / seguro', patient.insurance_eps],
                    ].map(([l, v]) => (
                      <div key={l}><div className="lbl">{l}</div><div>{v || <span style={{ opacity: .5 }}>Sin dato</span>}</div></div>
                    ))}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setEditing(true)}>Corregir mis datos</button>
                </>
              )}
            </Tile>

            <Tile id="tile-especialidad" kicker="Historia clínica" title="Por especialidad" icon={<IconEspecialidad />}
              preview={espPreview} isOpen={open === 'especialidad'} onToggle={() => toggle('especialidad')}>
              <EntityList entity="specialties" rows={rows('specialties')} onChanged={() => refresh('specialties')} onNotice={toast} />
            </Tile>

            <Tile id="tile-tratamientos" kicker="Seguimiento" title="Tratamientos" icon={<IconTratamientos />}
              preview={`${rows('treatments').length} tratamiento(s)`} isOpen={open === 'tratamientos'} onToggle={() => toggle('tratamientos')}>
              <EntityList entity="treatments" rows={rows('treatments')} onChanged={() => refresh('treatments')} onNotice={toast} />
            </Tile>

            <Tile id="tile-labs" kicker="Resultados" title="Exámenes de laboratorio" icon={<IconLabs />}
              preview={rows('labs')[0] ? `${rows('labs')[0].test_name} — ${rows('labs')[0].status}` : 'Sin resultados todavía'}
              isOpen={open === 'labs'} onToggle={() => toggle('labs')}>
              <EntityList entity="labs" rows={rows('labs')} onChanged={() => refresh('labs')} onNotice={toast} />
            </Tile>

            <Tile id="tile-medicamentos" kicker="Medicación" title="Medicamentos y alergias" icon={<IconMeds />}
              preview={`${rows('medications').length} medicamento(s) · ${rows('allergies').length} alergia(s)`} isOpen={open === 'medicamentos'} onToggle={() => toggle('medicamentos')}>
              <div className="two-cols">
                <EntityList entity="medications" heading="Medicamentos actuales" rows={rows('medications')} onChanged={() => refresh('medications')} onNotice={toast} />
                <EntityList entity="allergies" heading="Alergias" rows={rows('allergies')} onChanged={() => refresh('allergies')} onNotice={toast} />
              </div>
            </Tile>

            <Tile id="tile-documentos" kicker="Archivos" title="Documentos" icon={<IconDocumento />}
              preview={`${rows('documents').length} documento(s) guardado(s)`} isOpen={open === 'documentos'} onToggle={() => toggle('documentos')}>
              <p style={{ fontSize: 13, opacity: .8, marginBottom: 8 }}>Guarda el PDF o la foto de tu historia clínica, fórmulas o resultados para tenerlos a la mano. No se procesa ni se lee su contenido automáticamente.</p>
              <Documentos rows={rows('documents')} onChanged={() => refresh('documents')} onNotice={toast} />
            </Tile>

            <Tile id="tile-instituciones" kicker="Directorio" title="Instituciones médicas" icon={<IconInstituciones />}
              preview={`${INSTITUCIONES.length} hospitales, IPS y clínicas — registra tu cita en la que elijas`} isOpen={open === 'instituciones'} onToggle={() => toggle('instituciones')}>
              <p style={{ fontSize: 13, opacity: .8, marginBottom: 8 }}>Arma tu solicitud de cita para enviarla por WhatsApp o correo, y regístrala aquí cuando la confirmen.</p>
              {INSTITUCIONES.map((i) => (
                <div key={i.name}>
                  <div className="dir-row">
                    <span className="grow">{i.name} <span className="city">{i.city}</span></span>
                    <span className="tag">{i.type}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirSolicitud(i.name)}>
                      {bookingFor === i.name ? 'Cerrar' : 'Solicitar cita'}
                    </button>
                  </div>
                  {bookingFor === i.name && (
                    <div className="add-box">
                      <div className="form-grid" style={{ marginBottom: 10 }}>
                        <div className="field">
                          <label htmlFor={`sol-esp-${i.name}`}>Especialidad deseada</label>
                          <input id={`sol-esp-${i.name}`} type="text" value={solEspecialidad} onChange={(e) => setSolEspecialidad(e.target.value)} placeholder="Ej: Neurología" />
                        </div>
                        <div className="field">
                          <label htmlFor={`sol-fecha-${i.name}`}>Fecha preferida (opcional)</label>
                          <input id={`sol-fecha-${i.name}`} type="text" value={solFecha} onChange={(e) => setSolFecha(e.target.value)} placeholder="Ej: la próxima semana" />
                        </div>
                      </div>
                      <div className="tag-row" style={{ justifyContent: 'flex-start', marginBottom: 16 }}>
                        <a
                          className="btn btn-sm"
                          href={`https://wa.me/?text=${encodeURIComponent(mensajeSolicitud(i, patient, solEspecialidad, solFecha))}`}
                          target="_blank" rel="noopener noreferrer"
                        >
                          Enviar por WhatsApp
                        </a>
                        <a
                          className="btn btn-ghost btn-sm"
                          href={`mailto:?subject=${encodeURIComponent(`Solicitud de cita — ${i.name}`)}&body=${encodeURIComponent(mensajeSolicitud(i, patient, solEspecialidad, solFecha))}`}
                        >
                          Enviar por correo
                        </a>
                      </div>
                      <p style={{ fontSize: 12, opacity: .7, marginBottom: 8 }}>¿Ya te confirmaron la cita? Regístrala para verla en “Citas y línea de tiempo”:</p>
                      <EntityForm
                        fields={[
                          { name: 'appointment_date', label: 'Fecha y hora', kind: 'datetime', required: true },
                          { name: 'specialty_name', label: 'Especialidad', required: true },
                          { name: 'doctor_name', label: 'Médico', required: true, full: true },
                        ]}
                        method="POST" path="/api/appointments" extra={{ location: `${i.name} — ${i.city}` }} submitLabel="Registrar cita"
                        onCancel={() => setBookingFor(null)}
                        onSaved={() => { setBookingFor(null); refresh('appointments'); toast('Cita registrada.'); }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </Tile>

            <Tile id="tile-derechos" kicker="Ley 1581 de 2012" title="Mis derechos sobre mis datos" icon={<IconDerechos />}
              preview="Descargar, corregir o solicitar la eliminación de tus datos" isOpen={open === 'derechos'} onToggle={() => toggle('derechos')}>
              <p style={{ fontSize: 13, marginBottom: 14 }}>Tus datos son tuyos. Puedes descargarlos completos (incluido quién los ha consultado), corregirlos en cada sección o pedir que los eliminemos.</p>
              <div className="rights">
                <a className="btn btn-ghost btn-sm" href="/api/export">Descargar mis datos (JSON)</a>
                <button type="button" className="btn btn-danger btn-sm" onClick={solicitarEliminacion}>Solicitar eliminación de mis datos</button>
              </div>
            </Tile>
          </div>

          <p className="footnote">Prototipo local del Portal del Paciente. Los datos que ves están guardados en la base de datos de tu proyecto, protegidos por sesión y control de acceso por paciente. El texto legal de autorización es provisional y debe ser revisado por un abogado antes de publicar.</p>
        </div>
      </main>

      {notice && <div className="card toast" role="status">{notice}</div>}
    </>
  );
}
