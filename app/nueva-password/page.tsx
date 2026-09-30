'use client';
// Pantalla para escribir una contraseña nueva. Solo funciona si se llegó
// aquí desde el enlace de "olvidé mi contraseña" (que ya dejó una sesión
// activa vía /auth/reset); si no hay sesión, la API devuelve 401.

import { useState, type FormEvent } from 'react';
import { api, ApiFail, mensajeDeError } from '@/lib/client-api';

export default function NuevaPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmar) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      await api('POST', '/api/auth/update-password', { password });
      setListo(true);
      window.setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (err) {
      if (err instanceof ApiFail && err.status === 401) setSinSesion(true);
      else setError(mensajeDeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gate">
      <div className="gate-inner">
        <div className="gate-brand">
          <h1 className="serif">Portal del Paciente</h1>
          <p>Tu salud, <b>en SERIO</b></p>
        </div>
        <div className="card gate-card">
          {sinSesion ? (
            <>
              <h2 className="serif">Este enlace ya no es válido</h2>
              <p className="lead">Puede que haya expirado o que ya lo hayas usado. Pide uno nuevo desde la pantalla de ingreso, en "¿Olvidaste tu contraseña?".</p>
              <a className="btn" href="/">Volver al portal</a>
            </>
          ) : listo ? (
            <>
              <h2 className="serif">Contraseña actualizada</h2>
              <p className="lead">Ya puedes usarla para entrar. Te llevamos al portal…</p>
            </>
          ) : (
            <>
              <h2 className="serif">Elige una contraseña nueva</h2>
              <p className="lead">Mínimo 10 caracteres.</p>
              <form onSubmit={enviar}>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="field">
                    <label htmlFor="np-pass">Contraseña nueva</label>
                    <input id="np-pass" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="np-pass2">Confirmar contraseña</label>
                    <input id="np-pass2" type="password" autoComplete="new-password" required minLength={10} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
                  </div>
                </div>
                {error && <div className="msg-error" role="alert">{error}</div>}
                <div className="form-actions">
                  <button className="btn" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
