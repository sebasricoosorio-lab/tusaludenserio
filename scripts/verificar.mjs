// Verificación de aislamiento entre pacientes contra un proyecto Supabase REAL.
//
// Uso (con el servidor corriendo: npm run dev):
//   BASE_URL=http://localhost:3000 \
//   A_EMAIL=a@prueba.com A_PASS=... B_EMAIL=b@prueba.com B_PASS=... \
//   node scripts/verificar.mjs
//
// Requisitos: dos usuarios de prueba YA CONFIRMADOS (créalos en Supabase →
// Authentication → Users → Add user, con "Auto Confirm"). Usa datos ficticios.
// El script crea datos de prueba en la cuenta A; bórralos después.

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const { A_EMAIL, A_PASS, B_EMAIL, B_PASS } = process.env;
if (!A_EMAIL || !A_PASS || !B_EMAIL || !B_PASS) {
  console.error('Faltan A_EMAIL, A_PASS, B_EMAIL o B_PASS');
  process.exit(2);
}

// Cliente mínimo con "jar" de cookies por usuario.
function cliente() {
  const jar = new Map();
  return async (metodo, ruta, cuerpo) => {
    const headers = { 'Content-Type': 'application/json' };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    // Si el servidor corre en modo producción detrás de HTTP local, simula el proxy TLS.
    if (BASE.startsWith('http://')) headers['X-Forwarded-Proto'] = 'https';
    const r = await fetch(BASE + ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) {
      const [par] = c.split(';');
      const i = par.indexOf('=');
      const nombre = par.slice(0, i), valor = par.slice(i + 1);
      if (valor === '' || /max-age=0/i.test(c)) jar.delete(nombre); else jar.set(nombre, valor);
    }
    let json = null;
    try { json = await r.json(); } catch { /* sin cuerpo JSON */ }
    return { status: r.status, json };
  };
}

let fallos = 0;
function comprobar(nombre, condicion, detalle = '') {
  console.log(`${condicion ? 'OK   ' : 'FALLA'}  ${nombre}${condicion ? '' : '  → ' + detalle}`);
  if (!condicion) fallos++;
}

const A = cliente(), B = cliente();
const login = async (c, email, password) => (await c('POST', '/api/auth/login', { email, password })).status;

comprobar('A inicia sesión', (await login(A, A_EMAIL, A_PASS)) === 200, 'revisa credenciales / usuario confirmado');
comprobar('B inicia sesión', (await login(B, B_EMAIL, B_PASS)) === 200, 'revisa credenciales / usuario confirmado');

// --- Consentimiento y perfil (cuenta A) ---
const texto = await A('GET', '/api/consents');
const version = texto.json?.data?.current?.version;
comprobar('Se obtiene el texto de consentimiento vigente', !!version);

// Estas dos comprobaciones solo tienen sentido con una cuenta A "virgen". Si A ya
// aceptó el consentimiento / creó su perfil en una corrida anterior, se omiten.
let r;
if (texto.json?.data?.hasActiveConsent) {
  console.log('OMITE  A sin consentimiento → 403 (A ya consintió en una corrida anterior)');
} else {
  r = await A('POST', '/api/specialties', { specialty_name: 'Neurología' });
  comprobar('A sin consentimiento → 403 CONSENT_REQUIRED', r.status === 403 && r.json?.error?.code === 'CONSENT_REQUIRED', JSON.stringify(r));
}

r = await A('POST', '/api/consents', { action: 'accepted', version });
comprobar('A acepta el consentimiento', r.status === 201, JSON.stringify(r));

if ((await A('GET', '/api/patient')).json?.data) {
  console.log('OMITE  A sin perfil → 409 (A ya tiene perfil de una corrida anterior)');
} else {
  r = await A('POST', '/api/specialties', { specialty_name: 'Neurología' });
  comprobar('A sin perfil → 409 PROFILE_REQUIRED', r.status === 409 && r.json?.error?.code === 'PROFILE_REQUIRED', JSON.stringify(r));
}

