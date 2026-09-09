import { useState } from 'react'
import type { Excursion, TransportMode } from '../types/trip'
import { TRANSPORT_MODES, transportModeLabels } from '../utils/transportMode'
import CoordinatesField from './CoordinatesField'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface ExcursionFormModalProps {
  mode: 'create' | 'edit'
  excursion?: Excursion
  onSubmit: (input: Omit<Excursion, 'id'>) => Promise<void>
  onClose: () => void
}

export default function ExcursionFormModal({ mode, excursion, onSubmit, onClose }: ExcursionFormModalProps) {
  const [name, setName] = useState(excursion?.name ?? '')
  const [date, setDate] = useState(excursion?.date ?? '')
  const [transportMode, setTransportMode] = useState<TransportMode | ''>(excursion?.mode ?? '')
  const [notes, setNotes] = useState(excursion?.notes ?? '')
  const [lat, setLat] = useState(excursion?.coordinates ? String(excursion.coordinates.lat) : '')
  const [lng, setLng] = useState(excursion?.coordinates ? String(excursion.coordinates.lng) : '')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!name.trim()) return setError('Le nom est obligatoire.')
    if (!date) return setError('La date est obligatoire.')
    if ((lat.trim() === '') !== (lng.trim() === '')) {
      return setError('Renseigne latitude ET longitude, ou aucune des deux.')
    }
    const parsedLat = lat.trim() ? Number(lat) : undefined
    const parsedLng = lng.trim() ? Number(lng) : undefined
    if ((parsedLat !== undefined && Number.isNaN(parsedLat)) || (parsedLng !== undefined && Number.isNaN(parsedLng))) {
      return setError('Coordonnées invalides.')
    }

    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        date,
        mode: transportMode || undefined,
        notes: notes.trim() || undefined,
        coordinates: parsedLat !== undefined && parsedLng !== undefined ? { lat: parsedLat, lng: parsedLng } : undefined,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      as="form"
      title={mode === 'create' ? 'Ajouter une excursion' : "Modifier l'excursion"}
      onSubmit={handleSubmit}
      onClose={onClose}
      error={error}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="primary" block type="submit" loading={submitting} loadingLabel="Enregistrement…">
            {mode === 'create' ? 'Ajouter' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <Field label="Nom">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>

      <Field label="Mode de transport">
        <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode | '')}>
          <option value="">— aucun —</option>
          {TRANSPORT_MODES.map((m) => (
            <option key={m} value={m}>
              {transportModeLabels[m]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>

      <CoordinatesField
        legend="Position"
        lat={lat}
        lng={lng}
        onChange={(newLat, newLng) => {
          setLat(newLat)
          setLng(newLng)
        }}
      />
    </Sheet>
  )
}
