import { useState } from 'react'
import type { Accommodation, Activity, Coordinates, Excursion, Trip, TransportLeg } from '../types/trip'
import type { DatabaseStatus } from '../hooks/useDatabase'
import Timeline from './Timeline'
import DayView from './DayView'

interface PlanningViewProps {
  trip: Trip
  onSelectStage: (stageId: string) => void
  focusStageId?: string | null
  activitiesStatus: DatabaseStatus
  onUpdateActivity: (id: string, patch: Partial<Omit<Activity, 'id'>>) => Promise<void>
  onAddStage: (input: { city: string; coordinates: Coordinates; order: number }) => Promise<void>
  onUpdateStage: (stageId: string, patch: { city: string; coordinates: Coordinates }) => Promise<void>
  onDeleteStage: (stageId: string) => Promise<void>
  onMoveStage: (stageId: string, direction: 'up' | 'down') => Promise<void>
  onAddAccommodation: (stageId: string, input: Omit<Accommodation, 'id'>) => Promise<void>
  onUpdateAccommodation: (stageId: string, accommodationId: string, patch: Omit<Accommodation, 'id'>) => Promise<void>
  onDeleteAccommodation: (stageId: string, accommodationId: string) => Promise<void>
  onAddExcursion: (stageId: string, input: Omit<Excursion, 'id'>) => Promise<void>
  onUpdateExcursion: (stageId: string, excursionId: string, patch: Omit<Excursion, 'id'>) => Promise<void>
  onDeleteExcursion: (stageId: string, excursionId: string) => Promise<void>
  onAddArrivalLeg: (stageId: string, input: Omit<TransportLeg, 'id'>) => Promise<void>
  onUpdateArrivalLeg: (stageId: string, legId: string, patch: Omit<TransportLeg, 'id'>) => Promise<void>
  onDeleteArrivalLeg: (stageId: string, legId: string) => Promise<void>
  onAddDepartureLeg: (input: Omit<TransportLeg, 'id'>) => Promise<void>
  onUpdateDepartureLeg: (legId: string, patch: Omit<TransportLeg, 'id'>) => Promise<void>
  onDeleteDepartureLeg: (legId: string) => Promise<void>
}

type PlanningMode = 'stage' | 'day'

export default function PlanningView({
  trip,
  onSelectStage,
  focusStageId,
  activitiesStatus,
  onUpdateActivity,
  onAddStage,
  onUpdateStage,
  onDeleteStage,
  onMoveStage,
  onAddAccommodation,
  onUpdateAccommodation,
  onDeleteAccommodation,
  onAddExcursion,
  onUpdateExcursion,
  onDeleteExcursion,
  onAddArrivalLeg,
  onUpdateArrivalLeg,
  onDeleteArrivalLeg,
  onAddDepartureLeg,
  onUpdateDepartureLeg,
  onDeleteDepartureLeg,
}: PlanningViewProps) {
  const [mode, setMode] = useState<PlanningMode>('stage')

  return (
    <div className="planning">
      <div className="segmented">
        <button
          type="button"
          className={mode === 'stage' ? 'segmented__button segmented__button--active' : 'segmented__button'}
          onClick={() => setMode('stage')}
        >
          Par étape
        </button>
        <button
          type="button"
          className={mode === 'day' ? 'segmented__button segmented__button--active' : 'segmented__button'}
          onClick={() => setMode('day')}
        >
          Par jour
        </button>
      </div>

      <div className="planning__content">
        {mode === 'stage' ? (
          <Timeline
            trip={trip}
            onSelectStage={onSelectStage}
            focusStageId={focusStageId}
            onAddStage={onAddStage}
            onUpdateStage={onUpdateStage}
            onDeleteStage={onDeleteStage}
            onMoveStage={onMoveStage}
            onAddAccommodation={onAddAccommodation}
            onUpdateAccommodation={onUpdateAccommodation}
            onDeleteAccommodation={onDeleteAccommodation}
            onAddExcursion={onAddExcursion}
            onUpdateExcursion={onUpdateExcursion}
            onDeleteExcursion={onDeleteExcursion}
            onAddArrivalLeg={onAddArrivalLeg}
            onUpdateArrivalLeg={onUpdateArrivalLeg}
            onDeleteArrivalLeg={onDeleteArrivalLeg}
            onAddDepartureLeg={onAddDepartureLeg}
            onUpdateDepartureLeg={onUpdateDepartureLeg}
            onDeleteDepartureLeg={onDeleteDepartureLeg}
          />
        ) : (
          <DayView
            trip={trip}
            onSelectStage={onSelectStage}
            activitiesStatus={activitiesStatus}
            onUpdateActivity={onUpdateActivity}
          />
        )}
      </div>
    </div>
  )
}
