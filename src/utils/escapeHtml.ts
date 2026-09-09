// Les popups MapLibre sont construits en chaînes HTML (MapView.tsx) : pas de
// rendu React, donc pas d'échappement automatique. Ça n'est pas qu'une question
// de nos propres données — le libellé d'adresse affiché à l'appui long vient de
// Nominatim, donc d'OpenStreetMap, une base publiquement éditable.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

// Pour une URL qui atterrit dans un href : ne laisse passer que http/https, afin
// qu'un `javascript:` stocké dans un champ (Activity.mapsUrl, saisi en app ou
// importé d'un CSV) ne devienne pas exécutable au clic. null = lien à neutraliser.
export function safeUrl(url: string): string | null {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
