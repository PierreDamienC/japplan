import { useState } from 'react'
import type { Resource, Stage } from '../types/trip'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface ResourceFormModalProps {
  mode: 'create' | 'edit'
  resource?: Resource
  stages: Stage[]
  onSubmit: (input: Omit<Resource, 'id'>) => Promise<void>
  onClose: () => void
}

export default function ResourceFormModal({ mode, resource, stages, onSubmit, onClose }: ResourceFormModalProps) {
  const [label, setLabel] = useState(resource?.label ?? '')
  const [url, setUrl] = useState(resource?.url ?? '')
  const [stageId, setStageId] = useState(resource?.stageId ?? '')
  const [icon, setIcon] = useState(resource?.icon ?? '')
  const [description, setDescription] = useState(resource?.description ?? '')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!label.trim()) return setError('Le libellé est obligatoire.')
    if (!url.trim().startsWith('http')) return setError('Le lien doit être une URL valide.')

    setSubmitting(true)
    try {
      await onSubmit({
        label: label.trim(),
        url: url.trim(),
        stageId: stageId || undefined,
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      as="form"
      title={mode === 'create' ? 'Ajouter une ressource' : 'Modifier la ressource'}
      onSubmit={handleSubmit}
      onClose={onClose}
      error={error}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="primary" block type="submit" loading={submitting} loadingLabel="Enregistrement…">
            {mode === 'create' ? 'Ajouter' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <Field label="Libellé">
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </Field>

      <Field label="Icône (emoji)">
        <input type="text" inputMode="text" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🚄" maxLength={8} />
      </Field>

      <Field label="Lien">
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
      </Field>

      <Field label="Description (1-2 phrases)">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      <Field label="Étape">
        <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
          <option value="">Générique (toutes les étapes)</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.city}
            </option>
          ))}
        </select>
      </Field>
    </Sheet>
  )
}
