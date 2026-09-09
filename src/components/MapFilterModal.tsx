import type { ActivityCategory } from '../types/trip'
import { categoryLabels } from '../theme/categories'
import Sheet from './ui/Sheet'
import Chip from './ui/Chip'
import Button from './ui/Button'

interface MapFilterModalProps {
  categories: ActivityCategory[]
  visibleCategories: Set<ActivityCategory>
  categoryCounts: Record<ActivityCategory, number>
  wishlistOnly: boolean
  wishlistCount: number
  plannedOnly: boolean
  plannedCount: number
  onToggleCategory: (category: ActivityCategory) => void
  onToggleWishlist: () => void
  onTogglePlanned: () => void
  onReset: () => void
  onClose: () => void
}

export default function MapFilterModal({
  categories,
  visibleCategories,
  categoryCounts,
  wishlistOnly,
  wishlistCount,
  plannedOnly,
  plannedCount,
  onToggleCategory,
  onToggleWishlist,
  onTogglePlanned,
  onReset,
  onClose,
}: MapFilterModalProps) {
  return (
    <Sheet
      title="Filtres de la carte"
      onClose={onClose}
      footer={
        <Button variant="ghost" block onClick={onReset}>
          Réinitialiser
        </Button>
      }
    >
      <div className="map-filter-modal__section">
        <h3 className="map-filter-modal__section-title">Envie de faire</h3>
        <div className="map-filter-modal__chips">
          <Chip tone="gold" icon="flag" active={wishlistOnly} count={wishlistCount} onClick={onToggleWishlist}>
            Envie de faire
          </Chip>
        </div>
      </div>

      <div className="map-filter-modal__section">
        <h3 className="map-filter-modal__section-title">Planification</h3>
        <div className="map-filter-modal__chips">
          <Chip tone="indigo" icon="calendar" active={plannedOnly} count={plannedCount} onClick={onTogglePlanned}>
            Planifiées
          </Chip>
        </div>
      </div>

      <div className="map-filter-modal__section">
        <h3 className="map-filter-modal__section-title">Catégories</h3>
        <div className="map-filter-modal__chips">
          {categories.map((category) => (
            <Chip
              key={category}
              tone="category"
              category={category}
              active={visibleCategories.has(category)}
              count={categoryCounts[category]}
              onClick={() => onToggleCategory(category)}
            >
              {categoryLabels[category]}
            </Chip>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
