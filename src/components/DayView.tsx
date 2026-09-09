import { useState } from 'react'
import type { Activity, Trip } from '../types/trip'
import type { DatabaseStatus } from '../hooks/useDatabase'
import { buildDayPlans } from '../utils/dayPlan'
import DayCard from './DayCard'
import ActivityPickerModal from './ActivityPickerModal'
import ActivityRatingModal from './ActivityRatingModal'
import TimePickerModal from './TimePickerModal'

interface DayViewProps {
  trip: Trip
  onSelectStage: (stageId: string) => void
  activitiesStatus: DatabaseStatus
  onUpdateActivity: (id: string, patch: Partial<Omit<Activity, 'id'>>) => Promise<void>
}

export default function DayView({ trip, onSelectStage, activitiesStatus, onUpdateActivity }: DayViewProps) {
  const days = buildDayPlans(trip)
  const today = new Date().toISOString().slice(0, 10)
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [ratingActivity, setRatingActivity] = useState<Activity | null>(null)
  const [timeActivity, setTimeActivity] = useState<Activity | null>(null)

  async function handleUnassign(activity: Activity) {
    try {
      await onUpdateActivity(activity.id, { date: undefined })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleToggleWishlist(activity: Activity) {
    try {
      await onUpdateActivity(activity.id, { wishlist: !activity.wishlist })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }


  return (
    <div className="day-view">
      {days.map((day) => (
        <DayCard
          key={day.date}
          day={day}
          isToday={day.date === today}
          onSelect={onSelectStage}
          activitiesReady={activitiesStatus === 'ready'}
          onAssignActivity={setPickerDate}
          onUnassignActivity={handleUnassign}
          onRateActivity={setRatingActivity}
          onToggleWishlistActivity={handleToggleWishlist}
          onSetTimeActivity={setTimeActivity}
          wishlistLabel={trip.wishlistStampLabel}
        />
      ))}

      {pickerDate && (
        <ActivityPickerModal
          activities={trip.activities ?? []}
          date={pickerDate}
          onSelect={(activity) => onUpdateActivity(activity.id, { date: pickerDate })}
          onClose={() => setPickerDate(null)}
        />
      )}

      {ratingActivity && (
        <ActivityRatingModal
          activity={ratingActivity}
          onSubmit={(patch) => onUpdateActivity(ratingActivity.id, patch)}
          onClose={() => setRatingActivity(null)}
        />
      )}

      {timeActivity && (
        <TimePickerModal
          activity={timeActivity}
          onSelect={(patch) => onUpdateActivity(timeActivity.id, patch)}
          onClose={() => setTimeActivity(null)}
        />
      )}
    </div>
  )
}
