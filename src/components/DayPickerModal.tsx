import { useState } from 'react'
import type { Activity } from '../types/trip'
import { formatDayLabel } from '../utils/formatDate'
import Sheet from './ui/Sheet'
import Button from './ui/Button'

interface DayPickerModalProps {
  activity: Activity
  days: string[]
  onSelect: (date: string | undefined) => Promise<void>
  onClose: () => void
}

export default function DayPickerModal({ activity, days, onSelect, onClose }: DayPickerModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  async function handlePick(date: string | undefined) {
    setError(undefined)
    setSubmitting(true)
    try {
      await onSelect(date)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      title={`Planifier « ${activity.name} »`}
      onClose={onClose}
      error={error}
      footer={
        <Button variant="secondary" block onClick={onClose} disabled={submitting}>
          Annuler
        </Button>
      }
    >
      <div className="day-picker-modal__list">
        <button
          type="button"
          className={`day-picker-modal__option${!activity.date ? ' day-picker-modal__option--active' : ''}`}
          onClick={() => handlePick(undefined)}
          disabled={submitting}
        >
          Aucun jour
        </button>
        {days.map((date) => (
          <button
            key={date}
            type="button"
            className={`day-picker-modal__option${activity.date === date ? ' day-picker-modal__option--active' : ''}`}
            onClick={() => handlePick(date)}
            disabled={submitting}
          >
            {formatDayLabel(date)}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
