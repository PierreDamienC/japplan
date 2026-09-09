import type { Activity, Excursion, Accommodation, Stage, Trip, TransportLeg } from '../types/trip'

export interface DayPlan {
  date: string
  stays: { stage: Stage; accommodation: Accommodation }[]
  excursions: { stage: Stage; excursion: Excursion }[]
  departureLegs?: TransportLeg[]
  activities: Activity[]
}

function toUTCDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`)
}

function toISO(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function buildDayPlans(trip: Trip): DayPlan[] {
  const stays = trip.stages.flatMap((stage) =>
    stage.accommodations.map((accommodation) => ({ stage, accommodation })),
  )
  const excursions = trip.stages.flatMap((stage) =>
    stage.excursions.map((excursion) => ({ stage, excursion })),
  )
  if (stays.length === 0) return []

  const start = stays.reduce(
    (min, s) => (s.accommodation.checkIn < min ? s.accommodation.checkIn : min),
    stays[0].accommodation.checkIn,
  )
  const end = stays.reduce(
    (max, s) => (s.accommodation.checkOut > max ? s.accommodation.checkOut : max),
    stays[0].accommodation.checkOut,
  )

  const days: DayPlan[] = []
  let cursor = toUTCDate(start)
  const endDate = toUTCDate(end)

  while (cursor <= endDate) {
    const iso = toISO(cursor)
    const dayStays = stays
      .filter((s) => s.accommodation.checkIn <= iso && iso <= s.accommodation.checkOut)
      .sort((a, b) => a.accommodation.checkIn.localeCompare(b.accommodation.checkIn))
    const dayExcursions = excursions.filter((e) => e.excursion.date === iso)
    const departureLegs = iso === end ? trip.departureLegs : undefined
    const dayActivities = (trip.activities ?? []).filter((a) => a.date === iso)
    days.push({ date: iso, stays: dayStays, excursions: dayExcursions, departureLegs, activities: dayActivities })
    cursor = new Date(cursor.getTime() + 86400000)
  }

  return days
}

// Stage to center the map on if this day is selected: the destination when
// travelling, otherwise the day's only stay.
export function dayPrimaryStageId(day: DayPlan): string | undefined {
  return day.stays.at(-1)?.stage.id
}
