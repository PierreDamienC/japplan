import { Preferences } from '@capacitor/preferences'
import { DriveFile } from '../plugins/DriveFile'
import type { Database, Trip } from '../types/trip'

const URI_KEY = 'databaseFileUri'
const NAME_KEY = 'databaseFileName'

export class NoFileSelectedError extends Error {}
export class AccessRevokedError extends Error {}
export class ParseError extends Error {}
export class ReadError extends Error {}

export interface ConnectedFile {
  uri: string
  name: string
}

async function getStoredFile(): Promise<ConnectedFile | null> {
  const [{ value: uri }, { value: name }] = await Promise.all([
    Preferences.get({ key: URI_KEY }),
    Preferences.get({ key: NAME_KEY }),
  ])
  if (!uri) return null
  return { uri, name: name ?? 'database.json' }
}

function isTripArray(value: unknown): value is Trip[] {
  return (
    Array.isArray(value) &&
    value.every((item): item is Trip => {
      const t = item as Partial<Trip> | null
      return !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.stages)
    })
  )
}

function isDatabase(value: unknown): value is Database {
  return !!value && typeof value === 'object' && isTripArray((value as Partial<Database>).trips)
}

export async function loadDatabase(): Promise<{ database: Database; file: ConnectedFile }> {
  const file = await getStoredFile()
  if (!file) throw new NoFileSelectedError()

  const { granted } = await DriveFile.hasPersistedAccess({ uri: file.uri })
  if (!granted) throw new AccessRevokedError()

  let content: string
  try {
    ;({ content } = await DriveFile.readText({ uri: file.uri }))
  } catch (e) {
    throw new ReadError(e instanceof Error ? e.message : String(e))
  }

  if (content.trim().length === 0) {
    return { database: { trips: [] }, file }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new ParseError('Le fichier ne contient pas du JSON valide.')
  }

  if (!isDatabase(parsed)) {
    throw new ParseError('Le fichier ne contient pas une base de voyages valide.')
  }

  return { database: parsed, file }
}

export async function saveDatabase(file: ConnectedFile, database: Database): Promise<void> {
  await DriveFile.writeText({ uri: file.uri, content: JSON.stringify(database, null, 2) })
}

export async function connectFile(): Promise<ConnectedFile> {
  const { uri, name } = await DriveFile.pickFile()
  await Promise.all([Preferences.set({ key: URI_KEY, value: uri }), Preferences.set({ key: NAME_KEY, value: name })])
  return { uri, name }
}
