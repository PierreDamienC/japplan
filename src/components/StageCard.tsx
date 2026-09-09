import type { Accommodation, Excursion, Stage } from '../types/trip'
import Icon from './ui/Icon'
import Button from './ui/Button'
import Chip from './ui/Chip'

interface StageCardProps {
  stage: Stage
  isCurrent: boolean
  isFocused?: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: (stageId: string) => void
  onMove: (direction: 'up' | 'down') => void
  onEdit: () => void
  onDelete: () => void
  onAddAccommodation: () => void
  onEditAccommodation: (accommodation: Accommodation) => void
  onDeleteAccommodation: (accommodation: Accommodation) => void
  onAddExcursion: () => void
  onEditExcursion: (excursion: Excursion) => void
  onDeleteExcursion: (excursion: Excursion) => void
  onAddArrivalLeg: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function stageDateRange(stage: Stage): { start: string; end: string; nights: number } | null {
  if (stage.accommodations.length === 0) return null
  const start = stage.accommodations.map((a) => a.checkIn).reduce((a, b) => (a < b ? a : b))
  const end = stage.accommodations.map((a) => a.checkOut).reduce((a, b) => (a > b ? a : b))
  const nights = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
  return { start, end, nights }
}

export default function StageCard({
  stage,
  isCurrent,
  isFocused,
  canMoveUp,
  canMoveDown,
  onSelect,
  onMove,
  onEdit,
  onDelete,
  onAddAccommodation,
  onEditAccommodation,
  onDeleteAccommodation,
  onAddExcursion,
  onEditExcursion,
  onDeleteExcursion,
  onAddArrivalLeg,
}: StageCardProps) {
  const dateRange = stageDateRange(stage)

  return (
    <div
      id={`stage-${stage.id}`}
      className={`stage-card${isCurrent ? ' stage-card--current' : ''}${isFocused ? ' stage-card--focused' : ''}`}
      onClick={() => onSelect(stage.id)}
      role="button"
      tabIndex={0}
    >
      <div className="stage-card__header">
        <div className="stage-card__header-row">
          <h2>{stage.city}</h2>
          {isCurrent && (
            <Chip as="span" tone="vermillon" active>
              Aujourd'hui
            </Chip>
          )}
          <div className="stage-card__row-actions" onClick={(e) => e.stopPropagation()}>
            <Button iconOnly variant="ghost" size="sm" icon="arrow-up" disabled={!canMoveUp} onClick={() => onMove('up')} aria-label="Monter" />
            <Button
              iconOnly
              variant="ghost"
              size="sm"
              icon="arrow-down"
              disabled={!canMoveDown}
              onClick={() => onMove('down')}
              aria-label="Descendre"
            />
            <Button iconOnly variant="ghost" size="sm" icon="edit" onClick={onEdit} aria-label="Modifier l'étape" />
            <Button iconOnly variant="ghost" size="sm" icon="trash" onClick={onDelete} aria-label="Supprimer l'étape" />
          </div>
        </div>
        {dateRange && (
          <span className="stage-card__subtitle">
            {formatDate(dateRange.start)} → {formatDate(dateRange.end)} · {dateRange.nights} nuit{dateRange.nights > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {stage.accommodations.length > 0 && (
        <div className="stage-card__section stage-card__section--gold">
          <span className="stage-card__section-label">
            <Icon name="bed" size={13} />
            Hébergement{stage.accommodations.length > 1 ? 's' : ''}
          </span>
          {stage.accommodations.map((acc) => (
            <div className="stage-card__accommodation" key={acc.id} onClick={(e) => e.stopPropagation()}>
              <div className="stage-card__accommodation-main">
                <span className="stage-card__accommodation-name">{acc.name}</span>
                <span className="stage-card__dates">
                  {formatDate(acc.checkIn)} → {formatDate(acc.checkOut)}
                </span>
              </div>
              <div className="stage-card__row-actions">
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  icon="edit"
                  onClick={() => onEditAccommodation(acc)}
                  aria-label="Modifier l'hébergement"
                />
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  onClick={() => onDeleteAccommodation(acc)}
                  aria-label="Supprimer l'hébergement"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {stage.excursions.length > 0 && (
        <div className="stage-card__section stage-card__section--indigo">
          <span className="stage-card__section-label">
            <Icon name="route" size={13} />
            Excursions
          </span>
          <ul className="stage-card__excursions">
            {stage.excursions.map((ex) => (
              <li key={ex.id} onClick={(e) => e.stopPropagation()}>
                <span className="stage-card__excursion-date">{formatDate(ex.date)}</span>
                {ex.name}
                {ex.notes && <em> ({ex.notes})</em>}
                <div className="stage-card__row-actions">
                  <Button iconOnly variant="ghost" size="sm" icon="edit" onClick={() => onEditExcursion(ex)} aria-label="Modifier l'excursion" />
                  <Button
                    iconOnly
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    onClick={() => onDeleteExcursion(ex)}
                    aria-label="Supprimer l'excursion"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="stage-card__actions-row" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" icon="route" onClick={onAddArrivalLeg}>
          Trajet d'arrivée
        </Button>
        <Button variant="ghost" size="sm" icon="bed" onClick={onAddAccommodation}>
          Hébergement
        </Button>
        <Button variant="ghost" size="sm" icon="plus" onClick={onAddExcursion}>
          Excursion
        </Button>
      </div>
    </div>
  )
}
