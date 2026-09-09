import { useState } from 'react'
import type { Stage } from '../types/trip'
import CoordinatesField from './CoordinatesField'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface StageFormModalProps {
  mode: 'create' | 'edit'
  stage?: Stage
  onSubmit: (input: { city: string; coordinates: { lat: number; lng: number } }) => Promise<void>
  onClose: () => void
}

export default function StageFormModal({ mode, stage, onSubmit, onClose }: StageFormModalProps) {
  const [city, setCity] = useState(stage?.city ?? '')
  const [lat, setLat] = useState(stage ? String(stage.coordinates.lat) : '')
  const [lng, setLng] = useState(stage ? String(stage.coordinates.lng) : '')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!city.trim()) return setError('La ville est obligatoire.')
    const parsedLat = Number(lat.trim())
    const parsedLng = Number(lng.trim())
    if (lat.trim() === '' || lng.trim() === '' || Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      return setError('Latitude et longitude sont obligatoires.')
    }

    setSubmitting(true)
    try {
      await onSubmit({ city: city.trim(), coordinates: { lat: parsedLat, lng: parsedLng } })
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
      title={mode === 'create' ? 'Ajouter une étape' : "Modifier l'étape"}
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
      <Field label="Ville">
        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
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
