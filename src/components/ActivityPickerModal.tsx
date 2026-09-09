import { useMemo, useState } from 'react'
import type { Activity } from '../types/trip'
import { categoryLabels } from '../theme/categories'
import { formatDayLabel } from '../utils/formatDate'
import Sheet from './ui/Sheet'
import Button from './ui/Button'
import Chip from './ui/Chip'

interface ActivityPickerModalProps {
  activities: Activity[]
  date: string
  onSelect: (activity: Activity) => Promise<void>
  onClose: () => void
}

export default function ActivityPickerModal({ activities, date, onSelect, onClose }: ActivityPickerModalProps) {
  const [search, setSearch] = useState('')
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string>()

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return activities
    return activities.filter((a) => a.name.toLowerCase().includes(query))
  }, [activities, search])

  async function handlePick(activity: Activity) {
    setError(undefined)
    setSubmittingId(activity.id)
    try {
      await onSelect(activity)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmittingId(null)
    }
  }

  return (
    <Sheet
      title={`Assigner une activité — ${formatDayLabel(date)}`}
      onClose={onClose}
      error={error}
      tall
      footer={
        <Button variant="secondary" block onClick={onClose} disabled={submittingId !== null}>
          Annuler
        </Button>
      }
    >
      <input
        type="search"
        className="activity-picker-modal__search"
        placeholder="Rechercher une activité…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="activity-picker-modal__list">
        {filtered.length === 0 && <p className="activities__empty">Aucune activité trouvée.</p>}
        {filtered.map((activity) => (
          <button
            key={activity.id}
            type="button"
            className="activity-picker-modal__row"
            onClick={() => handlePick(activity)}
            disabled={submittingId !== null}
          >
            <span className="activity-picker-modal__name">{activity.name}</span>
            <Chip as="span" tone="category" category={activity.category} active>
              {categoryLabels[activity.category]}
            </Chip>
            {activity.date && activity.date !== date && (
              <span className="activity-picker-modal__current">Déjà le {formatDayLabel(activity.date)}</span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
