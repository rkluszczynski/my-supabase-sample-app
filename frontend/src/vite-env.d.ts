/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Nowa nomenklatura: sb_publishable_… */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Starsza nazwa, utrzymywana dla zgodności wstecznej. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
