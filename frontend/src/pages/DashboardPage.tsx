import { useState } from 'react'
import { useLegalActs } from '../hooks/useLegalActs'
import { formatDate, publisherBadge } from '../lib/format'
import type { Publisher } from '../lib/database.types'

const FILTERS: { value: Publisher | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Wszystkie' },
  { value: 'DU', label: '📄 Dziennik Ustaw' },
  { value: 'MP', label: '📜 Monitor Polski' },
]

export function DashboardPage() {
  const [publisher, setPublisher] = useState<Publisher | 'ALL'>('ALL')
  const { acts, loading, error } = useLegalActs(publisher)

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-stripe-900">Akty Prawne</h1>
        <p className="mt-2 text-stripe-700/70">
          Latest official records from the last two weeks. Data is fetched by the batch process{' '}
          <code className="rounded bg-tiger-100 px-1 text-tiger-800">legal-acts-ingest</code> from the ELI
          API.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-1 rounded-xl bg-tiger-100/80 p-1" role="tablist" aria-label="Filtr wydawcy">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={publisher === filter.value}
            onClick={() => setPublisher(filter.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-tiger-500 focus-visible:outline-none ${
              publisher === filter.value
                ? 'bg-tiger-500 text-white shadow-md shadow-tiger-600/30'
                : 'text-stripe-700/70 hover:text-tiger-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-stripe-700/60">Ładowanie listingu…</p>
      ) : acts.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-tiger-200 bg-white p-8 text-center text-stripe-700/60">
          Brak aktów prawnych w tym zakresie. Uruchom proces wsadowy:{' '}
          <code className="rounded bg-tiger-100 px-1 text-tiger-800">python -m legal_acts_ingest</code>
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-tiger-200 bg-white shadow-sm shadow-tiger-900/5">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Akty prawne opublikowane w Dzienniku Ustaw i Monitorze Polskim
              </caption>
              <thead>
                <tr className="border-b border-tiger-200 bg-tiger-50/70">
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wider text-stripe-700/70 uppercase">
                    Typ
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wider text-stripe-700/70 uppercase">
                    Pozycja
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wider text-stripe-700/70 uppercase">
                    Organ
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wider text-stripe-700/70 uppercase">
                    Tytuł aktu prawnego
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-stripe-700/70 uppercase">
                    Akcja
                  </th>
                </tr>
              </thead>

              <tbody>
                {acts.map((act) => {
                  const badge = publisherBadge(act.publisher)

                  return (
                    <tr key={act.eli} className="border-b border-tiger-100 last:border-0 hover:bg-tiger-50/50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-semibold text-stripe-900">
                          <span aria-hidden>{badge.icon}</span> {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-stripe-700">
                        Poz. {act.position}
                        <span className="block text-xs text-stripe-700/50">{act.year}</span>
                      </td>

                      <td className="max-w-[12rem] px-4 py-4 text-stripe-700">{act.issuing_body}</td>

                      <td className="max-w-xl px-4 py-4">
                        <span className="font-medium text-stripe-900">{act.title}</span>
                        <span className="mt-1 block text-xs text-stripe-700/50">
                          {act.act_type} · ogłoszono {formatDate(act.promulgation_date)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {act.pdf_url ? (
                          <a
                            href={act.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block rounded-lg border border-tiger-500 bg-white px-3 py-1.5 text-xs font-semibold text-tiger-700 transition hover:bg-tiger-500 hover:text-white focus-visible:ring-2 focus-visible:ring-tiger-600 focus-visible:outline-none"
                            aria-label={`Pobierz PDF: ${act.display_address}`}
                          >
                            Pobierz PDF
                          </a>
                        ) : (
                          <span className="text-xs text-stripe-700/40">brak PDF</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && acts.length > 0 && (
        <p className="mt-4 text-sm text-stripe-700/50">Razem: {acts.length}</p>
      )}
    </>
  )
}
