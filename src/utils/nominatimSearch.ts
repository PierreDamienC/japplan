export interface NominatimResult {
  displayName: string
  lat: number
  lng: number
}

// Biases results toward Japan without excluding elsewhere (bounded=0) — most trips are Japan-based,
// but the app supports other destinations too.
const JAPAN_VIEWBOX = '122.5,45.7,146.5,24.0'

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<NominatimResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')
  url.searchParams.set('viewbox', JAPAN_VIEWBOX)
  url.searchParams.set('bounded', '0')

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Recherche indisponible.')
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>
  return data.map((d) => ({ displayName: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }))
}

// "!3d<lat>!4d<lng>" is the place's own pin coordinates embedded in a full Maps URL's data blob —
// more reliable than "@lat,lng" below, which is just the map viewport center and can drift from the pin.
const DATA_COORDS_RE = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/
// "@lat,lng,zoom" — present once a place's pin is centered in a resolved (non-short) Maps URL.
const AT_COORDS_RE = /@(-?\d+\.\d+),(-?\d+\.\d+)/
// Plain "lat, lng" as produced by Maps' own "copier les coordonnées" long-press action — anchored to
// the full trimmed input so it never false-matches a number pair embedded inside a URL.
const PLAIN_COORDS_RE = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/

export function parseLocationInput(value: string): { lat: number; lng: number } | null {
  const dataMatch = value.match(DATA_COORDS_RE)
  if (dataMatch) return { lat: Number(dataMatch[1]), lng: Number(dataMatch[2]) }

  const atMatch = value.match(AT_COORDS_RE)
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) }

  const plainMatch = value.trim().match(PLAIN_COORDS_RE)
  if (plainMatch) {
    const lat = Number(plainMatch[1])
    const lng = Number(plainMatch[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  }

  return null
}

// Google Maps app "Partager" links (maps.app.goo.gl, goo.gl/maps) and query_place_id links never
// contain coordinates in cleartext — resolving them needs a real navigation (client-side JS rewrite),
// which a client-side fetch can't do (blocked by CORS — see CLAUDE.md's geocoding-fallback pitfall).
export function isUnresolvableMapsLink(value: string): boolean {
  return /goo\.gl\//i.test(value) || /query_place_id=|place_id:/i.test(value)
}
