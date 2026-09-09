import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { DriveFile } from '../plugins/DriveFile'

const URI_KEY = 'offlineMapUri'
const NAME_KEY = 'offlineMapName'
const MODE_KEY = 'mapMode'

export class NoFileSelectedError extends Error {}
export class AccessRevokedError extends Error {}

export interface ConnectedMapFile {
  uri: string
  name: string
}

export type MapMode = 'online' | 'offline'

export async function getStoredMapFile(): Promise<ConnectedMapFile | null> {
  const [{ value: uri }, { value: name }] = await Promise.all([
    Preferences.get({ key: URI_KEY }),
    Preferences.get({ key: NAME_KEY }),
  ])
  if (!uri) return null
  return { uri, name: name ?? 'japan.pmtiles' }
}

export async function loadMapFile(): Promise<ConnectedMapFile> {
  const file = await getStoredMapFile()
  if (!file) throw new NoFileSelectedError()

  const { granted } = await DriveFile.hasPersistedAccess({ uri: file.uri })
  if (!granted) throw new AccessRevokedError()

  return file
}

export async function connectMapFile(): Promise<ConnectedMapFile> {
  // La lecture par plage d'octets (readRange) n'est pas encore implémentée côté web
  // (voir DriveFile.web.ts) — inutile de laisser sélectionner un fichier qu'on ne
  // pourra jamais lire une fois en mode hors-ligne.
  if (!Capacitor.isNativePlatform()) {
    throw new Error("La carte hors-ligne n'est pas encore disponible sur navigateur.")
  }
  const { uri, name } = await DriveFile.pickFile()
  await Promise.all([Preferences.set({ key: URI_KEY, value: uri }), Preferences.set({ key: NAME_KEY, value: name })])
  return { uri, name }
}

export async function getStoredMode(): Promise<MapMode> {
  const { value } = await Preferences.get({ key: MODE_KEY })
  return value === 'offline' ? 'offline' : 'online'
}

export async function setStoredMode(mode: MapMode): Promise<void> {
  await Preferences.set({ key: MODE_KEY, value: mode })
}
