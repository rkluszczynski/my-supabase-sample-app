import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()

/**
 * Nowa nomenklatura kluczy Supabase: `sb_publishable_…` zastępuje starszy
 * JWT `anon`. Fallback na `VITE_SUPABASE_ANON_KEY` zostaje, żeby projekty
 * jeszcze niezmigrowane działały bez zmian w kodzie.
 *
 * Klucz publishable NIE jest sekretem — trafia do bundla i tak ma być.
 * Za bezpieczeństwo odpowiada Row Level Security, nie tajność klucza.
 */
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * Zabezpieczenie przed najkosztowniejszą pomyłką w tym pliku: klucz
 * `sb_secret_…` omija RLS, więc w kodzie klienckim oznaczałby pełny dostęp
 * do bazy dla każdego, kto otworzy narzędzia deweloperskie.
 */
if (publishableKey?.startsWith('sb_secret_') || publishableKey?.includes('service_role')) {
  throw new Error(
    'Wykryto klucz serwerowy we frontendzie. Klucz sb_secret_… / service_role omija RLS ' +
      'i nie wolno go umieszczać w kodzie klienckim. Użyj sb_publishable_….',
  )
}

/**
 * Brak zmiennych środowiskowych nie wywraca aplikacji — przykład działa wtedy
 * w trybie demonstracyjnym, a ekran logowania mówi o tym wprost.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey)

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, publishableKey!)
  : null
