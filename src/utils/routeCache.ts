import type { TransportLeg } from '../types/trip'

// Les trajets terrestres (shinkansen/train/bus) sont résolus via l'API OSRM
// publique — coûteux à rappeler à chaque montage de MapView (démonté/remonté
// à chaque changement d'onglet, voir CLAUDE.md). Les coordonnées d'un trajet
// changent rarement une fois saisies, donc la clé (mode + coordonnées) sert
// aussi de cache-buster naturel : plus besoin d'invalider explicitement.
function cacheKey(leg: TransportLeg): string {
  const { mode, fromCoordinates: f, toCoordinates: t } = leg
  return `route:${mode}:${f.lng.toFixed(6)},${f.lat.toFixed(6)}:${t.lng.toFixed(6)},${t.lat.toFixed(6)}`
}

export function getCachedRoute(leg: TransportLeg): [number, number][] | null {
  try {
    const raw = localStorage.getItem(cacheKey(leg))
    return raw ? (JSON.parse(raw) as [number, number][]) : null
  } catch {
    return null
  }
}

export function setCachedRoute(leg: TransportLeg, coordinates: [number, number][]): void {
  try {
    localStorage.setItem(cacheKey(leg), JSON.stringify(coordinates))
  } catch {
    // Quota dépassé ou stockage indisponible — dégradation silencieuse, le
    // trajet sera simplement re-résolu au prochain montage.
  }
}
