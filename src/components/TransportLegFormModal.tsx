import { useState } from 'react'
import type { TransportLeg, TransportMode } from '../types/trip'
import { TRANSPORT_MODES, transportModeLabels } from '../utils/transportMode'
import CoordinatesField from './CoordinatesField'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface TransportLegFormModalProps {
  mode: 'create' | 'edit'
  leg?: TransportLeg
  title: string
  onSubmit: (input: Omit<TransportLeg, 'id'>) => Promise<void>
  onClose: () => void
}

export default function TransportLegFormModal({ mode, leg, title, onSubmit, onClose }: TransportLegFormModalProps) {
  const [transportMode, setTransportMode] = useState<TransportMode>(leg?.mode ?? TRANSPORT_MODES[0])
  const [from, setFrom] = useState(leg?.from ?? '')
  const [to, setTo] = useState(leg?.to ?? '')
  const [fromLat, setFromLat] = useState(leg ? String(leg.fromCoordinates.lat) : '')
  const [fromLng, setFromLng] = useState(leg ? String(leg.fromCoordinates.lng) : '')
  const [toLat, setToLat] = useState(leg ? String(leg.toCoordinates.lat) : '')
  const [toLng, setToLng] = useState(leg ? String(leg.toCoordinates.lng) : '')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!from.trim() || !to.trim()) return setError('Départ et arrivée sont obligatoires.')
    const coords = [fromLat, fromLng, toLat, toLng].map((v) => Number(v.trim()))
    if (coords.some((v, i) => [fromLat, fromLng, toLat, toLng][i].trim() === '' || Number.isNaN(v))) {
      return setError('Les 4 coordonnées (départ + arrivée) sont obligatoires.')
    }

    setSubmitting(true)
    try {
      await onSubmit({
        mode: transportMode,
        from: from.trim(),
        to: to.trim(),
        fromCoordinates: { lat: coords[0], lng: coords[1] },
        toCoordinates: { lat: coords[2], lng: coords[3] },
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
      title={title}
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
      <Field label="Mode de transport">
        <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode)}>
          {TRANSPORT_MODES.map((m) => (
            <option key={m} value={m}>
              {transportModeLabels[m]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Départ">
        <input type="text" value={from} onChange={(e) => setFrom(e.target.value)} required />
      </Field>
      <CoordinatesField
        legend="Départ"
        lat={fromLat}
        lng={fromLng}
        onChange={(newLat, newLng) => {
          setFromLat(newLat)
          setFromLng(newLng)
        }}
      />

      <Field label="Arrivée">
        <input type="text" value={to} onChange={(e) => setTo(e.target.value)} required />
      </Field>
      <CoordinatesField
        legend="Arrivée"
        lat={toLat}
        lng={toLng}
        onChange={(newLat, newLng) => {
          setToLat(newLat)
          setToLng(newLng)
        }}
      />
    </Sheet>
  )
}
