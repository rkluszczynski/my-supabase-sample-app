import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_LEGAL_ACTS } from '../lib/demoStore'
import type { LegalAct, Publisher } from '../lib/database.types'

/**
 * Listing aktów prawnych — wspólny dla wszystkich zalogowanych użytkowników.
 *
 * Zapytanie nie filtruje po użytkowniku: zakres widoczności wymusza polityka
 * `legal_acts_select_authenticated` po stronie bazy. Gdyby ktoś wywołał to samo
 * zapytanie bez ważnej sesji, dostałby pusty zbiór, nie błąd.
 *
 * Dane napełnia proces wsadowy `legal-acts-ingest` z API ELI Sejmu.
 */
export function useLegalActs(publisher: Publisher | 'ALL' = 'ALL') {
  const [acts, setActs] = useState<LegalAct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)

      if (!supabase) {
        const demo =
          publisher === 'ALL'
            ? DEMO_LEGAL_ACTS
            : DEMO_LEGAL_ACTS.filter((a) => a.publisher === publisher)
        setActs(demo)
        setLoading(false)
        return
      }

      let query = supabase
        .from('legal_acts')
        .select('*')
        .order('promulgation_date', { ascending: false, nullsFirst: false })
        .order('position', { ascending: false })
        .limit(200)

      if (publisher !== 'ALL') query = query.eq('publisher', publisher)

      const { data, error: queryError } = await query

      if (!active) return
      if (queryError) setError(queryError.message)
      else {
        setError(null)
        setActs(data ?? [])
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [publisher])

  return { acts, loading, error }
}
