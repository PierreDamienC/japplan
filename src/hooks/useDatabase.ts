import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import type { Accommodation, Activity, Excursion, Resource, Stage, TransportLeg, Trip } from '../types/trip'
import {
  AccessRevokedError,
  NoFileSelectedError,
  ParseError,
  ReadError,
  connectFile as pickAndConnectFile,
  loadDatabase,
  saveDatabase,
  type ConnectedFile,
} from '../data/databaseRepository'
import { uniqueId } from '../utils/activityId'

export type DatabaseStatus = 'loading' | 'no-file' | 'error' | 'ready'

const SELECTED_TRIP_KEY = 'selectedTripId'

export interface UseDatabaseResult {
  trips: Trip[]
  selectedTripId: string | null
  selectedTrip: Trip | null
  status: DatabaseStatus
  error?: string
  fileName?: string
  // Distinct de `error` (réservé au chargement) : une écriture ratée ne doit
  // plus faire passer `status` à 'error' et éjecter l'app entière (voir
  // persist ci-dessous) — elle se signale ici, affichée via le ⚙ du header.
  saveError?: string
  retrySave: () => Promise<void>
  connectFile: () => Promise<void>
  selectTrip: (id: string) => void
  addTrip: (input: Omit<Trip, 'id' | 'stages'>) => Promise<Trip>
  updateTrip: (id: string, patch: Partial<Omit<Trip, 'id' | 'stages' | 'activities'>>) => Promise<void>
  deleteTrip: (id: string) => Promise<void>
  addStage: (tripId: string, input: Omit<Stage, 'id' | 'accommodations' | 'excursions'>) => Promise<void>
  updateStage: (tripId: string, stageId: string, patch: Partial<Omit<Stage, 'id'>>) => Promise<void>
  deleteStage: (tripId: string, stageId: string) => Promise<void>
  moveStage: (tripId: string, stageId: string, direction: 'up' | 'down') => Promise<void>
  addAccommodation: (tripId: string, stageId: string, input: Omit<Accommodation, 'id'>) => Promise<void>
  updateAccommodation: (
    tripId: string,
    stageId: string,
    accommodationId: string,
    patch: Partial<Omit<Accommodation, 'id'>>,
  ) => Promise<void>
  deleteAccommodation: (tripId: string, stageId: string, accommodationId: string) => Promise<void>
  addExcursion: (tripId: string, stageId: string, input: Omit<Excursion, 'id'>) => Promise<void>
  updateExcursion: (
    tripId: string,
    stageId: string,
    excursionId: string,
    patch: Partial<Omit<Excursion, 'id'>>,
  ) => Promise<void>
  deleteExcursion: (tripId: string, stageId: string, excursionId: string) => Promise<void>
  addArrivalLeg: (tripId: string, stageId: string, input: Omit<TransportLeg, 'id'>) => Promise<void>
  updateArrivalLeg: (
    tripId: string,
    stageId: string,
    legId: string,
    patch: Partial<Omit<TransportLeg, 'id'>>,
  ) => Promise<void>
  deleteArrivalLeg: (tripId: string, stageId: string, legId: string) => Promise<void>
  addDepartureLeg: (tripId: string, input: Omit<TransportLeg, 'id'>) => Promise<void>
  updateDepartureLeg: (tripId: string, legId: string, patch: Partial<Omit<TransportLeg, 'id'>>) => Promise<void>
  deleteDepartureLeg: (tripId: string, legId: string) => Promise<void>
  addActivity: (tripId: string, input: Omit<Activity, 'id'>) => Promise<void>
  updateActivity: (tripId: string, id: string, patch: Partial<Omit<Activity, 'id'>>) => Promise<void>
  deleteActivity: (tripId: string, id: string) => Promise<void>
  addResource: (tripId: string, input: Omit<Resource, 'id'>) => Promise<void>
  updateResource: (tripId: string, id: string, patch: Partial<Omit<Resource, 'id'>>) => Promise<void>
  deleteResource: (tripId: string, id: string) => Promise<void>
}

function mapStage(trip: Trip, stageId: string, fn: (stage: Stage) => Stage): Trip {
  return { ...trip, stages: trip.stages.map((s) => (s.id === stageId ? fn(s) : s)) }
}

