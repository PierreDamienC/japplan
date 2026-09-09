import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Trip, ActivityCategory, Activity } from '../types/trip'
import type { DatabaseStatus } from '../hooks/useDatabase'
import { buildDayPlans } from '../utils/dayPlan'
import { categoryLabels, ALL_CATEGORIES } from '../theme/categories'
import ActivityCard from './ActivityCard'
import ActivityFormModal from './ActivityFormModal'
import ActivityRatingModal from './ActivityRatingModal'
import DayPickerModal from './DayPickerModal'
import TimePickerModal from './TimePickerModal'
import Icon from './ui/Icon'
import Button from './ui/Button'
import Chip from './ui/Chip'

interface ActivitiesViewProps {
  trip: Trip
  onSelectActivity?: (activityId: string) => void
  focusActivityId?: string | null
  activitiesStatus: DatabaseStatus
  activitiesError?: string
  onAddActivity: (input: Omit<Activity, 'id'>) => Promise<void>
  onUpdateActivity: (id: string, patch: Partial<Omit<Activity, 'id'>>) => Promise<void>
  onDeleteActivity: (id: string) => Promise<void>
}

type ModalState = { mode: 'create' } | { mode: 'edit'; activity: Activity } | null

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function ActivitiesView({
  trip,
  onSelectActivity,
  focusActivityId,
  activitiesStatus,
  activitiesError,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
}: ActivitiesViewProps) {
  const [activeCategories, setActiveCategories] = useState<Set<ActivityCategory>>(new Set())
  const [stageFilter, setStageFilter] = useState('')
  const [wishlistOnly, setWishlistOnly] = useState(false)
  const [plannedOnly, setPlannedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [schedulingActivity, setSchedulingActivity] = useState<Activity | null>(null)
  const [ratingActivity, setRatingActivity] = useState<Activity | null>(null)
  const [timeActivity, setTimeActivity] = useState<Activity | null>(null)

  const dayDates = useMemo(() => buildDayPlans(trip).map((d) => d.date), [trip])

  useEffect(() => {
    if (!focusActivityId) return
    document.getElementById(`activity-${focusActivityId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusActivityId])

  function toggleCategory(category: ActivityCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  type FilterFacet = 'category' | 'stage' | 'wishlist' | 'planned'

  // Filtre la liste selon tous les critères actifs, sauf `exclude` — utilisé
  // pour que le compteur affiché sur un chip reflète les *autres* filtres en
  // cours (ex: sélectionner une étape doit mettre à jour les compteurs de
  // catégorie/★/📅, pas seulement la liste affichée).
  const applyFilters = useCallback(
    (activities: Activity[], exclude?: FilterFacet) => {
      let filtered =
        exclude === 'category' || activeCategories.size === 0
          ? activities
          : activities.filter((a) => activeCategories.has(a.category))

      if (exclude !== 'stage' && stageFilter) {
        filtered = filtered.filter((a) => a.stageId === stageFilter)
      }

      if (exclude !== 'wishlist' && wishlistOnly) {
        filtered = filtered.filter((a) => a.wishlist)
      }

      if (exclude !== 'planned' && plannedOnly) {
        filtered = filtered.filter((a) => a.date)
      }

      const query = normalize(search.trim())
      if (query) {
        filtered = filtered.filter(
          (a) => normalize(a.name).includes(query) || (a.notes && normalize(a.notes).includes(query)),
        )
      }

      return filtered
    },
    [activeCategories, stageFilter, wishlistOnly, plannedOnly, search],
  )

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0])) as Record<ActivityCategory, number>
    applyFilters(trip.activities ?? [], 'category').forEach((a) => counts[a.category]++)
    return counts
  }, [trip, applyFilters])

  const wishlistCount = useMemo(
    () => applyFilters(trip.activities ?? [], 'wishlist').filter((a) => a.wishlist).length,
    [trip, applyFilters],
  )
  const plannedCount = useMemo(
    () => applyFilters(trip.activities ?? [], 'planned').filter((a) => a.date).length,
    [trip, applyFilters],
  )

  const sortedStages = useMemo(() => [...trip.stages].sort((a, b) => a.order - b.order), [trip.stages])

  const groups = useMemo(() => {
    const filtered = applyFilters(trip.activities ?? [])

    const stageOrder = new Map(trip.stages.map((s) => [s.id, s.order]))
    const byGroup = new Map<string, typeof filtered>()
    filtered.forEach((activity) => {
      const list = byGroup.get(activity.stageGroup) ?? []
      list.push(activity)
      byGroup.set(activity.stageGroup, list)
    })

    // Excursions ("Uji (depuis Kyoto)", "Tokyo (excursion journée)"...) doivent
    // suivre l'étape principale dont elles dépendent, pas passer devant.
    const isExcursionLabel = (label: string) => /excursion|depuis/i.test(label)

    return [...byGroup.entries()].sort(([groupA, a], [groupB, b]) => {
      const orderA = stageOrder.get(a[0].stageId ?? '') ?? Infinity
      const orderB = stageOrder.get(b[0].stageId ?? '') ?? Infinity
      if (orderA !== orderB) return orderA - orderB
      return Number(isExcursionLabel(groupA)) - Number(isExcursionLabel(groupB))
    })
  }, [trip, applyFilters])

  const totalCount = groups.reduce((sum, [, activities]) => sum + activities.length, 0)

  const activeFilterCount =
    (stageFilter ? 1 : 0) + (wishlistOnly ? 1 : 0) + (plannedOnly ? 1 : 0) + activeCategories.size

  async function handleDelete(activity: Activity) {
    try {
      await onDeleteActivity(activity.id)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleSchedule(date: string | undefined) {
    if (!schedulingActivity) return
    await onUpdateActivity(schedulingActivity.id, { date })
  }

  async function handleToggleWishlist(activity: Activity) {
    try {
      await onUpdateActivity(activity.id, { wishlist: !activity.wishlist })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="activities">
      {(activitiesStatus === 'no-file' || activitiesStatus === 'error') && (
        <div className="connect-drive-file">
          <p>
            {activitiesStatus === 'no-file'
              ? "Aucun fichier d'activités connecté."
              : `Erreur de lecture du fichier : ${activitiesError}`}
          </p>
          <p className="connect-drive-file__hint">Connecte-le depuis les Paramètres (⚙, en haut).</p>
        </div>
      )}

      <div className="activities__topbar">
        <div className="activities__search">
          <Icon name="search" size={16} className="activities__search-icon" />
          <input
            type="search"
            className="activities__search-input"
            placeholder="Rechercher une activité…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={filtersOpen ? 'secondary' : 'ghost'}
          icon="filter"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          Filtres
          {activeFilterCount > 0 && (
            <Chip as="span" tone="indigo" active className="activities__filter-badge">
              {activeFilterCount}
            </Chip>
          )}
        </Button>
      </div>

      {filtersOpen && (
        <div className="activities__filter-panel">
          <div className="activities__stage-filter">
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="">Toutes les étapes</option>
              {sortedStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.city}
                </option>
              ))}
            </select>
          </div>

          <div className="activities__filter-group">
            <h3 className="activities__filter-group-title">Statut</h3>
            <div className="activities__filters">
              <Chip tone="gold" icon="flag" active={wishlistOnly} count={wishlistCount} onClick={() => setWishlistOnly((prev) => !prev)}>
                Envie de faire
              </Chip>
              <Chip tone="indigo" icon="calendar" active={plannedOnly} count={plannedCount} onClick={() => setPlannedOnly((prev) => !prev)}>
                Planifiées
              </Chip>
            </div>
          </div>

          <div className="activities__filter-group">
            <h3 className="activities__filter-group-title">Catégories</h3>
            <div className="activities__filters">
              {ALL_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  tone="category"
                  category={category}
                  active={activeCategories.has(category)}
                  count={categoryCounts[category]}
                  onClick={() => toggleCategory(category)}
                >
                  {categoryLabels[category]}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="activities__total">
        {totalCount} activité{totalCount !== 1 ? 's' : ''}
      </div>

      <div className="activities__list">
        {groups.length === 0 && <p className="activities__empty">Aucune activité pour ce filtre.</p>}
        {groups.map(([groupName, activities]) => (
          <section key={groupName} className="activities__group">
            <h2 className="activities__group-title">
              <span>{groupName}</span>
              <span className="activities__group-count">({activities.length})</span>
            </h2>
            {activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onSelect={onSelectActivity ? (a) => onSelectActivity(a.id) : undefined}
                onEdit={(a) => setModal({ mode: 'edit', activity: a })}
                onDelete={handleDelete}
                onSchedule={(a) => setSchedulingActivity(a)}
                onRate={(a) => setRatingActivity(a)}
                onToggleWishlist={handleToggleWishlist}
                onSetTime={(a) => setTimeActivity(a)}
                wishlistLabel={trip.wishlistStampLabel}
                focused={activity.id === focusActivityId}
              />
            ))}
          </section>
        ))}
      </div>

      {activitiesStatus === 'ready' && (
        <button type="button" className="activities__fab" aria-label="Ajouter une activité" onClick={() => setModal({ mode: 'create' })}>
          <Icon name="plus" size={24} />
        </button>
      )}

      {modal && (
        <ActivityFormModal
          mode={modal.mode}
          activity={modal.mode === 'edit' ? modal.activity : undefined}
          stages={trip.stages}
          onClose={() => setModal(null)}
          onSubmit={
            modal.mode === 'create'
              ? onAddActivity
              : (input) => onUpdateActivity(modal.activity.id, input)
          }
        />
      )}

      {schedulingActivity && (
        <DayPickerModal
          activity={schedulingActivity}
          days={dayDates}
          onSelect={handleSchedule}
          onClose={() => setSchedulingActivity(null)}
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
