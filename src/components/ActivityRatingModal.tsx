import { useState } from 'react'
import type { Activity } from '../types/trip'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface ActivityRatingModalProps {
  activity: Activity
  onSubmit: (patch: { rating?: string; comment?: string; done: boolean; favorite: boolean }) => Promise<void>
  onClose: () => void
}

export default function ActivityRatingModal({ activity, onSubmit, onClose }: ActivityRatingModalProps) {
  const [done, setDone] = useState(activity.done ?? false)
  const [rating, setRating] = useState(activity.rating ?? '')
  const [comment, setComment] = useState(activity.comment ?? '')
  const [favorite, setFavorite] = useState(activity.favorite ?? false)
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    try {
      await onSubmit({ rating: rating || undefined, comment: comment.trim() || undefined, done, favorite })
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
      title={`Noter — ${activity.name}`}
      onSubmit={handleSubmit}
      onClose={onClose}
      error={error}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="primary" block type="submit" loading={submitting} loadingLabel="Enregistrement…">
            Enregistrer
          </Button>
        </>
      }
    >
      <label className="activity-rating-modal__done-row">
        <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
        Fait
      </label>

      <label className="activity-rating-modal__emoji-field">
        Note (emoji)
        <div className="activity-rating-modal__emoji-input-row">
          <input
            type="text"
            inputMode="text"
            className="activity-rating-modal__emoji-input"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="🙂"
            maxLength={8}
          />
          {rating && (
            <Button variant="ghost" size="sm" onClick={() => setRating('')}>
              Effacer
            </Button>
          )}
          <label className="activity-rating-modal__done-row activity-rating-modal__favorite-inline">
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
            Coup de cœur ❤️
          </label>
        </div>
        <span className="activity-rating-modal__emoji-hint">Ouvre le clavier emoji de ton téléphone pour choisir.</span>
      </label>

      <Field label="Commentaire">
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="Un souvenir, un avis…" />
      </Field>
    </Sheet>
  )
}
