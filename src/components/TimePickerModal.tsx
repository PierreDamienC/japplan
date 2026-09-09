import { useState } from 'react'
import type { Activity } from '../types/trip'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface TimePatch {
  time: string | undefined
  endTime: string | undefined
}

interface TimePickerModalProps {
  activity: Activity
  onSelect: (patch: TimePatch) => Promise<void>
  onClose: () => void
}

export default function TimePickerModal({ activity, onSelect, onClose }: TimePickerModalProps) {
  const [time, setTime] = useState(activity.time ?? '')
  const [endTime, setEndTime] = useState(activity.endTime ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSave(patch: TimePatch) {
    setError(undefined)
    if (patch.endTime && !patch.time) {
      setError('Une heure de fin nécessite une heure de début.')
      return
    }
    if (patch.endTime && patch.time && patch.endTime <= patch.time) {
      setError("L'heure de fin doit être après l'heure de début.")
      return
    }
    setSubmitting(true)
    try {
      await onSelect(patch)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      as="form"
      title={`Heure de « ${activity.name} »`}
      onSubmit={(e) => {
        e.preventDefault()
        handleSave({ time: time || undefined, endTime: endTime || undefined })
      }}
      onClose={onClose}
      error={error}
      footer={
        <>
          {(activity.time || activity.endTime) && (
            <Button
              variant="secondary"
              block
              onClick={() => handleSave({ time: undefined, endTime: undefined })}
              disabled={submitting}
            >
              Retirer l'heure
            </Button>
          )}
          <Button variant="primary" block type="submit" loading={submitting} loadingLabel="Enregistrement…">
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Heure de début">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label="Heure de fin (optionnelle)" hint="Pour bloquer un créneau sur la frise plutôt qu'un simple point.">
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </Field>
    </Sheet>
  )
}
