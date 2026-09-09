import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Accommodation, Coordinates, Excursion, Stage, Trip, TransportLeg } from '../types/trip'
import { transportModeLabels } from '../utils/transportMode'
import StageCard from './StageCard'
import StageFormModal from './StageFormModal'
import AccommodationFormModal from './AccommodationFormModal'
import ExcursionFormModal from './ExcursionFormModal'
import TransportLegFormModal from './TransportLegFormModal'
import Icon from './ui/Icon'
import Button from './ui/Button'

interface TimelineProps {
  trip: Trip
  onSelectStage: (stageId: string) => void
  focusStageId?: string | null
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

type StageModalState = { mode: 'create' } | { mode: 'edit'; stage: Stage } | null
type AccommodationModalState = { stageId: string; mode: 'create' } | { stageId: string; mode: 'edit'; accommodation: Accommodation } | null
type ExcursionModalState = { stageId: string; mode: 'create' } | { stageId: string; mode: 'edit'; excursion: Excursion } | null
type LegModalState = { stageId?: string; mode: 'create' } | { stageId?: string; mode: 'edit'; leg: TransportLeg } | null

function isStageCurrent(stage: Trip['stages'][number], today: Date) {
  return stage.accommodations.some((acc) => {
    const checkIn = new Date(acc.checkIn)
    const checkOut = new Date(acc.checkOut)
    return today >= checkIn && today <= checkOut
  })
}

export default function Timeline({
  trip,
  onSelectStage,
  focusStageId,
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
}: TimelineProps) {
  const today = new Date()
  const sortedStages = [...trip.stages].sort((a, b) => a.order - b.order)

  const [stageModal, setStageModal] = useState<StageModalState>(null)
  const [accommodationModal, setAccommodationModal] = useState<AccommodationModalState>(null)
  const [excursionModal, setExcursionModal] = useState<ExcursionModalState>(null)
  const [arrivalLegModal, setArrivalLegModal] = useState<LegModalState>(null)
  const [departureLegModal, setDepartureLegModal] = useState<LegModalState>(null)

  useEffect(() => {
    if (!focusStageId) return
    document.getElementById(`stage-${focusStageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusStageId])

  async function handleDeleteStage(stage: Stage) {
    if (!window.confirm(`Supprimer l'étape « ${stage.city} » et tout son contenu (hébergements, excursions) ?`)) return
    await onDeleteStage(stage.id)
  }

  async function handleDeleteAccommodation(stageId: string, accommodation: Accommodation) {
    if (!window.confirm(`Supprimer l'hébergement « ${accommodation.name} » ?`)) return
    await onDeleteAccommodation(stageId, accommodation.id)
  }

  async function handleDeleteExcursion(stageId: string, excursion: Excursion) {
    if (!window.confirm(`Supprimer l'excursion « ${excursion.name} » ?`)) return
    await onDeleteExcursion(stageId, excursion.id)
  }

  async function handleDeleteArrivalLeg(stageId: string, leg: TransportLeg) {
    if (!window.confirm(`Supprimer le trajet « ${leg.from} → ${leg.to} » ?`)) return
    await onDeleteArrivalLeg(stageId, leg.id)
  }

  async function handleDeleteDepartureLeg(leg: TransportLeg) {
    if (!window.confirm(`Supprimer le trajet « ${leg.from} → ${leg.to} » ?`)) return
    await onDeleteDepartureLeg(leg.id)
  }

  return (
    <>
      <ol className="spine">
        {sortedStages.map((stage, index) => (
        <Fragment key={stage.id}>
          {(stage.arrivalLegs ?? []).map((leg) => (
            <li className="spine__item spine__item--leg" key={leg.id}>
              <div className="spine__rail">
                <span className="spine__node spine__node--leg" style={{ '--node-color': `var(--transport-${leg.mode})` } as CSSProperties}>
                  <Icon name="route" size={13} />
                </span>
              </div>
              <div className="spine__leg-row">
                <span className="spine__leg-label">
                  {transportModeLabels[leg.mode]} · {leg.from} → {leg.to}
                </span>
                <div className="spine__leg-actions">
                  <Button
                    iconOnly
                    variant="ghost"
                    size="sm"
                    icon="edit"
                    aria-label="Modifier le trajet"
                    onClick={() => setArrivalLegModal({ stageId: stage.id, mode: 'edit', leg })}
                  />
                  <Button
                    iconOnly
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    aria-label="Supprimer le trajet"
                    onClick={() => handleDeleteArrivalLeg(stage.id, leg)}
                  />
                </div>
              </div>
            </li>
          ))}
          <li className={`spine__item${isStageCurrent(stage, today) ? ' spine__item--current' : ''}`}>
            <div className="spine__rail">
              <span className="spine__node">{stage.order}</span>
            </div>
            <StageCard
              stage={stage}
              isCurrent={isStageCurrent(stage, today)}
              isFocused={stage.id === focusStageId}
              canMoveUp={index > 0}
              canMoveDown={index < sortedStages.length - 1}
              onSelect={onSelectStage}
              onMove={(direction) => onMoveStage(stage.id, direction)}
              onEdit={() => setStageModal({ mode: 'edit', stage })}
              onDelete={() => handleDeleteStage(stage)}
              onAddAccommodation={() => setAccommodationModal({ stageId: stage.id, mode: 'create' })}
              onEditAccommodation={(accommodation) => setAccommodationModal({ stageId: stage.id, mode: 'edit', accommodation })}
              onDeleteAccommodation={(accommodation) => handleDeleteAccommodation(stage.id, accommodation)}
              onAddExcursion={() => setExcursionModal({ stageId: stage.id, mode: 'create' })}
              onEditExcursion={(excursion) => setExcursionModal({ stageId: stage.id, mode: 'edit', excursion })}
              onDeleteExcursion={(excursion) => handleDeleteExcursion(stage.id, excursion)}
              onAddArrivalLeg={() => setArrivalLegModal({ stageId: stage.id, mode: 'create' })}
            />
          </li>
        </Fragment>
      ))}

      <li className="spine__item spine__item--add">
        <div className="spine__rail" />
        <button type="button" className="stage-card__add-btn stage-card__add-btn--stage" onClick={() => setStageModal({ mode: 'create' })}>
          + Ajouter une étape
        </button>
      </li>

      <li className="spine__item spine__item--end">
        <div className="spine__rail" />
        <div className="stage-card stage-card--departure">
          <div className="stage-card__header">
            <h2>Trajet retour</h2>
          </div>
          {(trip.departureLegs ?? []).map((leg) => (
            <div className="stage-card__row" key={leg.id}>
              <span>
                {transportModeLabels[leg.mode]} : {leg.from} → {leg.to}
              </span>
              <div className="stage-card__row-actions">
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  icon="edit"
                  aria-label="Modifier le trajet"
                  onClick={() => setDepartureLegModal({ mode: 'edit', leg })}
                />
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  aria-label="Supprimer le trajet"
                  onClick={() => handleDeleteDepartureLeg(leg)}
                />
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="plus" onClick={() => setDepartureLegModal({ mode: 'create' })}>
            Trajet retour
          </Button>
        </div>
      </li>
      </ol>

      {stageModal && (
        <StageFormModal
          mode={stageModal.mode}
          stage={stageModal.mode === 'edit' ? stageModal.stage : undefined}
          onSubmit={(input) =>
            stageModal.mode === 'create'
              ? onAddStage({ ...input, order: (sortedStages.at(-1)?.order ?? 0) + 1 })
              : onUpdateStage(stageModal.stage.id, input)
          }
          onClose={() => setStageModal(null)}
        />
      )}

      {accommodationModal && (
        <AccommodationFormModal
          mode={accommodationModal.mode}
          accommodation={accommodationModal.mode === 'edit' ? accommodationModal.accommodation : undefined}
          onSubmit={(input) =>
            accommodationModal.mode === 'create'
              ? onAddAccommodation(accommodationModal.stageId, input)
              : onUpdateAccommodation(accommodationModal.stageId, accommodationModal.accommodation.id, input)
          }
          onClose={() => setAccommodationModal(null)}
        />
      )}

      {excursionModal && (
        <ExcursionFormModal
          mode={excursionModal.mode}
          excursion={excursionModal.mode === 'edit' ? excursionModal.excursion : undefined}
          onSubmit={(input) =>
            excursionModal.mode === 'create'
              ? onAddExcursion(excursionModal.stageId, input)
              : onUpdateExcursion(excursionModal.stageId, excursionModal.excursion.id, input)
          }
          onClose={() => setExcursionModal(null)}
        />
      )}

      {arrivalLegModal && (
        <TransportLegFormModal
          mode={arrivalLegModal.mode}
          leg={arrivalLegModal.mode === 'edit' ? arrivalLegModal.leg : undefined}
          title={arrivalLegModal.mode === 'create' ? "Ajouter un trajet d'arrivée" : "Modifier le trajet d'arrivée"}
          onSubmit={(input) =>
            arrivalLegModal.mode === 'create'
              ? onAddArrivalLeg(arrivalLegModal.stageId!, input)
              : onUpdateArrivalLeg(arrivalLegModal.stageId!, arrivalLegModal.leg.id, input)
          }
          onClose={() => setArrivalLegModal(null)}
        />
      )}

      {departureLegModal && (
        <TransportLegFormModal
          mode={departureLegModal.mode}
          leg={departureLegModal.mode === 'edit' ? departureLegModal.leg : undefined}
          title={departureLegModal.mode === 'create' ? 'Ajouter un trajet retour' : 'Modifier le trajet retour'}
          onSubmit={(input) =>
            departureLegModal.mode === 'create'
              ? onAddDepartureLeg(input)
              : onUpdateDepartureLeg(departureLegModal.leg.id, input)
          }
          onClose={() => setDepartureLegModal(null)}
        />
      )}
    </>
  )
}
