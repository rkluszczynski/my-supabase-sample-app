type RuntimeConfig = {
  supabaseUrl?: string
  supabasePublishableKey?: string
}

declare global {
  interface Window {
    __S2APP_CONFIG__?: RuntimeConfig
  }
}

const runtimeConfig = window.__S2APP_CONFIG__ ?? {}

export const supabaseUrl =
  runtimeConfig.supabaseUrl?.trim() || import.meta.env.VITE_SUPABASE_URL?.trim()

export const supabasePublishableKey =
  runtimeConfig.supabasePublishableKey?.trim() || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
