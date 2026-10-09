const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

export function formatDate(value: string | null): string {
  return value === null ? '—' : dateFormatter.format(new Date(value))
}

/** Dz.U. i M.P. mają w listingu własną ikonę, żeby dało się je odróżnić jednym spojrzeniem. */
export function publisherBadge(publisher: 'DU' | 'MP'): { icon: string; label: string } {
  return publisher === 'DU'
    ? { icon: '📄', label: 'Dz.U.' }
    : { icon: '📜', label: 'M.P.' }
}
