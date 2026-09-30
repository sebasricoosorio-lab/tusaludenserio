'use client';
// Pantallas previas al portal: ingreso/registro, consentimiento y creación del perfil.

import { useState, type FormEvent, type ReactNode } from 'react';
import { api, mensajeDeError, type Row } from '@/lib/client-api';
import { PATIENT_FIELDS } from '@/lib/fields';
import EntityForm from '@/components/EntityForm';

function GateShell({ children }: { children: ReactNode }) {
  return (
    <main className="gate">
      <div className="gate-inner">
        <div className="gate-brand">
          <h1 className="serif">Portal del Paciente</h1>
          <p>Tu salud, <b>en SERIO</b></p>
        </div>
        {children}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- Ingreso
type Modo = 'login' | 'register' | 'magic' | 'reset';

export function AuthScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function cambiarModo(m: Modo) {
    setModo(m);
    setError(null);
    setInfo(null);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (modo === 'login') {
        await api('POST', '/api/auth/login', { email, password });
        onLoggedIn();
      } else if (modo === 'register') {
        const r = await api<Row>('POST', '/api/auth/register', { email, password });
        setInfo(r?.message ?? 'Revisa tu correo para confirmar la cuenta.');
      } else if (modo === 'magic') {
        const r = await api<Row>('POST', '/api/auth/magic-link', { email });
        setInfo(r?.message ?? 'Revisa tu correo.');
      } else {
        const r = await api<Row>('POST', '/api/auth/reset-password', { email });
        setInfo(r?.message ?? 'Revisa tu correo.');
      }
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GateShell>
      <div className="card gate-card">
        {modo === 'reset' ? (
          <>
            <h2 className="serif">Restablecer contraseña</h2>
            <p className="lead">Te enviamos un enlace de un solo uso para poner una contraseña nueva.</p>
          </>
        ) : (
          <div className="tabs" role="tablist" aria-label="Forma de acceso">
            {([['login', 'Ingresar'], ['register', 'Crear cuenta'], ['magic', 'Enlace por correo']] as [Modo, string][]).map(([m, t]) => (
              <button key={m} type="button" role="tab" className="tab" aria-selected={modo === m} onClick={() => cambiarModo(m)}>
                {t}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={enviar}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field">
              <label htmlFor="auth-email">Correo electrónico</label>
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {(modo === 'login' || modo === 'register') && (
              <div className="field">
                <label htmlFor="auth-pass">Contraseña{modo === 'register' ? ' (mínimo 10 caracteres)' : ''}</label>
                <input id="auth-pass" type="password" autoComplete={modo === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
          </div>
          {modo === 'login' && (
            <button type="button" className="icon-btn" style={{ padding: '6px 0', marginTop: -6 }} onClick={() => cambiarModo('reset')}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {error && <div className="msg-error" role="alert">{error}</div>}
          {info && <div className="msg-ok" role="status">{info}</div>}
          <div className="form-actions">
            {modo === 'reset' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => cambiarModo('login')}>Volver a ingresar</button>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Un momento…' : modo === 'login' ? 'Ingresar' : modo === 'register' ? 'Crear cuenta' : modo === 'magic' ? 'Enviarme el enlace' : 'Enviarme el enlace'}
            </button>
          </div>
        </form>
      </div>
    </GateShell>
  );
}

// ---------------------------------------------------------- Consentimiento
export function ConsentGate({ consent, onAccepted, onLogout }: { consent: Row; onAccepted: () => void; onLogout: () => void }) {
  const [acepto, setAcepto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/consents', { action: 'accepted', version: consent.current.version });
      onAccepted();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GateShell>
      <div className="card gate-card">
        <h2 className="serif">Autorización de tratamiento de datos</h2>
        <p className="lead">Antes de guardar tu información de salud necesitamos tu autorización expresa (Ley 1581 de 2012). Versión del texto: {consent.current.version}.</p>
        <div className="consent-text" tabIndex={0} aria-label="Texto de autorización">{consent.current.body}</div>
        <label className="check">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>He leído y autorizo el tratamiento de mis datos personales y de salud en los términos del texto anterior.</span>
        </label>
        {error && <div className="msg-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={onLogout}>Salir</button>
          <button className="btn" type="button" disabled={!acepto || busy} onClick={aceptar}>{busy ? 'Registrando…' : 'Autorizar y continuar'}</button>
        </div>
      </div>
    </GateShell>
  );
}

// ------------------------------------------------------------------ Perfil
export function ProfileGate({ onCreated, onLogout }: { onCreated: () => void; onLogout: () => void }) {
  return (
    <GateShell>
      <div className="card gate-card">
        <h2 className="serif">Crea tu perfil de paciente</h2>
        <p className="lead">Estos datos son la base de tu historia. Los marcados con * son obligatorios; el resto puedes completarlo después.</p>
        <EntityForm fields={PATIENT_FIELDS} method="POST" path="/api/patient" submitLabel="Crear mi perfil" onSaved={onCreated} />
        <button className="btn btn-ghost btn-sm" type="button" onClick={onLogout} style={{ marginTop: 10 }}>Salir</button>
      </div>
    </GateShell>
  );
}
