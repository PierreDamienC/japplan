import { useState } from 'react'
import type { Accommodation } from '../types/trip'
import CoordinatesField from './CoordinatesField'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface AccommodationFormModalProps {
  mode: 'create' | 'edit'
  accommodation?: Accommodation
  onSubmit: (input: Omit<Accommodation, 'id'>) => Promise<void>
  onClose: () => void
}

export default function AccommodationFormModal({ mode, accommodation, onSubmit, onClose }: AccommodationFormModalProps) {
  const [name, setName] = useState(accommodation?.name ?? '')
  const [checkIn, setCheckIn] = useState(accommodation?.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(accommodation?.checkOut ?? '')
  const [bookingLink, setBookingLink] = useState(accommodation?.bookingLink ?? '')
  const [notes, setNotes] = useState(accommodation?.notes ?? '')
  const [lat, setLat] = useState(accommodation?.coordinates ? String(accommodation.coordinates.lat) : '')
  const [lng, setLng] = useState(accommodation?.coordinates ? String(accommodation.coordinates.lng) : '')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!name.trim()) return setError('Le nom est obligatoire.')
    if (!checkIn || !checkOut) return setError("Dates d'arrivée et de départ obligatoires.")
    if (checkOut < checkIn) return setError('La date de départ doit être après la date d\'arrivée.')
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
        checkIn,
        checkOut,
        bookingLink: bookingLink.trim() || undefined,
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
      title={mode === 'create' ? 'Ajouter un hébergement' : "Modifier l'hébergement"}
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

      <div className="field-row">
        <Field label="Arrivée">
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        </Field>
        <Field label="Départ">
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
        </Field>
      </div>

      <Field label="Lien de réservation">
        <input type="url" value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} />
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
