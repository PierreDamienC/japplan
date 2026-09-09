// Dates ISO parsées en UTC pour éviter les décalages liés au fuseau local
// (même règle que buildDayPlans, voir dayPlan.ts / CLAUDE.md).
export function formatDayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`)
  const weekday = date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })
  const day = date.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: 'UTC' })
  const month = date.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })
  const label = `${weekday} ${day} ${month}`
  return label.charAt(0).toUpperCase() + label.slice(1)
}