r = await A('POST', '/api/patient', { full_name: 'Paciente Prueba A', document_number: 'CC 1', birth_date: '1990-01-01', insurance_eps: 'EPS Prueba' });
comprobar('A crea su perfil (o ya lo tenía)', r.status === 201 || r.status === 409, JSON.stringify(r));

r = await A('POST', '/api/specialties', { specialty_name: 'Neurología', doctor_name: 'Dr. Prueba', visit_date: '2026-01-15' });
comprobar('Falta el diagnóstico → 422 y nombra el campo', r.status === 422 && JSON.stringify(r.json).includes('diagnóstico'), JSON.stringify(r));

r = await A('POST', '/api/specialties', { specialty_name: 'Neurología', doctor_name: 'Dr. Prueba', visit_date: '2026-01-15', diagnosis: 'Dato de prueba' });
comprobar('A crea un registro clínico', r.status === 201 && r.json?.data?.id, JSON.stringify(r));
const idDeA = r.json?.data?.id;

r = await A('POST', '/api/specialties', { specialty_name: 'X', doctor_name: 'Y', visit_date: '2026-01-15', diagnosis: 'Z', patient_id: '00000000-0000-0000-0000-000000000000' });
comprobar('Enviar patient_id propio se rechaza (422)', r.status === 422, JSON.stringify(r));

// --- Aislamiento: la cuenta B no debe ver ni tocar lo de A ---
r = await B('GET', '/api/specialties');
comprobar('B lista specialties → vacío', r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length === 0, JSON.stringify(r));

r = await B('GET', `/api/specialties/${idDeA}`);
comprobar('B pide el registro de A → 404', r.status === 404, JSON.stringify(r));

r = await B('PATCH', `/api/specialties/${idDeA}`, { diagnosis: 'manipulado' });
comprobar('B intenta modificar el registro de A → 404 (o 403)', r.status === 404 || r.status === 403, JSON.stringify(r));

r = await B('DELETE', `/api/specialties/${idDeA}`);
comprobar('B intenta borrar el registro de A → 404', r.status === 404, JSON.stringify(r));

r = await B('POST', '/api/patient', { full_name: 'Paciente Prueba B', document_number: 'CC 2', birth_date: '1991-02-02', insurance_eps: 'EPS Prueba' });
comprobar('B sin consentimiento no puede crear perfil → 403', r.status === 403 && r.json?.error?.code === 'CONSENT_REQUIRED', JSON.stringify(r));

r = await B('GET', '/api/export');
comprobar('La exportación de B no contiene datos de A', r.status === 200 && !JSON.stringify(r.json).includes('Paciente Prueba A'), JSON.stringify(r).slice(0, 200));

// --- Que A sí conserve su registro, y que quede auditado ---
r = await A('GET', `/api/specialties/${idDeA}`);
comprobar('A sigue viendo su registro intacto', r.status === 200 && r.json?.data?.diagnosis === 'Dato de prueba', JSON.stringify(r));

r = await A('GET', '/api/export');
const log = r.json?.access_log ?? [];
comprobar('La exportación de A incluye el registro de accesos (auditoría)', r.status === 200 && Array.isArray(log) && log.length > 0, JSON.stringify(r).slice(0, 200));

r = await A('POST', '/api/deletion-request', { reason: 'prueba' });
comprobar('A puede solicitar eliminación (201) o ya tenía una (409)', r.status === 201 || r.status === 409, JSON.stringify(r));

// Limpieza del registro de prueba
await A('DELETE', `/api/specialties/${idDeA}`);

console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron.' : `\n${fallos} comprobación(es) fallaron.`);
console.log('Pendiente por SQL (no hay ruta para esto): en el SQL Editor, como usuario "authenticated", UPDATE/DELETE sobre audit_log debe fallar.');
process.exit(fallos === 0 ? 0 : 1);
