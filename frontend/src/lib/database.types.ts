/**
 * Odwzorowanie schematu z `backend/supabase/migrations/0001_init.sql`.
 *
 * Docelowo plik powinien być generowany, a nie pisany ręcznie:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Publisher = 'DU' | 'MP'

export type LegalAct = {
  eli: string
  publisher: Publisher
  year: number
  position: number
  display_address: string
  act_type: string
  title: string
  issuing_body: string
  announcement_date: string | null
  promulgation_date: string | null
  change_date: string | null
  status: string | null
  has_pdf: boolean
  pdf_url: string | null
  fetched_at: string
}

export type Note = {
  id: string
  user_id: string
  act_eli: string | null
  title: string
  body: string
  created_at: string
  updated_at: string
}

export type NoteInsert = {
  title: string
  body?: string
  act_eli?: string | null
}

export type Database = {
  public: {
    Tables: {
      legal_acts: {
        Row: LegalAct
        Insert: Omit<LegalAct, 'fetched_at'>
        Update: Partial<Omit<LegalAct, 'eli'>>
        Relationships: []
      }
      notes: {
        Row: Note
        Insert: NoteInsert & { user_id?: string }
        Update: Partial<NoteInsert>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
