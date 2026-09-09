import { useState } from 'react'
import type { DatabaseStatus } from '../hooks/useDatabase'
import type { MapMode } from '../data/offlineMapRepository'
import type { OfflineMapStatus } from '../hooks/useOfflineMap'
import type { ThemePref } from '../theme/theme'
import type { ResolvedTheme } from '../theme/categories'
import Sheet from './ui/Sheet'
import Button from './ui/Button'
import Icon from './ui/Icon'

interface SettingsModalProps {
  themePref: ThemePref
  resolvedTheme: ResolvedTheme
  onSetThemePref: (pref: ThemePref) => Promise<void>
  databaseStatus: DatabaseStatus
  databaseError?: string
  // Distinct de databaseError (échec de lecture/connexion, cf. useDatabase) :
  // une écriture ratée n'y touche plus — voir persist() dans useDatabase.ts.
  databaseSaveError?: string
  // Bascule brièvement à true après qu'un changement distant (poll) ou un rebase
  // d'écriture a mis à jour l'état local — voir useDatabase.ts.
  databaseRecentlySynced?: boolean
  onRetrySave: () => Promise<void>
  databaseFileName?: string
  onConnectDatabaseFile: () => Promise<void>
  mapStatus: OfflineMapStatus
  mapError?: string
  mapFileName?: string
  mode: MapMode
  onConnectMap: () => Promise<void>
  onSetMode: (mode: MapMode) => Promise<void>
  onClose: () => void
}

export default function SettingsModal({
  themePref,
  resolvedTheme,
  onSetThemePref,
  databaseStatus,
  databaseError,
  databaseSaveError,
  databaseRecentlySynced,
  onRetrySave,
  databaseFileName,
  onConnectDatabaseFile,
  mapStatus,
  mapError,
  mapFileName,
  mode,
  onConnectMap,
  onSetMode,
  onClose,
}: SettingsModalProps) {
  const databaseConnected = databaseStatus === 'ready'
  const mapConnected = mapStatus === 'ready'
  const [retrying, setRetrying] = useState(false)

  async function handleRetrySave() {
    setRetrying(true)
    try {
      await onRetrySave()
    } catch {
      // L'échec reste porté par databaseSaveError, déjà affiché ci-dessous.
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Sheet
      title="Paramètres"
      onClose={onClose}
      tall
      footer={
        <Button variant="secondary" block onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <section className="settings-section">
        <h2>Apparence</h2>

        <div className="segmented">
          <button
            type="button"
            className={themePref === 'auto' ? 'segmented__button segmented__button--active' : 'segmented__button'}
            onClick={() => onSetThemePref('auto')}
          >
            Auto
          </button>
          <button
            type="button"
            className={themePref === 'light' ? 'segmented__button segmented__button--active' : 'segmented__button'}
            onClick={() => onSetThemePref('light')}
          >
            Clair
          </button>
          <button
            type="button"
            className={themePref === 'dark' ? 'segmented__button segmented__button--active' : 'segmented__button'}
            onClick={() => onSetThemePref('dark')}
          >
            Sombre
          </button>
        </div>

        {themePref === 'auto' && (
          <p className="settings-status">Suit le thème {resolvedTheme === 'dark' ? 'sombre' : 'clair'} du téléphone.</p>
        )}
      </section>

      <section className="settings-section">
        <h2>Base de voyages</h2>

        <p className="settings-status">
          {databaseConnected && `Fichier connecté : ${databaseFileName}`}
          {databaseConnected && databaseRecentlySynced && ' — mis à jour'}
          {databaseStatus === 'no-file' && !databaseError && 'Aucun fichier de voyages connecté.'}
          {databaseError}
          {databaseStatus === 'loading' && 'Chargement…'}
        </p>

        <Button variant="secondary" block onClick={onConnectDatabaseFile}>
          {databaseConnected ? 'Changer le fichier' : 'Choisir le fichier Google Drive'}
        </Button>

        {databaseSaveError && (
          <>
            {/* Affiché ici plutôt que via la prop `error` de Sheet (comme pour
                les autres modales) : le footer de Sheet est en position:sticky
                avec un fond opaque, et recouvrait ce message dès que le
                contenu de cette modale dépassait la hauteur visible — bug
                repéré en testant l'échec de sauvegarde, voir Sheet.tsx. */}
            <p className="sheet__error" role="alert">
              <Icon name="alert" size={16} />
              {databaseSaveError}
            </p>
            <Button variant="primary" block onClick={handleRetrySave} loading={retrying} loadingLabel="Nouvel essai…">
              Réessayer la sauvegarde
            </Button>
          </>
        )}
      </section>

      <section className="settings-section">
        <h2>Carte hors ligne</h2>

        <div className="segmented">
          <button
            type="button"
            className={mode === 'online' ? 'segmented__button segmented__button--active' : 'segmented__button'}
            onClick={() => onSetMode('online')}
          >
            En ligne
          </button>
          <button
            type="button"
            className={mode === 'offline' ? 'segmented__button segmented__button--active' : 'segmented__button'}
            onClick={() => onSetMode('offline')}
            disabled={!mapConnected}
          >
            Hors ligne
          </button>
        </div>

        <p className="settings-status">
          {mapConnected && `Carte connectée : ${mapFileName}`}
          {mapStatus === 'no-file' && !mapError && 'Aucune carte connectée.'}
          {mapError}
          {mapStatus === 'loading' && 'Chargement…'}
        </p>

        <Button variant="secondary" block onClick={onConnectMap}>
          {mapConnected ? 'Changer le fichier' : 'Connecter la carte'}
        </Button>

        <p className="settings-hint">
          Pour que le mode hors ligne fonctionne vraiment sans réseau (avion, zone blanche), marque ce fichier{' '}
          <strong>Disponible hors connexion</strong> dans l'app Google Drive elle-même.
        </p>
      </section>
    </Sheet>
  )
}
