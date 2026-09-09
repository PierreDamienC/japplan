import { useEffect, useState } from 'react'
import { isUnresolvableMapsLink, parseLocationInput, searchPlaces, type NominatimResult } from '../utils/nominatimSearch'
import Field from './ui/Field'
import Button from './ui/Button'

interface CoordinatesFieldProps {
  legend: string
  lat: string
  lng: string
  onChange: (lat: string, lng: string) => void
}

export default function CoordinatesField({ legend, lat, lng, onChange }: CoordinatesFieldProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string>()
  const [showPasteFallback, setShowPasteFallback] = useState(false)
  const [pastedUrl, setPastedUrl] = useState('')
  const [pasteError, setPasteError] = useState<string>()

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([])
      setSearchError(undefined)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError(undefined)
      try {
        const found = await searchPlaces(query.trim(), controller.signal)
        setResults(found)
        if (found.length === 0) setSearchError('Aucun résultat.')
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setSearchError('Recherche indisponible.')
        }
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function selectResult(result: NominatimResult) {
    onChange(String(result.lat), String(result.lng))
    setQuery('')
    setResults([])
  }

  function handlePaste(value: string) {
    setPastedUrl(value)
    const parsed = parseLocationInput(value)
    if (parsed) {
      onChange(String(parsed.lat), String(parsed.lng))
      setPasteError(undefined)
    } else if (!value.trim()) {
      setPasteError(undefined)
    } else if (isUnresolvableMapsLink(value)) {
      setPasteError(
        'Ce lien (partagé depuis l\'appli Maps) ne contient pas de coordonnées. Dans Maps : appui long sur le lieu pour poser un repère, puis appui sur les coordonnées affichées en bas de l\'écran pour les copier, et colle-les ici.',
      )
    } else {
      setPasteError('Coordonnées introuvables — colle un lien Maps déjà ouvert (avec le pin centré) ou des coordonnées copiées (ex. "35.0172, 135.6852").')
    }
  }

  return (
    <div className="coordinates-field">
      <Field label={`${legend} — rechercher un lieu`}>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom du lieu…" />
      </Field>
      {searching && <p className="coordinates-field__hint">Recherche…</p>}
      {searchError && !searching && <p className="coordinates-field__hint">{searchError}</p>}
      {results.length > 0 && (
        <ul className="coordinates-field__results">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => selectResult(r)}>
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showPasteFallback ? (
        <Button variant="link" size="sm" onClick={() => setShowPasteFallback(true)}>
          Lieu introuvable ? Coller des coordonnées ou un lien Maps
        </Button>
      ) : (
        <Field label="Coordonnées copiées, ou lien Maps déjà ouvert (avec le pin centré)">
          <input type="text" value={pastedUrl} onChange={(e) => handlePaste(e.target.value)} placeholder="35.0172, 135.6852" />
        </Field>
      )}
      {pasteError && <p className="coordinates-field__hint coordinates-field__hint--error">{pasteError}</p>}

      <div className="field-row">
        <Field label="Latitude">
          <input type="text" inputMode="decimal" value={lat} onChange={(e) => onChange(e.target.value, lng)} />
        </Field>
        <Field label="Longitude">
          <input type="text" inputMode="decimal" value={lng} onChange={(e) => onChange(lat, e.target.value)} />
        </Field>
      </div>
    </div>
  )
}
