import type { CSSProperties } from 'react'
import type { Activity } from '../types/trip'
import ActivityCard from './ActivityCard'

interface DayAgendaProps {
  activities: Activity[]
  onUnassignActivity: (activity: Activity) => void
  onRateActivity: (activity: Activity) => void
  onToggleWishlistActivity: (activity: Activity) => void
  onSetTimeActivity: (activity: Activity) => void
  wishlistLabel?: string
}

const HOUR_HEIGHT = 48 // px/heure — couplé à .day-agenda__hour (App.css)
const ENTRY_HEIGHT = 88 // hauteur réelle d'une ActivityCard compact (nom+chip / En Maps+actions) — couplé à .day-agenda__entry { min-height } (App.css)
const ENTRY_GAP = 8
const RANGE_PADDING_MIN = 60 // marge avant/après les activités du jour
const MIN_RANGE_MIN = 120 // plancher de plage pour qu'une seule activité ne s'écrase pas

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function formatHour(minutes: number): string {
  const h = Math.floor(minutes / 60)
  return `${String(h).padStart(2, '0')}:00`
}

// Frise resserrée sur les activités du jour (pas une plage fixe façon
// "toute la journée") : un jour chargé occupe une grande frise, un jour
// léger une frise courte — chaque DayCard a son propre axe, indépendant
// des autres jours de la liste.
export default function DayAgenda({
  activities,
  onUnassignActivity,
  onRateActivity,
  onToggleWishlistActivity,
  onSetTimeActivity,
  wishlistLabel,
}: DayAgendaProps) {
  if (activities.length === 0) return null

  const sorted = [...activities].sort((a, b) => a.time!.localeCompare(b.time!))
  const times = sorted.flatMap((a) => [toMinutes(a.time!), a.endTime ? toMinutes(a.endTime) : toMinutes(a.time!)])
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)

  let rangeStart = Math.max(0, minTime - RANGE_PADDING_MIN)
  let rangeEnd = Math.min(24 * 60, maxTime + RANGE_PADDING_MIN)
  if (rangeEnd - rangeStart < MIN_RANGE_MIN) {
    const mid = (rangeStart + rangeEnd) / 2
    rangeStart = Math.max(0, mid - MIN_RANGE_MIN / 2)
    rangeEnd = Math.min(24 * 60, rangeStart + MIN_RANGE_MIN)
  }
  // Aligne les bornes sur l'heure pleine pour un axe propre.
  rangeStart = Math.floor(rangeStart / 60) * 60
  rangeEnd = Math.ceil(rangeEnd / 60) * 60

  const rangeMinutes = rangeEnd - rangeStart
  const gridHeight = (rangeMinutes / 60) * HOUR_HEIGHT

  // Position "vraie" (proportionnelle à l'heure, non affectée par
  // l'anti-collision) — sert au créneau bloqué (span), qui doit refléter la
  // durée réelle même quand la carte, elle, a été décalée pour ne pas
  // chevaucher la précédente.
  const trueTop = (minutes: number) => ((minutes - rangeStart) / rangeMinutes) * gridHeight

  let lastBottom = -Infinity
  const positioned = sorted.map((activity) => {
    const naiveTop = trueTop(toMinutes(activity.time!))
    const top = Math.max(naiveTop, lastBottom + ENTRY_GAP)
    lastBottom = top + ENTRY_HEIGHT
    const span = activity.endTime
      ? { top: trueTop(toMinutes(activity.time!)), height: trueTop(toMinutes(activity.endTime)) - trueTop(toMinutes(activity.time!)) }
      : null
    return { activity, top, span }
  })

  const hours: number[] = []
  for (let h = rangeStart; h <= rangeEnd; h += 60) hours.push(h)

  const containerHeight = Math.max(gridHeight, lastBottom)

  return (
    <div className="day-agenda" style={{ height: containerHeight }}>
      <div className="day-agenda__rail" />
      {hours.map((h) => (
        <div key={h} className="day-agenda__hour" style={{ top: ((h - rangeStart) / 60) * HOUR_HEIGHT }}>
          <span className="day-agenda__hour-label">{formatHour(h)}</span>
          <span className="day-agenda__hour-line" />
        </div>
      ))}
      {positioned.map(({ activity, span }) =>
        span ? (
          <div
            key={activity.id}
            className="day-agenda__span"
            style={{ top: span.top, height: span.height, background: `var(--cat-${activity.category})` }}
          />
        ) : null,
      )}
      {positioned.map(({ activity, top }) => (
        <div
          key={activity.id}
          className="day-agenda__entry"
          style={{ top, '--card-rail': `var(--cat-${activity.category})` } as CSSProperties}
        >
          <span className="day-agenda__dot" />
          <ActivityCard
            activity={activity}
            compact
            onUnassign={onUnassignActivity}
            onRate={onRateActivity}
            onToggleWishlist={onToggleWishlistActivity}
            onSetTime={onSetTimeActivity}
            wishlistLabel={wishlistLabel}
          />
        </div>
      ))}
    </div>
  )
}
