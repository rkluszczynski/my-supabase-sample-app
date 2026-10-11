import { useId, useState, type FormEvent } from 'react'
import { useNotes } from '../hooks/useNotes'
import { formatDate } from '../lib/format'
import type { SessionUser } from '../lib/demoStore'

type NotesPageProps = {
  user: SessionUser
}

export function NotesPage({ user }: NotesPageProps) {
  const titleId = useId()
  const bodyId = useId()

  const { notes, loading, error, addNote, removeNote } = useNotes(user.id)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setFormError('Notatka musi mieć tytuł.')
      return
    }

    setFormError(null)
    setPending(true)
    const message = await addNote(trimmed, body.trim())
    setPending(false)

    if (message) {
      setFormError(message)
      return
    }
    setTitle('')
    setBody('')
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-stripe-900">Notatki</h1>
        <p className="mt-2 text-stripe-700/70">
          Visible only to you — the{' '}
          <code className="rounded bg-tiger-100 px-1 text-tiger-800">s2app_notes_*_own</code> policies
          ensure that another user gets an empty result instead of a permission error.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-2xl border border-tiger-200 bg-white p-6 shadow-sm shadow-tiger-900/5"
      >
        <div className="space-y-2">
          <label htmlFor={titleId} className="block text-xs font-semibold tracking-wider text-stripe-700/80 uppercase">
            Tytuł
          </label>
          <input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="np. Zabierzów — sprawdzić wadium"
            className="w-full rounded-xl border border-tiger-300 bg-tiger-50/60 px-4 py-3 text-stripe-900 placeholder:text-stripe-700/35 focus:border-tiger-500 focus:bg-white focus:ring-2 focus:ring-tiger-400/40 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={bodyId} className="block text-xs font-semibold tracking-wider text-stripe-700/80 uppercase">
            Treść
          </label>
          <textarea
            id={bodyId}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Co trzeba zweryfikować przed decyzją Go/No-Go?"
            className="w-full resize-y rounded-xl border border-tiger-300 bg-tiger-50/60 px-4 py-3 text-stripe-900 placeholder:text-stripe-700/35 focus:border-tiger-500 focus:bg-white focus:ring-2 focus:ring-tiger-400/40 focus:outline-none"
          />
        </div>

        {formError && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-tiger-400 via-tiger-500 to-tiger-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-tiger-600/30 transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-tiger-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Zapisuję…' : 'Dodaj notatkę'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-stripe-700/60">Ładowanie notatek…</p>
      ) : notes.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-tiger-300 bg-tiger-50/50 p-8 text-center text-stripe-700/60">
          Nie masz jeszcze żadnej notatki.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-2xl border border-tiger-200 bg-white p-5 shadow-sm shadow-tiger-900/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-stripe-900">{note.title}</h2>
                  {note.body && (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-stripe-700/80">{note.body}</p>
                  )}
                  <p className="mt-2 text-xs text-stripe-700/50">{formatDate(note.created_at)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => void removeNote(note.id)}
                  className="rounded-lg border border-tiger-300 px-3 py-1.5 text-xs font-semibold text-stripe-700/70 transition hover:border-red-400 hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
                  aria-label={`Usuń notatkę ${note.title}`}
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
