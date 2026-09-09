import { useState } from 'react'
import type { Activity, ActivityCategory, Stage } from '../types/trip'
import { categoryLabels, ALL_CATEGORIES as CATEGORIES } from '../theme/categories'
import CoordinatesField from './CoordinatesField'
import Sheet from './ui/Sheet'
import Field from './ui/Field'
import Button from './ui/Button'

interface ActivityFormModalProps {
  mode: 'create' | 'edit'
  activity?: Activity
  stages: Stage[]
  onSubmit: (input: Omit<Activity, 'id'>) => Promise<void>
  onClose: () => void
}

export default function ActivityFormModal({ mode, activity, stages, onSubmit, onClose }: ActivityFormModalProps) {
  const [name, setName] = useState(activity?.name ?? '')
  const [category, setCategory] = useState<ActivityCategory>(activity?.category ?? CATEGORIES[0])
  const [stageId, setStageId] = useState(activity?.stageId ?? '')
  const [stageGroup, setStageGroup] = useState(activity?.stageGroup ?? '')
  const [mapsUrl, setMapsUrl] = useState(activity?.mapsUrl ?? '')
  const [time, setTime] = useState(activity?.time ?? '')
  const [endTime, setEndTime] = useState(activity?.endTime ?? '')
  const [hours, setHours] = useState(activity?.hours ?? '')
  const [notes, setNotes] = useState(activity?.notes ?? '')
  const [lat, setLat] = useState(activity?.coordinates ? String(activity.coordinates.lat) : '')
  const [lng, setLng] = useState(activity?.coordinates ? String(activity.coordinates.lng) : '')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  function handleStageChange(newStageId: string) {
    setStageId(newStageId)
    if (!stageGroup) {
      const stage = stages.find((s) => s.id === newStageId)
      if (stage) setStageGroup(stage.city)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)

    if (!name.trim()) return setError('Le nom est obligatoire.')
    if (!mapsUrl.trim().startsWith('http')) return setError('Le lien Google Maps doit être une URL valide.')
    if (!stageGroup.trim()) return setError("L'étape (groupe d'affichage) est obligatoire.")
    if ((lat.trim() === '') !== (lng.trim() === '')) {
      return setError('Renseigne latitude ET longitude, ou aucune des deux.')
    }
    if (endTime && !time) return setError('Une heure de fin nécessite une heure de début.')
    if (endTime && time && endTime <= time) return setError("L'heure de fin doit être après l'heure de début.")
    const parsedLat = lat.trim() ? Number(lat) : undefined
    const parsedLng = lng.trim() ? Number(lng) : undefined
    if ((parsedLat !== undefined && Number.isNaN(parsedLat)) || (parsedLng !== undefined && Number.isNaN(parsedLng))) {
      return setError('Coordonnées invalides.')
    }

    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        category,
        stageGroup: stageGroup.trim(),
        stageId: stageId || undefined,
        mapsUrl: mapsUrl.trim(),
        time: time || undefined,
        endTime: endTime || undefined,
        hours: hours.trim() || undefined,
        notes: notes.trim() || undefined,
        coordinates: parsedLat !== undefined && parsedLng !== undefined ? { lat: parsedLat, lng: parsedLng } : undefined,
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
      title={mode === 'create' ? 'Ajouter une activité' : "Modifier l'activité"}
      onSubmit={handleSubmit}
      onClose={onClose}
      error={error}
      tall
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
      <Field label="Nom">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="Catégorie">
        <select value={category} onChange={(e) => setCategory(e.target.value as ActivityCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Étape">
        <select value={stageId} onChange={(e) => handleStageChange(e.target.value)}>
          <option value="">— aucune —</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.city}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Groupe d'affichage">
        <input type="text" value={stageGroup} onChange={(e) => setStageGroup(e.target.value)} required />
      </Field>

      <Field label="Lien Google Maps">
        <input type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} required />
      </Field>

      <Field label="Heure prévue">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>

      <Field label="Heure de fin (optionnelle)" hint="Pour bloquer un créneau sur la frise plutôt qu'un simple point.">
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </Field>

      <Field label="Horaires d'ouverture">
        <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} />
      </Field>

      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Field>

      <CoordinatesField
        legend="Position"
        lat={lat}
        lng={lng}
        onChange={(newLat, newLng) => {
          setLat(newLat)
          setLng(newLng)
        }}
      />
    </Sheet>
  )
}
