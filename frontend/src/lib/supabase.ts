import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabasePublishableKey, supabaseUrl } from './runtimeConfig'

/**
 * Nowa nomenklatura kluczy Supabase: `sb_publishable_…` jest jedynym poprawnym
 * kluczem frontendowym. W tej aplikacji nie obsługujemy starszego `anon`.
 *
 * Klucz publishable NIE jest sekretem — trafia do bundla i tak ma być.
 * Za bezpieczeństwo odpowiada Row Level Security, nie tajność klucza.
 */
const publishableKey = supabasePublishableKey
const url = supabaseUrl

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
