import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import type { Accommodation, Activity, Excursion, Resource, Stage, TransportLeg, Trip } from '../types/trip'
import {
  AccessRevokedError,
  NoFileSelectedError,
  ParseError,
  ReadError,
  SchemaTooNewError,
  connectFile as pickAndConnectFile,
  fetchRemoteDatabase,
  getRemoteVersion,
  loadDatabase,
  saveDatabase,
  type ConnectedFile,
} from '../data/databaseRepository'
import { uniqueId } from '../utils/activityId'

// Intervalle du polling léger de fraîcheur (voir l'effet plus bas) — vérification
// de métadonnée seule, jamais de retéléchargement tant que rien n'a changé.
const POLL_INTERVAL_MS = 15_000

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
  // Passe brièvement à true après qu'un changement distant (poll) ou un rebase
  // d'écriture a mis à jour l'état local — feedback discret dans SettingsModal.
  recentlySynced: boolean
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
  const [recentlySynced, setRecentlySynced] = useState(false)
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
  // File des transformations locales pas encore confirmées écrites — rejouée sur
  // le contenu distant frais en cas de rebase (voir runWriteLoop). `baseVersionRef`
  // est la version distante sur laquelle `latestTripsRef.current` est actuellement
  // fondé (mise à jour au chargement, avant un rebase, et après chaque écriture
  // réussie) ; `null` signifie "inconnue", ce qui force un rebase (inoffensif) à la
  // prochaine écriture plutôt que de risquer d'écraser un changement distant.
  const pendingTransformsRef = useRef<Array<(current: Trip[]) => Trip[]>>([])
  const baseVersionRef = useRef<string | null>(null)
  const appForegroundRef = useRef(true)

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(undefined)
    setSaveError(undefined)
    try {
      const { database, file, version } = await loadDatabase()
      fileRef.current = file
      setFileName(file.name)
      setTrips(database.trips)
      latestTripsRef.current = database.trips
      baseVersionRef.current = version
      pendingTransformsRef.current = []
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
      if (e instanceof ParseError || e instanceof ReadError || e instanceof SchemaTooNewError) {
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

  // Polling léger de fraîcheur en lecture : tant que l'app/l'onglet est au premier
  // plan, revérifie toutes les POLL_INTERVAL_MS si le fichier distant a changé
  // (métadonnée seule) — et un check immédiat en plus au retour au premier plan,
  // pour ne pas attendre jusqu'à 15s après avoir rouvert l'app. Ne fait rien s'il y
  // a une écriture en vol ou des mutations locales en attente : dans ce cas, c'est
  // runWriteLoop (rebase à l'écriture) qui gère la fraîcheur, pas ce polling — sinon
  // on risquerait d'écraser une modification locale pas encore écrite.
  useEffect(() => {
    if (status !== 'ready') return

    let cancelled = false

    async function checkForRemoteChanges() {
      const file = fileRef.current
      if (!file) return
      if (writeLoopRef.current || pendingTransformsRef.current.length > 0) return
      try {
        const remoteVersion = await getRemoteVersion(file)
        if (cancelled || remoteVersion === baseVersionRef.current) return
        const database = await fetchRemoteDatabase(file)
        if (cancelled) return
        // Revérifié après le fetch (fenêtre async) : si une mutation locale est
        // arrivée entretemps, on laisse la main à runWriteLoop plutôt que
        // d'écraser un edit local avec le contenu distant.
        if (writeLoopRef.current || pendingTransformsRef.current.length > 0) return
        setTrips(database.trips)
        latestTripsRef.current = database.trips
        baseVersionRef.current = remoteVersion
        setRecentlySynced(true)
      } catch {
        // Échec de poll (réseau transitoire, etc.) — jamais surfacé via saveError,
        // ce n'est pas un échec d'écriture.
      }
    }

    function isForegrounded() {
      return Capacitor.isNativePlatform() ? appForegroundRef.current : document.visibilityState === 'visible'
    }

    const timer = setInterval(() => {
      if (isForegrounded()) checkForRemoteChanges()
    }, POLL_INTERVAL_MS)

    const cleanups: Array<() => void> = []
    if (Capacitor.isNativePlatform()) {
      const sub = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        appForegroundRef.current = isActive
        if (isActive) checkForRemoteChanges()
      })
      cleanups.push(() => {
        sub.then((s) => s.remove())
      })
    } else {
      const onVisible = () => {
        if (document.visibilityState === 'visible') checkForRemoteChanges()
      }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
      cleanups.push(() => {
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('focus', onVisible)
      })
    }

    return () => {
      cancelled = true
      clearInterval(timer)
      cleanups.forEach((c) => c())
    }
  }, [status])

  useEffect(() => {
    if (!recentlySynced) return
    const t = setTimeout(() => setRecentlySynced(false), 4000)
    return () => clearTimeout(t)
  }, [recentlySynced])

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
  //
  // Avant chaque écriture, on revérifie la version distante. Si elle correspond à
  // `baseVersionRef`, rien n'a changé côté Drive depuis notre dernière lecture/
  // écriture connue : on écrit directement, comme avant cette fonctionnalité. Si
  // elle diffère, quelqu'un d'autre a écrit entre-temps — écrire tel quel
  // `latestTripsRef.current` (fondé sur une base qu'on sait périmée) écraserait ce
  // changement. On relit alors le contenu distant frais et on rejoue nos
  // transformations en attente dessus (rebase) avant d'écrire le résultat fusionné.
  const runWriteLoop = useCallback((file: ConnectedFile): Promise<void> => {
    const loop = (async () => {
      try {
        for (;;) {
          pendingWriteRef.current = false
          const pendingCount = pendingTransformsRef.current.length

          let remoteVersion: string | null
          try {
            remoteVersion = await getRemoteVersion(file)
          } catch {
            // Le check léger échoue silencieusement (offline, etc.) — on retombe
            // sur baseVersionRef pour forcer le chemin "pas de changement détecté"
            // et écrire directement : jamais pire que l'absence totale de
            // détection de conflit qui existait avant cette fonctionnalité.
            remoteVersion = baseVersionRef.current
          }

          if (remoteVersion !== baseVersionRef.current) {
            // Ce refetch, contrairement au check léger ci-dessus, ne doit PAS
            // échouer silencieusement : on n'a pas le droit d'écrire une base
            // qu'on sait périmée. Un échec ici propage vers le catch englobant,
            // traité comme n'importe quel échec d'écriture (saveError/retrySave).
            const database = await fetchRemoteDatabase(file)
            const rebased = pendingTransformsRef.current
              .slice(0, pendingCount)
              .reduce((acc, fn) => fn(acc), database.trips)
            // Toute mutation arrivée pendant CE fetch a été empilée après l'index
            // pendingCount — on la laisse hors du rebase, la prochaine itération
            // (déclenchée par pendingWriteRef) la rejouera sur une base encore
            // plus fraîche.
            latestTripsRef.current = rebased
            setTrips(rebased)
            baseVersionRef.current = remoteVersion
            setRecentlySynced(true)
          }

          await saveDatabase(file, { trips: latestTripsRef.current })
          // Tout ce qui était en attente en début d'itération est maintenant
          // durablement écrit.
          pendingTransformsRef.current = pendingTransformsRef.current.slice(pendingCount)
          // Aucune des deux plateformes ne renvoie la nouvelle `modifiedTime` dans
          // la réponse d'écriture elle-même — un appel léger de plus l'établit.
          baseVersionRef.current = await getRemoteVersion(file).catch(() => baseVersionRef.current)

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
    (transform: (current: Trip[]) => Trip[]): Promise<Trip[]> => {
      const file = fileRef.current
      if (!file) return Promise.reject(new Error('Aucun fichier connecté.'))
      const next = transform(latestTripsRef.current)
      setTrips(next)
      latestTripsRef.current = next
      pendingTransformsRef.current.push(transform)
      pendingWriteRef.current = true
      const loop = writeLoopRef.current ?? runWriteLoop(file)
      // La boucle elle-même résout en Promise<void> (contrat inchangé, réutilisé
      // par retrySave) — persist ajoute par-dessus le Trip[] réellement persisté
      // (après rebase éventuel), utile aux appelants comme deleteTrip.
      return loop.then(() => latestTripsRef.current)
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
      // Généré une seule fois, hors du transform : contrairement à tous les autres
      // `add*` (dont l'id ne fuit jamais avant que persist() se résolve), celui-ci
      // est consommé immédiatement ci-dessous (selectTrip/valeur de retour), donc
      // il doit rester stable même si le transform est rejoué lors d'un rebase.
      const id = uniqueId(input.name, new Set(latestTripsRef.current.map((t) => t.id)))
      const trip: Trip = { ...input, id, stages: [] }
      await persist((current) =>
        // Garde-fou pour l'edge case rare d'une collision d'id (deux voyages créés
        // avec le même nom slugifié, de façon concurrente, dans la même fenêtre de
        // 15s) : on n'écrase jamais un item existant, on abandonne silencieusement
        // plutôt que de dupliquer l'id — cas jugé assez rare pour une appli à 2
        // personnes pour ne pas mériter plus.
        current.some((t) => t.id === id) ? current : [...current, trip],
      )
      selectTrip(id)
      return trip
    },
    [persist, selectTrip],
  )

  const updateTrip = useCallback(
    async (id: string, patch: Partial<Omit<Trip, 'id' | 'stages' | 'activities'>>) => {
      await persist((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    },
    [persist],
  )

  const deleteTrip = useCallback(
    async (id: string) => {
      const finalTrips = await persist((current) => current.filter((t) => t.id !== id))
      // Sélection basée sur ce qui a RÉELLEMENT été persisté (après rebase
      // éventuel), pas sur un `next` précalculé qui pourrait ne plus correspondre
      // si l'autre personne a modifié la liste entretemps.
      if (selectedTripId === id) selectTrip(finalTrips[0]?.id ?? '')
    },
    [persist, selectedTripId, selectTrip],
  )

  const updateTripInList = useCallback(
    async (tripId: string, fn: (trip: Trip) => Trip) => {
      await persist((current) => current.map((t) => (t.id === tripId ? fn(t) : t)))
    },
    [persist],
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
    recentlySynced,
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
