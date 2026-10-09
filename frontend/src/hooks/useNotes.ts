import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createDemoNote, deleteDemoNote, listDemoNotes } from '../lib/demoStore'
import type { Note } from '../lib/database.types'

/**
 * Notatki prywatne — widoczne wyłącznie dla ich autora.
 *
 * Zwróć uwagę, że zapytania NIE zawierają `.eq('user_id', …)`. To nie jest
 * przeoczenie: filtrowanie po stronie klienta byłoby pozorem bezpieczeństwa,
 * bo każdy może je ominąć. Zakres wymuszają polityki `notes_*_own` w bazie.
 * `user_id` przy zapisie uzupełnia domyślna wartość kolumny `auth.uid()`.
 */
export function useNotes(userId: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setNotes(listDemoNotes(userId))
      setLoading(false)
      return
    }

    const { data, error: queryError } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (queryError) setError(queryError.message)
    else setNotes(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addNote = useCallback(
    async (title: string, body: string): Promise<string | null> => {
      if (!supabase) {
        createDemoNote(userId, title, body)
        setNotes(listDemoNotes(userId))
        return null
      }

      const { error: insertError } = await supabase.from('notes').insert({ title, body })
      if (insertError) return insertError.message
      await refresh()
      return null
    },
    [refresh, userId],
  )

  const removeNote = useCallback(
    async (id: string): Promise<string | null> => {
      if (!supabase) {
        deleteDemoNote(userId, id)
        setNotes(listDemoNotes(userId))
        return null
      }

      const { error: deleteError } = await supabase.from('notes').delete().eq('id', id)
      if (deleteError) return deleteError.message
      await refresh()
      return null
    },
    [refresh, userId],
  )

  return { notes, loading, error, addNote, removeNote }
}
