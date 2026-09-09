export type IconName =
  | 'edit'
  | 'trash'
  | 'settings'
  | 'plus'
  | 'arrow-up'
  | 'arrow-down'
  | 'close'
  | 'calendar'
  | 'check'
  | 'note'
  | 'comment'
  | 'flag'
  | 'external'
  | 'search'
  | 'filter'
  | 'bed'
  | 'route'
  | 'heart'
  | 'alert'
  | 'clock'

// Contenu interne de chaque icône (sans le <svg> englobant) — partagé entre
// <Icon> (React) et iconHtml() (chaîne, pour les popups MapLibre construits
// en template strings dans MapView.tsx, où aucun rendu React n'a lieu).
// Trait fin (1.6) et 0 remplissage : cohérent avec la direction "filets, pas
// d'ombres". viewBox 0 0 24 24 partout.
export const ICON_INNER: Record<IconName, string> = {
  edit: '<path d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3Z"/><path d="M13.5 6.5l4 4"/>',
  trash:
    '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  'arrow-down': '<path d="M12 5v14M5 12l7 7 7-7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  note: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  comment: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
  flag: '<path d="M6 3v18"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M9 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4.35-4.35"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z"/>',
  bed: '<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 15h18"/><path d="M7 11V8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3"/><path d="M3 18v2M21 18v2"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 17c4-1 4-4 8-5"/>',
  heart: '<path d="M12 20.5S3.5 14.9 3.5 8.8A4.3 4.3 0 0 1 12 6.7a4.3 4.3 0 0 1 8.5 2.1c0 6.1-8.5 11.7-8.5 11.7Z"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
}

/** Icône rendue en chaîne HTML — pour les popups MapLibre (template strings, MapView.tsx). */
export function iconHtml(name: IconName, size = 14): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_INNER[name]}</svg>`
}
