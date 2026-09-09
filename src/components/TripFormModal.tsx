import { useState } from 'react'
import { DEFAULT_WISHLIST_STAMP_LABEL, type Trip } from '../types/trip'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface TripFormModalProps {
  mode: 'create' | 'edit'
  trip?: Trip
  onSubmit: (input: { name: string; wishlistStampLabel?: string }) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

function countActivities(trip: Trip): number {
  return trip.activities?.length ?? 0
}

export default function TripFormModal({ mode, trip, onSubmit, onDelete, onClose }: TripFormModalProps) {
  const [name, setName] = useState(trip?.name ?? '')
  const [wishlistStampLabel, setWishlistStampLabel] = useState(trip?.wishlistStampLabel ?? '')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    if (!name.trim()) return setError('Le nom est obligatoire.')

    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), wishlistStampLabel: wishlistStampLabel.trim() || undefined })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!trip || !onDelete) return
    const activityCount = countActivities(trip)
    const detail = `${trip.stages.length} étape${trip.stages.length !== 1 ? 's' : ''} et ${activityCount} activité${activityCount !== 1 ? 's' : ''}`
    if (!window.confirm(`Supprimer le voyage « ${trip.name} » ? Cela supprime aussi ${detail}. Cette action est irréversible.`)) {
      return
    }
    setSubmitting(true)
    try {
      await onDelete()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      as="form"
      title={mode === 'create' ? 'Nouveau voyage' : 'Modifier le voyage'}
      onSubmit={handleSubmit}
      onClose={onClose}
      error={error}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="primary" block type="submit" loading={submitting} loadingLabel="Enregistrement…">
            {mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <Field label="Nom">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="Texte du tampon « envie de faire »">
        <input
          type="text"
          value={wishlistStampLabel}
          onChange={(e) => setWishlistStampLabel(e.target.value)}
          placeholder={DEFAULT_WISHLIST_STAMP_LABEL}
        />
      </Field>

      {mode === 'edit' && onDelete && (
        <Button variant="danger" icon="trash" block onClick={handleDelete} disabled={submitting}>
          Supprimer ce voyage
        </Button>
      )}
    </Sheet>
  )
}
