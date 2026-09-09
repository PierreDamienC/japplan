// Réimplémentation côté client de scripts/build-activities.mjs (slugify/uniqueId) —
// gardée séparée plutôt que partagée puisque l'une tourne en Node et l'autre dans le
// navigateur (même choix que normalize() dans ActivitiesView.tsx).
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function uniqueId(name: string, existingIds: Set<string>): string {
  const base = slugify(name) || 'activite'
  if (!existingIds.has(base)) return base
  let counter = 2
  while (existingIds.has(`${base}-${counter}`)) counter++
  return `${base}-${counter}`
}
