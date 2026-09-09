import { useMemo, useState } from 'react'
import type { Resource, Trip } from '../types/trip'
import ResourceFormModal from './ResourceFormModal'
import Icon from './ui/Icon'
import Button from './ui/Button'

interface ResourcesViewProps {
  trip: Trip
  onAddResource: (input: Omit<Resource, 'id'>) => Promise<void>
  onUpdateResource: (id: string, patch: Omit<Resource, 'id'>) => Promise<void>
  onDeleteResource: (id: string) => Promise<void>
}

type ModalState = { mode: 'create' } | { mode: 'edit'; resource: Resource } | null

export default function ResourcesView({ trip, onAddResource, onUpdateResource, onDeleteResource }: ResourcesViewProps) {
  const [modal, setModal] = useState<ModalState>(null)

  const resources = useMemo(() => trip.resources ?? [], [trip.resources])
  const generic = useMemo(() => resources.filter((r) => !r.stageId), [resources])

  const byStage = useMemo(() => {
    const sortedStages = [...trip.stages].sort((a, b) => a.order - b.order)
    return sortedStages
      .map((stage) => ({ stage, resources: resources.filter((r) => r.stageId === stage.id) }))
      .filter((group) => group.resources.length > 0)
  }, [trip.stages, resources])

  async function handleDelete(resource: Resource) {
    if (!window.confirm(`Supprimer "${resource.label}" ?`)) return
    try {
      await onDeleteResource(resource.id)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  function renderResource(resource: Resource) {
    return (
      <div className="resource-card" key={resource.id}>
        <div className="resource-card__main">
          {resource.icon && <span className="resource-card__icon">{resource.icon}</span>}
          <div className="resource-card__text">
            <a className="resource-card__link" href={resource.url} target="_blank" rel="noopener">
              {resource.label}
            </a>
            {resource.description && <p className="resource-card__description">{resource.description}</p>}
          </div>
        </div>
        <div className="resource-card__actions">
          <Button iconOnly variant="ghost" size="sm" icon="edit" aria-label="Modifier" onClick={() => setModal({ mode: 'edit', resource })} />
          <Button iconOnly variant="ghost" size="sm" icon="trash" aria-label="Supprimer" onClick={() => handleDelete(resource)} />
        </div>
      </div>
    )
  }

  return (
    <div className="resources">
      <div className="resources__list">
        {resources.length === 0 && <p className="activities__empty">Aucune ressource pour l'instant.</p>}

        {generic.length > 0 && (
          <section className="activities__group">
            <h2 className="activities__group-title">
              <span>Général</span>
              <span className="activities__group-count">({generic.length})</span>
            </h2>
            {generic.map(renderResource)}
          </section>
        )}

        {byStage.map(({ stage, resources: stageResources }) => (
          <section key={stage.id} className="activities__group">
            <h2 className="activities__group-title">
              <span>{stage.city}</span>
              <span className="activities__group-count">({stageResources.length})</span>
            </h2>
            {stageResources.map(renderResource)}
          </section>
        ))}
      </div>

      <button type="button" className="activities__fab" aria-label="Ajouter une ressource" onClick={() => setModal({ mode: 'create' })}>
        <Icon name="plus" size={24} />
      </button>

      {modal && (
        <ResourceFormModal
          mode={modal.mode}
          resource={modal.mode === 'edit' ? modal.resource : undefined}
          stages={trip.stages}
          onClose={() => setModal(null)}
          onSubmit={modal.mode === 'create' ? onAddResource : (input) => onUpdateResource(modal.resource.id, input)}
        />
      )}
    </div>
  )
}
