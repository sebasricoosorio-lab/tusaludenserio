// Lectura de variables de entorno. Falla de forma explícita si falta alguna,
// para no arrancar a medias con una configuración insegura.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

// Se leen con acceso literal (process.env.X) porque Next las reemplaza en build.
export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  // Solo servidor. Sin barra final.
  siteUrl: () => required('SITE_URL', process.env.SITE_URL).replace(/\/$/, ''),
};

export const isProduction = process.env.NODE_ENV === 'production';
