import { useEffect, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import MapView from './components/MapView'
import PlanningView from './components/PlanningView'
import ActivitiesView from './components/ActivitiesView'
import ResourcesView from './components/ResourcesView'
import SettingsModal from './components/SettingsModal'
import TripFormModal from './components/TripFormModal'
import { useDatabase } from './hooks/useDatabase'
import { useOfflineMap } from './hooks/useOfflineMap'
import { useTheme } from './hooks/useTheme'
import { closeTopModal } from './utils/backButtonStack'

type Tab = 'map' | 'timeline' | 'activities' | 'resources'
type TripModalState = { mode: 'create' } | { mode: 'edit' } | null

function App() {
  const [tab, setTab] = useState<Tab>('map')
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [focusStageId, setFocusStageId] = useState<string | null>(null)
  const [focusActivityId, setFocusActivityId] = useState<string | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [tripModal, setTripModal] = useState<TripModalState>(null)

  // Sans ça, le bouton retour matériel Android quitte l'app dès qu'aucun
  // historique web n'existe — ce qui inclut nos modales, gérées en state
  // React et non en navigation. On ferme la modale du dessus (backButtonStack)
  // au lieu de quitter, et on ne reproduit le comportement natif (exitApp)
  // que si aucune modale n'est ouverte.
  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', () => {
      if (!closeTopModal()) CapacitorApp.exitApp()
    })
    return () => {
      listener.then((l) => l.remove())
    }
  }, [])

  const { themePref, resolvedTheme, setThemePref } = useTheme()

  const db = useDatabase()
  const {
    trips,
    selectedTripId,
    selectedTrip,
    status: databaseStatus,
    error: databaseError,
    saveError: databaseSaveError,
    recentlySynced: databaseRecentlySynced,
    fileName: databaseFileName,
  } = db

  const {
    status: offlineMapStatus,
    error: offlineMapError,
    fileUri: offlineMapUri,
    fileName: offlineMapFileName,
    mode: mapMode,
    connectMap,
    setMode: setMapMode,
  } = useOfflineMap()

  // Le mode "hors ligne" n'est réellement appliqué que si une carte est bien
  // connectée — sinon on reste sur le style en ligne (cohérent avec la bascule
  // désactivée dans SettingsModal tant qu'aucun fichier n'est connecté).
  const mapOffline = mapMode === 'offline' && offlineMapStatus === 'ready'

  // Une sélection/focus venant du voyage précédent n'a plus de sens une fois
  // qu'on a changé de voyage (id potentiellement même réutilisé par coïncidence,
  // mais les données pointées sont différentes).
  useEffect(() => {
    setSelectedStageId(null)
    setSelectedActivityId(null)
    setFocusStageId(null)
    setFocusActivityId(null)
  }, [selectedTripId])

  const tripId = selectedTripId

  // Toutes les mutations sont scopées au voyage sélectionné — ces wrappers
  // évitent de faire remonter tripId dans chaque composant enfant (qui n'a
  // sinon aucune raison de le connaître, cf. PlanningView/ActivitiesView).
  function withTrip<A extends unknown[], R>(fn: (tripId: string, ...args: A) => Promise<R>) {
    return (...args: A) => {
      if (!tripId) return Promise.reject(new Error('Aucun voyage sélectionné.'))
      return fn(tripId, ...args)
    }
  }

  const addActivity = withTrip(db.addActivity)
  const updateActivity = withTrip(db.updateActivity)
  const deleteActivity = withTrip(db.deleteActivity)
  const addResource = withTrip(db.addResource)
  const updateResource = withTrip(db.updateResource)
  const deleteResource = withTrip(db.deleteResource)
  const addStage = withTrip(db.addStage)
  const updateStage = withTrip(db.updateStage)
  const deleteStage = withTrip(db.deleteStage)
  const moveStage = withTrip(db.moveStage)
  const addAccommodation = withTrip(db.addAccommodation)
  const updateAccommodation = withTrip(db.updateAccommodation)
  const deleteAccommodation = withTrip(db.deleteAccommodation)
  const addExcursion = withTrip(db.addExcursion)
  const updateExcursion = withTrip(db.updateExcursion)
  const deleteExcursion = withTrip(db.deleteExcursion)
  const addArrivalLeg = withTrip(db.addArrivalLeg)
  const updateArrivalLeg = withTrip(db.updateArrivalLeg)
  const deleteArrivalLeg = withTrip(db.deleteArrivalLeg)
  const addDepartureLeg = withTrip(db.addDepartureLeg)
  const updateDepartureLeg = withTrip(db.updateDepartureLeg)
  const deleteDepartureLeg = withTrip(db.deleteDepartureLeg)

  function handleSelectStage(stageId: string) {
    setSelectedActivityId(null)
    setSelectedStageId(stageId)
    setTab('map')
  }

  function handleSelectActivity(activityId: string) {
    setSelectedStageId(null)
    setSelectedActivityId(activityId)
    setTab('map')
  }

  function handleGoToStage(stageId: string) {
    setFocusActivityId(null)
    setFocusStageId(stageId)
    setTab('timeline')
  }

  function handleGoToActivity(activityId: string) {
    setFocusStageId(null)
    setFocusActivityId(activityId)
    setTab('activities')
  }

  const loading = databaseStatus === 'loading' || offlineMapStatus === 'loading'
  const hasTrip = databaseStatus === 'ready' && selectedTrip !== null

  return (
    <div className="app">
      <header className="app__header">
        {databaseStatus === 'ready' && trips.length > 0 && selectedTrip ? (
          <div className="app__trip-picker">
            <select
              value={selectedTrip.id}
              onChange={(e) => (e.target.value === '__new__' ? setTripModal({ mode: 'create' }) : db.selectTrip(e.target.value))}
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="__new__">➕ Nouveau voyage…</option>
            </select>
            <button
              type="button"
              className="offline-map-icon-btn"
              aria-label="Modifier le voyage"
              onClick={() => setTripModal({ mode: 'edit' })}
            >
              ✏
            </button>
          </div>
        ) : databaseStatus === 'ready' ? (
          <div className="app__trip-picker app__trip-picker--empty">
            <span>Aucun voyage —</span>
            <button type="button" className="app__trip-picker-link" onClick={() => setTripModal({ mode: 'create' })}>
              en créer un
            </button>
          </div>
        ) : (
          <span className="app__trip-picker app__trip-picker--empty">
            {databaseStatus === 'loading' ? 'Chargement…' : 'Aucun voyage connecté — ⚙ pour connecter un fichier'}
          </span>
        )}
        <button
          type="button"
          className={
            databaseSaveError
              ? 'offline-map-icon-btn offline-map-icon-btn--alert'
              : 'offline-map-icon-btn'
          }
          aria-label={databaseSaveError ? 'Paramètres — sauvegarde échouée' : 'Paramètres'}
          onClick={() => setSettingsModalOpen(true)}
        >
          ⚙
        </button>
      </header>

      <main className="app__content">
        {loading && <div className="app__loading">Chargement…</div>}
        {!loading && !hasTrip && (
          <div className="connect-drive-file">
            <p>
              {databaseStatus === 'ready'
                ? 'Aucun voyage.'
                : databaseStatus === 'no-file'
                  ? 'Aucun fichier de voyages connecté.'
                  : `Erreur de lecture du fichier : ${databaseError}`}
            </p>
            <p className="connect-drive-file__hint">
              {databaseStatus === 'ready'
                ? 'Crée ton premier voyage depuis le header.'
                : 'Connecte-le depuis les Paramètres (⚙, en haut).'}
            </p>
          </div>
        )}
        {!loading && hasTrip && tab === 'map' && (
          <MapView
            key={`${mapOffline}-${resolvedTheme}-${selectedTrip.id}`}
            trip={selectedTrip}
            selectedStageId={selectedStageId}
            selectedActivityId={selectedActivityId}
            offline={mapOffline}
            offlineMapUri={offlineMapUri}
            theme={resolvedTheme}
            onGoToStage={handleGoToStage}
            onGoToActivity={handleGoToActivity}
          />
        )}
        {!loading && hasTrip && tab === 'timeline' && (
          <PlanningView
            trip={selectedTrip}
            onSelectStage={handleSelectStage}
            focusStageId={focusStageId}
            activitiesStatus={databaseStatus}
            onUpdateActivity={updateActivity}
            onAddStage={addStage}
            onUpdateStage={updateStage}
            onDeleteStage={deleteStage}
            onMoveStage={moveStage}
            onAddAccommodation={addAccommodation}
            onUpdateAccommodation={updateAccommodation}
            onDeleteAccommodation={deleteAccommodation}
            onAddExcursion={addExcursion}
            onUpdateExcursion={updateExcursion}
            onDeleteExcursion={deleteExcursion}
            onAddArrivalLeg={addArrivalLeg}
            onUpdateArrivalLeg={updateArrivalLeg}
            onDeleteArrivalLeg={deleteArrivalLeg}
            onAddDepartureLeg={addDepartureLeg}
            onUpdateDepartureLeg={updateDepartureLeg}
            onDeleteDepartureLeg={deleteDepartureLeg}
          />
        )}
        {!loading && hasTrip && tab === 'activities' && (
          <ActivitiesView
            trip={selectedTrip}
            onSelectActivity={handleSelectActivity}
            focusActivityId={focusActivityId}
            activitiesStatus={databaseStatus}
            activitiesError={databaseError}
            onAddActivity={addActivity}
            onUpdateActivity={updateActivity}
            onDeleteActivity={deleteActivity}
          />
        )}
        {!loading && hasTrip && tab === 'resources' && (
          <ResourcesView
            trip={selectedTrip}
            onAddResource={addResource}
            onUpdateResource={updateResource}
            onDeleteResource={deleteResource}
          />
        )}
      </main>

      <nav className="tab-bar">
        <button
          type="button"
          className={tab === 'map' ? 'tab-bar__button tab-bar__button--active' : 'tab-bar__button'}
          onClick={() => setTab('map')}
        >
          Carte
        </button>
        <button
          type="button"
          className={tab === 'timeline' ? 'tab-bar__button tab-bar__button--active' : 'tab-bar__button'}
          onClick={() => setTab('timeline')}
        >
          Planning
        </button>
        <button
          type="button"
          className={tab === 'activities' ? 'tab-bar__button tab-bar__button--active' : 'tab-bar__button'}
          onClick={() => setTab('activities')}
        >
          Activités
        </button>
        <button
          type="button"
          className={tab === 'resources' ? 'tab-bar__button tab-bar__button--active' : 'tab-bar__button'}
          onClick={() => setTab('resources')}
        >
          Ressources
        </button>
      </nav>

      {settingsModalOpen && (
        <SettingsModal
          themePref={themePref}
          resolvedTheme={resolvedTheme}
          onSetThemePref={setThemePref}
          databaseStatus={databaseStatus}
          databaseError={databaseError}
          databaseSaveError={databaseSaveError}
          databaseRecentlySynced={databaseRecentlySynced}
          onRetrySave={db.retrySave}
          databaseFileName={databaseFileName}
          onConnectDatabaseFile={db.connectFile}
          mapStatus={offlineMapStatus}
          mapError={offlineMapError}
          mapFileName={offlineMapFileName}
          mode={mapMode}
          onConnectMap={connectMap}
          onSetMode={setMapMode}
          onClose={() => setSettingsModalOpen(false)}
        />
      )}

      {tripModal && (
        <TripFormModal
          mode={tripModal.mode}
          trip={tripModal.mode === 'edit' && selectedTrip ? selectedTrip : undefined}
          onSubmit={(input) => (tripModal.mode === 'create' ? db.addTrip(input).then(() => {}) : db.updateTrip(selectedTrip!.id, input))}
          onDelete={tripModal.mode === 'edit' && selectedTrip ? () => db.deleteTrip(selectedTrip.id) : undefined}
          onClose={() => setTripModal(null)}
        />
      )}
    </div>
  )
}

export default App
