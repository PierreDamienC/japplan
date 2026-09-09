import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { DEFAULT_WISHLIST_STAMP_LABEL, type Activity } from '../types/trip'
import { categoryLabels } from '../theme/categories'
import { formatDayLabel } from '../utils/formatDate'
import Icon from './ui/Icon'
import Button from './ui/Button'
import Chip from './ui/Chip'

const WISHLIST_LONG_PRESS_MS = 550
const WISHLIST_STAMP_EXIT_MS = 320
// Couplé à .activity-card__swipe-actions { width: 128px } (App.css) — les
// deux valeurs doivent rester synchronisées.
const SWIPE_REVEAL_WIDTH = 128
const SWIPE_AXIS_LOCK_PX = 6

interface ActivityCardProps {
  activity: Activity
  onSelect?: (activity: Activity) => void
  onEdit?: (activity: Activity) => void
  onDelete?: (activity: Activity) => void
  onSchedule?: (activity: Activity) => void
  onUnassign?: (activity: Activity) => void
  onRate?: (activity: Activity) => void
  onToggleWishlist?: (activity: Activity) => void
  onSetTime?: (activity: Activity) => void
  focused?: boolean
  wishlistLabel?: string
  /** Rendu réduit pour la frise horaire (DayAgenda) — masque horaires/notes/commentaire. */
  compact?: boolean
}

const NOTES_URL_RE = /(https?:\/\/[^\s]+)/g
const IS_URL = /^https?:\/\//

// Rend les URL des notes cliquables (ex. lien source d'un parcours vélo),
// affichées par leur nom de domaine pour ne pas déborder de la carte.
function renderNotes(text: string) {
  return text.split(NOTES_URL_RE).map((part, i) => {
    if (!IS_URL.test(part)) return part
    let label = part
    try {
      label = new URL(part).hostname.replace(/^www\./, '')
    } catch {
      // garde l'URL brute si elle n'est pas analysable
    }
    return (
      <a key={i} className="notes-link" href={part} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
        {label} ↗
      </a>
    )
  })
}

