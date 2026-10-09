import type { LegalAct, Note } from './database.types'

/**
 * Magazyn trybu demonstracyjnego — używany wyłącznie wtedy, gdy nie podano
 * zmiennych środowiskowych Supabase. Odwzorowuje te same reguły dostępu,
 * które w prawdziwej bazie wymusza RLS:
 *   - listing aktów prawnych jest wspólny,
 *   - notatki są filtrowane po `user_id`.
 */

export type SessionUser = {
  id: string
  email: string
}

const SESSION_KEY = 'legal-acts-demo-session'
const NOTES_KEY = 'legal-acts-demo-notes'

// --- sesja ------------------------------------------------------------------

export function readDemoSession(): SessionUser | null {
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    window.localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function writeDemoSession(user: SessionUser): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearDemoSession(): void {
  window.localStorage.removeItem(SESSION_KEY)
}

/** Identyfikator wyprowadzony z adresu e-mail — dwóch „użytkowników" demo się nie zobaczy. */
export function demoUserId(email: string): string {
  return `demo:${email.toLowerCase()}`
}

// --- listing aktów prawnych (wspólny) ---------------------------------------

const ELI_API = 'https://api.sejm.gov.pl/eli'

function act(
  publisher: 'DU' | 'MP',
  position: number,
  actType: string,
  issuingBody: string,
  title: string,
  promulgation: string,
): LegalAct {
  const year = 2026
  return {
    eli: `${publisher}/${year}/${position}`,
    publisher,
    year,
    position,
    display_address: `${publisher === 'DU' ? 'Dz.U.' : 'M.P.'} ${year} poz. ${position}`,
    act_type: actType,
    title,
    issuing_body: issuingBody,
    announcement_date: promulgation,
    promulgation_date: promulgation,
    change_date: null,
    status: 'obowiązujący',
    has_pdf: true,
    pdf_url: `${ELI_API}/acts/${publisher}/${year}/${position}/text.pdf`,
    fetched_at: promulgation,
  }
}

/** Próbka odpowiadająca kształtem danym z API ELI — do podglądu bez Supabase. */
export const DEMO_LEGAL_ACTS: LegalAct[] = [
  act('DU', 1306, 'Obwieszczenie', 'MARSZAŁEK SEJMU',
    'Obwieszczenie Marszałka Sejmu Rzeczypospolitej Polskiej z dnia 2 października 2026 r. w sprawie ogłoszenia jednolitego tekstu ustawy o ochronie i pomocy dla pokrzywdzonego i świadka',
    '2026-10-08'),
  act('DU', 1303, 'Rozporządzenie', 'MIN. ROLNICTWA I ROZWOJU WSI',
    'Rozporządzenie Ministra Rolnictwa i Rozwoju Wsi z dnia 2 października 2026 r. zmieniające rozporządzenie w sprawie szczegółowych warunków przyznawania pomocy finansowej',
    '2026-10-07'),
  act('DU', 1289, 'Rozporządzenie', 'MIN. FINANSÓW I GOSPODARKI',
    'Rozporządzenie Ministra Finansów i Gospodarki z dnia 2 października 2026 r. w sprawie sposobu prowadzenia ewidencji oraz zakresu danych przekazywanych organom podatkowym',
    '2026-10-06'),
  act('MP', 984, 'Obwieszczenie', 'MIN. SPRAWIEDLIWOŚCI',
    'Obwieszczenie Ministra Sprawiedliwości z dnia 5 października 2026 r. o wolnych stanowiskach sędziowskich',
    '2026-10-08'),
  act('MP', 981, 'Uchwała', 'PAŃSTWOWA KOMISJA WYBORCZA',
    'Uchwała nr 141/2026 Państwowej Komisji Wyborczej z dnia 5 października 2026 r. w sprawie ustanowienia programu szkoleń dla członków komisji',
    '2026-10-07'),
  act('MP', 978, 'Obwieszczenie', 'MIN. ENERGII',
    'Obwieszczenie Ministra Energii z dnia 7 października 2026 r. w sprawie wskaźnika referencyjnego kosztów wytwarzania energii',
    '2026-10-06'),
]

// --- notatki (prywatne) ------------------------------------------------------

function readAllNotes(): Note[] {
  const raw = window.localStorage.getItem(NOTES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Note[]
  } catch {
    window.localStorage.removeItem(NOTES_KEY)
    return []
  }
}

function writeAllNotes(notes: Note[]): void {
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

/** Odpowiednik polityki `notes_select_own`. */
export function listDemoNotes(userId: string): Note[] {
  return readAllNotes()
    .filter((note) => note.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function createDemoNote(userId: string, title: string, body: string): Note {
  const now = new Date().toISOString()
  const note: Note = {
    id: crypto.randomUUID(),
    user_id: userId,
    act_eli: null,
    title,
    body,
    created_at: now,
    updated_at: now,
  }
  writeAllNotes([...readAllNotes(), note])
  return note
}

/** Odpowiednik polityki `notes_delete_own` — cudzego wiersza nie usunie. */
export function deleteDemoNote(userId: string, id: string): void {
  writeAllNotes(readAllNotes().filter((note) => !(note.id === id && note.user_id === userId)))
}
