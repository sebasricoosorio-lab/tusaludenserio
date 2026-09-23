# Portal del Paciente (tusaludenserio)

Parte del ecosistema **SERIO**. Portal donde cada paciente gestiona su propia
historia clínica — especialidades, tratamientos, laboratorios, medicamentos,
alergias, citas y línea de tiempo — con persistencia real en Supabase
(Postgres + Row Level Security: cada usuario solo ve y edita sus propios
datos), sesión propia, y sus derechos de acceso, corrección y eliminación de
datos (Ley 1581 de 2012).

Stack: Next.js (App Router) + Supabase (Auth + Postgres + RLS) + TypeScript + zod.

## Correrlo en local

```bash
npm install
cp .env.example .env.local   # completa los valores, ver abajo
npm run dev                  # http://localhost:3000
```

Antes de usarlo necesitas un proyecto de Supabase con el esquema aplicado:

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia todo `supabase/schema.sql` y ejecútalo una sola vez en **SQL Editor**.
3. En **Authentication → Providers → Email**, activa *Confirm email*.
4. En **Authentication → URL Configuration**, agrega `SITE_URL/auth/callback` a *Redirect URLs*.
5. Completa `.env.local` con los valores de **Project Settings → API Keys** y **Data API** (ver `.env.example`).

## Despliegue

Se despliega en **Vercel**, con el dominio personalizado
`tusaludenserio.sebastianrico.me`. Las variables de entorno se configuran en
el panel de Vercel (Project Settings → Environment Variables), no en el
repositorio — ver `.env.example` para la lista y de dónde sacar cada valor.

## Estado

Backend (rutas de API + esquema SQL con RLS) y frontend conectados y
verificados contra un proyecto Supabase real: aislamiento entre pacientes,
consentimiento obligatorio para guardar datos, y auditoría de accesos.

Pendiente: revisión legal del texto de consentimiento (`supabase/schema.sql`,
tabla `consent_texts`), carga real de documentos (OCR) y búsqueda real de
citas. Detalles en los comentarios de `supabase/schema.sql` y en
`scripts/verificar.mjs` (script de verificación de aislamiento entre cuentas).