export function useDatabase(): UseDatabaseResult {
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [status, setStatus] = useState<DatabaseStatus>('loading')
  const [error, setError] = useState<string>()
  const [saveError, setSaveError] = useState<string>()
  const [fileName, setFileName] = useState<string>()
  const fileRef = useRef<ConnectedFile | null>(null)
  // Un seul écrivain Drive à la fois, qui écrit toujours le DERNIER état
  // connu plutôt qu'un état capturé au moment de l'appel : si une mutation
  // arrive pendant qu'une écriture est en vol, elle n'en déclenche pas une
  // seconde en parallèle — elle marque `pendingWriteRef` et la boucle
  // existante la reprend juste après. Ça élimine la classe de bug où deux
  // écritures qui se chevauchent pouvaient faire diverger l'UI du fichier
  // (l'une restaurant un instantané antérieur à l'autre).
  const latestTripsRef = useRef<Trip[]>([])
  const pendingWriteRef = useRef(false)
  const writeLoopRef = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(undefined)
    setSaveError(undefined)
    try {
      const { database, file } = await loadDatabase()
      fileRef.current = file
      setFileName(file.name)
      setTrips(database.trips)
      latestTripsRef.current = database.trips
      const { value: storedId } = await Preferences.get({ key: SELECTED_TRIP_KEY })
      setSelectedTripId(
        storedId && database.trips.some((t) => t.id === storedId) ? storedId : (database.trips[0]?.id ?? null),
      )
      setStatus('ready')
    } catch (e) {
      if (e instanceof NoFileSelectedError) {
        setStatus('no-file')
        return
      }
      if (e instanceof AccessRevokedError) {
        setError("L'accès au fichier a été révoqué — reconnecte-le.")
        setStatus('no-file')
        return
      }
      if (e instanceof ParseError || e instanceof ReadError) {
        setError(e.message)
        setStatus('error')
        return
      }
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const connectFile = useCallback(async () => {
    setStatus('loading')
    setError(undefined)
    try {
      await pickAndConnectFile()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('no-file')
    }
  }, [refresh])

  const selectTrip = useCallback((id: string) => {
    setSelectedTripId(id)
    Preferences.set({ key: SELECTED_TRIP_KEY, value: id })
  }, [])

  // Boucle d'écriture : toujours re-lue via `latestTripsRef` au moment de
  // chaque tentative, jamais figée sur l'état capturé au lancement — c'est ce
  // qui permet à une mutation arrivée pendant une écriture d'être reprise par
  // le même passage plutôt que de partir en parallèle.
  const runWriteLoop = useCallback((file: ConnectedFile): Promise<void> => {
    const loop = (async () => {
      try {
        for (;;) {
          pendingWriteRef.current = false
          await saveDatabase(file, { trips: latestTripsRef.current })
          if (!pendingWriteRef.current) break
        }
        setSaveError(undefined)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e))
        throw e
      } finally {
        writeLoopRef.current = null
      }
    })()
    writeLoopRef.current = loop
    return loop
  }, [])

  const persist = useCallback(
    (next: Trip[]): Promise<void> => {
      const file = fileRef.current
      if (!file) return Promise.reject(new Error('Aucun fichier connecté.'))
      setTrips(next)
      latestTripsRef.current = next
      pendingWriteRef.current = true
      return writeLoopRef.current ?? runWriteLoop(file)
    },
    [runWriteLoop],
  )

  // Relance une écriture sur le dernier état connu, sans attendre une
  // nouvelle mutation — c'est le bouton "Réessayer" de SettingsModal.
  const retrySave = useCallback((): Promise<void> => {
    const file = fileRef.current
    if (!file) return Promise.resolve()
    if (writeLoopRef.current) return writeLoopRef.current
    pendingWriteRef.current = true
    return runWriteLoop(file)
  }, [runWriteLoop])

  const addTrip = useCallback(
    async (input: Omit<Trip, 'id' | 'stages'>) => {
      const previous = trips
      const id = uniqueId(input.name, new Set(previous.map((t) => t.id)))
      const trip: Trip = { ...input, id, stages: [] }
      await persist([...previous, trip])
      selectTrip(id)
      return trip
    },
    [trips, persist, selectTrip],
  )

  const updateTrip = useCallback(
    async (id: string, patch: Partial<Omit<Trip, 'id' | 'stages' | 'activities'>>) => {
      const previous = trips
      const next = previous.map((t) => (t.id === id ? { ...t, ...patch } : t))
      await persist(next)
    },
    [trips, persist],
  )

  const deleteTrip = useCallback(
    async (id: string) => {
      const previous = trips
      const next = previous.filter((t) => t.id !== id)
      await persist(next)
      if (selectedTripId === id) selectTrip(next[0]?.id ?? '')
    },
    [trips, persist, selectedTripId, selectTrip],
  )

  const updateTripInList = useCallback(
    async (tripId: string, fn: (trip: Trip) => Trip) => {
      const previous = trips
      const next = previous.map((t) => (t.id === tripId ? fn(t) : t))
      await persist(next)
    },
    [trips, persist],
  )

  const addStage = useCallback(
    async (tripId: string, input: Omit<Stage, 'id' | 'accommodations' | 'excursions'>) => {
      await updateTripInList(tripId, (trip) => {
        const id = uniqueId(input.city, new Set(trip.stages.map((s) => s.id)))
        const stage: Stage = { ...input, id, accommodations: [], excursions: [] }
        return { ...trip, stages: [...trip.stages, stage] }
      })
    },
    [updateTripInList],
  )

  const updateStage = useCallback(
    async (tripId: string, stageId: string, patch: Partial<Omit<Stage, 'id'>>) => {
      await updateTripInList(tripId, (trip) => mapStage(trip, stageId, (s) => ({ ...s, ...patch })))
    },
    [updateTripInList],
  )

  const deleteStage = useCallback(
    async (tripId: string, stageId: string) => {
      await updateTripInList(tripId, (trip) => ({ ...trip, stages: trip.stages.filter((s) => s.id !== stageId) }))
    },
    [updateTripInList],
  )

  const moveStage = useCallback(
    async (tripId: string, stageId: string, direction: 'up' | 'down') => {
      await updateTripInList(tripId, (trip) => {
        const sorted = [...trip.stages].sort((a, b) => a.order - b.order)
        const index = sorted.findIndex((s) => s.id === stageId)
        const swapIndex = direction === 'up' ? index - 1 : index + 1
        if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return trip
        const a = sorted[index]
        const b = sorted[swapIndex]
        const orders = { [a.id]: b.order, [b.id]: a.order } as Record<string, number>
        return { ...trip, stages: trip.stages.map((s) => (orders[s.id] !== undefined ? { ...s, order: orders[s.id] } : s)) }
      })
    },
    [updateTripInList],
  )

  const addAccommodation = useCallback(
    async (tripId: string, stageId: string, input: Omit<Accommodation, 'id'>) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => {
          const id = uniqueId(input.name, new Set(stage.accommodations.map((a) => a.id)))
          return { ...stage, accommodations: [...stage.accommodations, { ...input, id }] }
        }),
      )
    },
    [updateTripInList],
  )

  const updateAccommodation = useCallback(
    async (tripId: string, stageId: string, accommodationId: string, patch: Partial<Omit<Accommodation, 'id'>>) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => ({
          ...stage,
          accommodations: stage.accommodations.map((a) => (a.id === accommodationId ? { ...a, ...patch } : a)),
        })),
      )
    },
    [updateTripInList],
  )

  const deleteAccommodation = useCallback(
    async (tripId: string, stageId: string, accommodationId: string) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => ({
          ...stage,
          accommodations: stage.accommodations.filter((a) => a.id !== accommodationId),
        })),
      )
    },
    [updateTripInList],
  )

  const addExcursion = useCallback(
    async (tripId: string, stageId: string, input: Omit<Excursion, 'id'>) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => {
          const id = uniqueId(input.name, new Set(stage.excursions.map((e) => e.id)))
          return { ...stage, excursions: [...stage.excursions, { ...input, id }] }
        }),
      )
    },
    [updateTripInList],
  )

  const updateExcursion = useCallback(
    async (tripId: string, stageId: string, excursionId: string, patch: Partial<Omit<Excursion, 'id'>>) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => ({
          ...stage,
          excursions: stage.excursions.map((e) => (e.id === excursionId ? { ...e, ...patch } : e)),
        })),
      )
    },
    [updateTripInList],
  )

  const deleteExcursion = useCallback(
    async (tripId: string, stageId: string, excursionId: string) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => ({
          ...stage,
          excursions: stage.excursions.filter((e) => e.id !== excursionId),
        })),
      )
    },
    [updateTripInList],
  )

  const addArrivalLeg = useCallback(
    async (tripId: string, stageId: string, input: Omit<TransportLeg, 'id'>) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => {
          const id = uniqueId(`${input.from}-${input.to}`, new Set((stage.arrivalLegs ?? []).map((l) => l.id)))
          return { ...stage, arrivalLegs: [...(stage.arrivalLegs ?? []), { ...input, id }] }
        }),
      )
    },
    [updateTripInList],
  )

  const updateArrivalLeg = useCallback(
    async (tripId: string, stageId: string, legId: string, patch: Partial<Omit<TransportLeg, 'id'>>) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => ({
          ...stage,
          arrivalLegs: (stage.arrivalLegs ?? []).map((l) => (l.id === legId ? { ...l, ...patch } : l)),
        })),
      )
    },
    [updateTripInList],
  )

  const deleteArrivalLeg = useCallback(
    async (tripId: string, stageId: string, legId: string) => {
      await updateTripInList(tripId, (trip) =>
        mapStage(trip, stageId, (stage) => ({
          ...stage,
          arrivalLegs: (stage.arrivalLegs ?? []).filter((l) => l.id !== legId),
        })),
      )
    },
    [updateTripInList],
  )

  const addDepartureLeg = useCallback(
    async (tripId: string, input: Omit<TransportLeg, 'id'>) => {
      await updateTripInList(tripId, (trip) => {
        const id = uniqueId(`${input.from}-${input.to}`, new Set((trip.departureLegs ?? []).map((l) => l.id)))
        return { ...trip, departureLegs: [...(trip.departureLegs ?? []), { ...input, id }] }
      })
    },
    [updateTripInList],
  )

  const updateDepartureLeg = useCallback(
    async (tripId: string, legId: string, patch: Partial<Omit<TransportLeg, 'id'>>) => {
      await updateTripInList(tripId, (trip) => ({
        ...trip,
        departureLegs: (trip.departureLegs ?? []).map((l) => (l.id === legId ? { ...l, ...patch } : l)),
      }))
    },
    [updateTripInList],
  )

  const deleteDepartureLeg = useCallback(
    async (tripId: string, legId: string) => {
      await updateTripInList(tripId, (trip) => {
        const remaining = (trip.departureLegs ?? []).filter((l) => l.id !== legId)
        // `undefined` plutôt que `[]` une fois vide : dayPlan.ts/DayCard.tsx
        // traitent un `departureLegs` défini comme "il y a un trajet retour".
        return { ...trip, departureLegs: remaining.length > 0 ? remaining : undefined }
      })
    },
    [updateTripInList],
  )

  const addActivity = useCallback(
    async (tripId: string, input: Omit<Activity, 'id'>) => {
      await updateTripInList(tripId, (trip) => {
        const id = uniqueId(input.name, new Set((trip.activities ?? []).map((a) => a.id)))
        return { ...trip, activities: [...(trip.activities ?? []), { ...input, id }] }
      })
    },
    [updateTripInList],
  )

  const updateActivity = useCallback(
    async (tripId: string, id: string, patch: Partial<Omit<Activity, 'id'>>) => {
      await updateTripInList(tripId, (trip) => ({
        ...trip,
        activities: (trip.activities ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }))
    },
    [updateTripInList],
  )

  const deleteActivity = useCallback(
    async (tripId: string, id: string) => {
      await updateTripInList(tripId, (trip) => ({
        ...trip,
        activities: (trip.activities ?? []).filter((a) => a.id !== id),
      }))
    },
    [updateTripInList],
  )

  const addResource = useCallback(
    async (tripId: string, input: Omit<Resource, 'id'>) => {
      await updateTripInList(tripId, (trip) => {
        const id = uniqueId(input.label, new Set((trip.resources ?? []).map((r) => r.id)))
        return { ...trip, resources: [...(trip.resources ?? []), { ...input, id }] }
      })
    },
    [updateTripInList],
  )

  const updateResource = useCallback(
    async (tripId: string, id: string, patch: Partial<Omit<Resource, 'id'>>) => {
      await updateTripInList(tripId, (trip) => ({
        ...trip,
        resources: (trip.resources ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }))
    },
    [updateTripInList],
  )

  const deleteResource = useCallback(
    async (tripId: string, id: string) => {
      await updateTripInList(tripId, (trip) => ({
        ...trip,
        resources: (trip.resources ?? []).filter((r) => r.id !== id),
      }))
    },
    [updateTripInList],
  )

  const selectedTrip = useMemo(() => trips.find((t) => t.id === selectedTripId) ?? null, [trips, selectedTripId])

  return {
    trips,
    selectedTripId,
    selectedTrip,
    status,
    error,
    saveError,
    retrySave,
    fileName,
    connectFile,
    selectTrip,
    addTrip,
    updateTrip,
    deleteTrip,
    addStage,
    updateStage,
    deleteStage,
    moveStage,
    addAccommodation,
    updateAccommodation,
    deleteAccommodation,
    addExcursion,
    updateExcursion,
    deleteExcursion,
    addArrivalLeg,
    updateArrivalLeg,
    deleteArrivalLeg,
    addDepartureLeg,
    updateDepartureLeg,
    deleteDepartureLeg,
    addActivity,
    updateActivity,
    deleteActivity,
    addResource,
    updateResource,
    deleteResource,
  }
}