export default function ActivityCard({
  activity,
  onSelect,
  onEdit,
  onDelete,
  onSchedule,
  onUnassign,
  onRate,
  onToggleWishlist,
  onSetTime,
  focused,
  wishlistLabel = DEFAULT_WISHLIST_STAMP_LABEL,
  compact = false,
}: ActivityCardProps) {
  const clickable = Boolean(onSelect && activity.coordinates)
  const swipeable = Boolean(onEdit || onDelete)

  const [stampExiting, setStampExiting] = useState(false)
  const [stampImpact, setStampImpact] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [swipeOpen, setSwipeOpen] = useState(false)
  const [swipeDragging, setSwipeDragging] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const swipeStart = useRef<{ x: number; y: number; startTranslate: number } | null>(null)
  const swipeAxis = useRef<'x' | 'y' | null>(null)
  const swipeJustDragged = useRef(false)

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    },
    [],
  )

  function clearWishlistLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Le retrait se fait par appui long sur le tampon lui-même, jamais sur le
  // bouton d'ajout — deux gestes/emplacements distincts pour éviter un retrait accidentel.
  function handleStampPointerDown(e: ReactPointerEvent) {
    e.stopPropagation()
    clearWishlistLongPress()
    longPressTimer.current = setTimeout(() => {
      setStampExiting(true)
      setTimeout(() => {
        onToggleWishlist?.(activity)
        setStampExiting(false)
      }, WISHLIST_STAMP_EXIT_MS)
    }, WISHLIST_LONG_PRESS_MS)
  }

  function handleStampPointerUp(e: ReactPointerEvent) {
    e.stopPropagation()
    clearWishlistLongPress()
  }

  function handleWishlistClick(e: MouseEvent) {
    e.stopPropagation()
    onToggleWishlist?.(activity)
    setStampImpact(true)
    setTimeout(() => setStampImpact(false), 260)
  }

  // Glissement vers la gauche pour révéler ✏/🗑, façon Gmail — évite d'avoir
  // ces deux actions destructives/rares en permanence visibles sur la carte.
  function handleSwipePointerDown(e: ReactPointerEvent) {
    swipeStart.current = { x: e.clientX, y: e.clientY, startTranslate: swipeOpen ? -SWIPE_REVEAL_WIDTH : 0 }
    swipeAxis.current = null
    setSwipeDragging(true)
  }

  function handleSwipePointerMove(e: ReactPointerEvent) {
    if (!swipeStart.current) return
    const dx = e.clientX - swipeStart.current.x
    const dy = e.clientY - swipeStart.current.y
    if (swipeAxis.current === null) {
      if (Math.abs(dx) < SWIPE_AXIS_LOCK_PX && Math.abs(dy) < SWIPE_AXIS_LOCK_PX) return
      swipeAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (swipeAxis.current === 'x') swipeJustDragged.current = true
    }
    if (swipeAxis.current !== 'x') return
    e.preventDefault()
    setSwipeX(Math.min(0, Math.max(-SWIPE_REVEAL_WIDTH, swipeStart.current.startTranslate + dx)))
  }

  function endSwipeDrag() {
    if (swipeAxis.current === 'x') setSwipeOpen(swipeX <= -SWIPE_REVEAL_WIDTH / 2)
    setSwipeDragging(false)
    swipeStart.current = null
    swipeAxis.current = null
  }

  function closeSwipe() {
    setSwipeOpen(false)
  }

  function handleCardClick() {
    if (swipeJustDragged.current) {
      swipeJustDragged.current = false
      return
    }
    if (swipeOpen) {
      closeSwipe()
      return
    }
    if (clickable) onSelect!(activity)
  }

  const swipeTranslate = swipeDragging ? swipeX : swipeOpen ? -SWIPE_REVEAL_WIDTH : 0

  // --card-rail pilote le filet de catégorie (::before, App.css) ; posé
  // inline car la catégorie est dynamique (6 valeurs). Le transform de swipe
  // reste géré à part, inline aussi — ne jamais lui ajouter de `transition`
  // en CSS, elle est pilotée ici pour pouvoir être coupée pendant le drag.
  const cardStyle: CSSProperties = { '--card-rail': `var(--cat-${activity.category})` } as CSSProperties
  if (swipeable) {
    cardStyle.transform = `translateX(${swipeTranslate}px)`
    cardStyle.transition = swipeDragging ? 'none' : 'transform var(--dur-base) var(--ease-standard)'
  }

  const cardContent = (
    <div
      id={`activity-${activity.id}`}
      className={`activity-card${clickable ? ' activity-card--clickable' : ''}${focused ? ' activity-card--focused' : ''}${activity.done ? ' activity-card--done' : ''}${stampImpact ? ' activity-card--impact' : ''}${swipeable ? ' activity-card--swipeable' : ''}${compact ? ' activity-card--compact' : ''}`}
      style={cardStyle}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={swipeable || clickable ? handleCardClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect!(activity)
            }
          : undefined
      }
      onPointerDown={swipeable ? handleSwipePointerDown : undefined}
      onPointerMove={swipeable ? handleSwipePointerMove : undefined}
      onPointerUp={swipeable ? endSwipeDrag : undefined}
      onPointerCancel={swipeable ? endSwipeDrag : undefined}
    >
      {(activity.wishlist || stampExiting) && (
        <button
          type="button"
          className={`activity-card__stamp${stampExiting ? ' activity-card__stamp--exiting' : ''}`}
          aria-label="Appui long pour retirer l'envie de faire"
          onPointerDown={handleStampPointerDown}
          onPointerUp={handleStampPointerUp}
          onPointerLeave={handleStampPointerUp}
          onPointerCancel={handleStampPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {wishlistLabel}
        </button>
      )}
      <div className="activity-card__header">
        {activity.done && <Icon name="check" size={14} className="activity-card__done-icon" />}
        <span className="activity-card__name">{activity.name}</span>
        {activity.rating && <span className="activity-card__rating">{activity.rating}</span>}
        <Chip as="span" tone="category" category={activity.category} active>
          {categoryLabels[activity.category]}
        </Chip>
      </div>
      {!compact && activity.hours && <div className="activity-card__hours">{activity.hours}</div>}
      {!compact && activity.notes && <p className="activity-card__notes">{renderNotes(activity.notes)}</p>}
      {!compact && activity.comment && <p className="activity-card__comment">💬 {activity.comment}</p>}
      <div className="activity-card__footer">
        {!compact && (
          <a className="btn btn--link" href={activity.mapsUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
            <Icon name="external" size={14} />
            En Maps
          </a>
        )}
        {(onToggleWishlist || onSchedule || onSetTime || onRate || onUnassign) && (
          <div className="activity-card__actions">
            {!compact && onToggleWishlist && !activity.wishlist && (
              <Button
                iconOnly
                variant="ghost"
                size="sm"
                icon="flag"
                aria-label="Marquer comme envie de faire"
                onClick={handleWishlistClick}
              />
            )}
            {onSchedule &&
              (activity.date ? (
                <Chip
                  as="button"
                  tone="indigo"
                  active
                  icon="calendar"
                  aria-label="Modifier la date planifiée"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSchedule(activity)
                  }}
                >
                  {formatDayLabel(activity.date)}
                </Chip>
              ) : (
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  icon="calendar"
                  aria-label="Planifier"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSchedule(activity)
                  }}
                />
              ))}
            {onSetTime &&
              (activity.time ? (
                <Chip
                  as="button"
                  tone="neutral"
                  active
                  icon="clock"
                  aria-label="Modifier l'heure"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSetTime(activity)
                  }}
                >
                  {activity.time}
                  {activity.endTime && `–${activity.endTime}`}
                </Chip>
              ) : (
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  icon="clock"
                  aria-label="Définir une heure"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSetTime(activity)
                  }}
                />
              ))}
            {onRate &&
              (activity.done || activity.rating ? (
                <Chip
                  as="button"
                  tone="matcha"
                  active
                  icon="check"
                  aria-label="Modifier la note"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRate(activity)
                  }}
                >
                  {activity.rating ?? 'Fait'}
                </Chip>
              ) : (
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  icon="note"
                  aria-label="Marquer comme faite et noter"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRate(activity)
                  }}
                />
              ))}
            {onUnassign && (
              <Button
                iconOnly
                variant="ghost"
                size="sm"
                icon="close"
                aria-label="Retirer du jour"
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Retirer "${activity.name}" du jour ?`)) onUnassign(activity)
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (!swipeable) return cardContent

  return (
    <div className="activity-card-row">
      <div className="activity-card__swipe-actions">
        {onEdit && (
          <button
            type="button"
            className="activity-card__swipe-btn activity-card__swipe-btn--edit"
            aria-label="Modifier"
            onClick={(e) => {
              e.stopPropagation()
              closeSwipe()
              onEdit(activity)
            }}
          >
            <Icon name="edit" size={20} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="activity-card__swipe-btn activity-card__swipe-btn--delete"
            aria-label="Supprimer"
            onClick={(e) => {
              e.stopPropagation()
              closeSwipe()
              if (window.confirm(`Supprimer "${activity.name}" ?`)) onDelete(activity)
            }}
          >
            <Icon name="trash" size={20} />
          </button>
        )}
      </div>
      {cardContent}
    </div>
  )
}
