import type { CSSProperties } from 'react'
import type { DayPlan } from '../utils/dayPlan'
import type { Activity, TransportLeg } from '../types/trip'
import { formatDayLabel } from '../utils/formatDate'
import { transportModeLabels as transportLabels } from '../utils/transportMode'
import ActivityCard from './ActivityCard'
import DayAgenda from './DayAgenda'
import Button from './ui/Button'
import Chip from './ui/Chip'
import Icon from './ui/Icon'

function legColorStyle(leg: TransportLeg): CSSProperties {
  return { '--leg-color': `var(--transport-${leg.mode})` } as CSSProperties
}

interface DayCardProps {
  day: DayPlan
  isToday: boolean
  onSelect: (stageId: string) => void
  activitiesReady: boolean
  onAssignActivity: (date: string) => void
  onUnassignActivity: (activity: Activity) => void
  onRateActivity: (activity: Activity) => void
  onToggleWishlistActivity: (activity: Activity) => void
  onSetTimeActivity: (activity: Activity) => void
  wishlistLabel?: string
}

export default function DayCard({
  day,
  isToday,
  onSelect,
  activitiesReady,
  onAssignActivity,
  onUnassignActivity,
  onRateActivity,
  onToggleWishlistActivity,
  onSetTimeActivity,
  wishlistLabel,
}: DayCardProps) {
  const scheduledActivities = day.activities.filter((a) => a.time)
  const unscheduledActivities = day.activities.filter((a) => !a.time)
  const primaryStageId = day.stays.at(-1)?.stage.id
  const isTransition =
    day.stays.length === 2 && day.stays[0].stage.id !== day.stays[1].stage.id
  const isHotelChange =
    day.stays.length === 2 && day.stays[0].stage.id === day.stays[1].stage.id
  // The stage(s) newly checked into today (covers day 1's own arrival, not
  // just multi-stay transition days) — that's whose arrivalLegs apply.
  const arrivalLegs = day.stays
    .filter(({ stage, accommodation }) => stage.accommodations[0].id === accommodation.id && accommodation.checkIn === day.date)
    .flatMap(({ stage }) => stage.arrivalLegs ?? [])

  return (
    <div
      className={`day-card${isToday ? ' day-card--today day-card--current' : ''}`}
      onClick={() => primaryStageId && onSelect(primaryStageId)}
      role="button"
      tabIndex={0}
    >
      <div className="day-card__header">
        <span className="day-card__date">{formatDayLabel(day.date)}</span>
        {isToday && (
          <Chip as="span" tone="vermillon" active>
            Aujourd'hui
          </Chip>
        )}
      </div>

      {isTransition && (
        <div className="day-card__transition">
          <Icon name="route" size={13} />
          {day.stays[0].stage.city} → {day.stays[1].stage.city}
        </div>
      )}

      {isHotelChange && (
        <div className="day-card__transition">
          <Icon name="route" size={13} />
          Changement d'hébergement à {day.stays[0].stage.city}
        </div>
      )}

      {!isTransition &&
        !isHotelChange &&
        day.stays.map(({ stage, accommodation }) => (
          <div className="day-card__location" key={accommodation.id}>
            {stage.city} — {accommodation.name}
          </div>
        ))}

      {arrivalLegs.map((leg, i) => (
        <div className="day-card__leg" key={i} style={legColorStyle(leg)}>
          <Icon name="route" size={13} />
          {transportLabels[leg.mode]} · {leg.from} → {leg.to}
        </div>
      ))}

      {isTransition &&
        day.stays.map(({ accommodation }) => (
          <div className="day-card__sub" key={accommodation.id}>
            {accommodation.name}
          </div>
        ))}

      {isHotelChange && (
        <div className="day-card__sub">
          {day.stays[0].accommodation.name} → {day.stays[1].accommodation.name}
        </div>
      )}

      {day.excursions.map(({ stage, excursion }) => (
        <div className="day-card__excursion" key={excursion.id}>
          <Icon name="route" size={13} />
          {stage.city} ↔ {excursion.name}
          {excursion.mode && <> · {transportLabels[excursion.mode]}</>}
          {excursion.notes && <em> — {excursion.notes}</em>}
        </div>
      ))}

      {day.departureLegs && day.departureLegs.length > 0 && (
        <div className="day-card__transition">
          <Icon name="route" size={13} />
          {day.departureLegs[0].from} → {day.departureLegs.at(-1)!.to}
        </div>
      )}
      {day.departureLegs?.map((leg, i) => (
        <div className="day-card__leg" key={i} style={legColorStyle(leg)}>
          <Icon name="route" size={13} />
          {transportLabels[leg.mode]} · {leg.from} → {leg.to}
        </div>
      ))}

      <div className="day-card__activities" onClick={(e) => e.stopPropagation()}>
        {scheduledActivities.length > 0 && (
          <DayAgenda
            activities={scheduledActivities}
            onUnassignActivity={onUnassignActivity}
            onRateActivity={onRateActivity}
            onToggleWishlistActivity={onToggleWishlistActivity}
            onSetTimeActivity={onSetTimeActivity}
            wishlistLabel={wishlistLabel}
          />
        )}
        {unscheduledActivities.length > 0 && scheduledActivities.length > 0 && (
          <h3 className="day-card__unscheduled-title">Non planifiées</h3>
        )}
        {unscheduledActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onUnassign={onUnassignActivity}
            onRate={onRateActivity}
            onToggleWishlist={onToggleWishlistActivity}
            onSetTime={onSetTimeActivity}
            wishlistLabel={wishlistLabel}
          />
        ))}
        {activitiesReady && (
          <Button variant="ghost" size="sm" icon="plus" onClick={() => onAssignActivity(day.date)}>
            Assigner une activité
          </Button>
        )}
      </div>
    </div>
  )
}
