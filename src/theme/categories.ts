import type { ActivityCategory, TransportMode } from '../types/trip'

export type ResolvedTheme = 'light' | 'dark'

// Labels d'affichage des catégories — déplacés depuis ActivityCard.tsx pour que
// ce fichier soit la seule source de vérité pour tout ce qui concerne les
// catégories (labels + couleurs), lue à la fois par les composants React et
// par MapView (MapLibre a besoin de littéraux synchrones au moment d'addLayer,
// donc les couleurs vivent ici en TS plutôt que d'être lues depuis le CSS).
export const categoryLabels: Record<ActivityCategory, string> = {
  restaurant: 'Restaurant',
  museum: 'Musée',
  shop: 'Magasin',
  point_of_interest: "Lieu d'intérêt",
  hike: 'Randonnée',
  cycling: 'Vélo',
}

export const ALL_CATEGORIES = Object.keys(categoryLabels) as ActivityCategory[]

export const CATEGORY_COLORS: Record<ActivityCategory, Record<ResolvedTheme, string>> = {
  restaurant: { light: '#C8442E', dark: '#E4674D' },
  museum: { light: '#6B4E8F', dark: '#A98CCB' },
  shop: { light: '#2A4A7B', dark: '#7FA3D8' },
  point_of_interest: { light: '#3F7A56', dark: '#79AE8C' },
  hike: { light: '#1F6F73', dark: '#63ADB1' },
  cycling: { light: '#A6417A', dark: '#D57FAE' },
}

export const TRANSPORT_COLORS: Record<TransportMode, Record<ResolvedTheme, string>> = {
  shinkansen: { light: '#C8442E', dark: '#E4674D' },
  train: { light: '#3F7A56', dark: '#79AE8C' },
  bus: { light: '#2A4A7B', dark: '#7FA3D8' },
  plane: { light: '#6B4E8F', dark: '#A98CCB' },
  ferry: { light: '#1F6F73', dark: '#63ADB1' },
}

// Sentiers de rando sur la carte (MapView.tsx) — même valeurs que --trail
// dans theme/tokens.css. Dupliqué en littéral ici (pas lu depuis le CSS) pour
// la même raison que CATEGORY_COLORS/TRANSPORT_COLORS : MapLibre a besoin
// d'une chaîne hex synchrone au moment d'addLayer/setPaintProperty.
export const TRAIL_COLOR: Record<ResolvedTheme, string> = {
  light: '#8A5A1E',
  dark: '#C08A3E',
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Écrit --cat-*, --cat-*-wash, --transport-* sur `root` pour le thème résolu.
 * Les marqueurs MapLibre (MapView.tsx) lisent --cat-* et --transport-* via
 * `var(--cat-${category})` posé en style inline ; <Chip> lit --cat-*-wash
 * pour la teinte de fond plutôt que color-mix() (support WebView incertain).
 * Ces variables vivent sur <html>, donc marqueurs et chips se recolorent
 * automatiquement au changement de thème sans code supplémentaire.
 */
export function writeColorVars(root: HTMLElement, theme: ResolvedTheme) {
  const washAlpha = theme === 'light' ? 0.14 : 0.18
  for (const key of Object.keys(CATEGORY_COLORS) as ActivityCategory[]) {
    const color = CATEGORY_COLORS[key][theme]
    root.style.setProperty(`--cat-${key}`, color)
    root.style.setProperty(`--cat-${key}-wash`, hexToRgba(color, washAlpha))
  }
  for (const key of Object.keys(TRANSPORT_COLORS) as TransportMode[]) {
    root.style.setProperty(`--transport-${key}`, TRANSPORT_COLORS[key][theme])
  }
}
