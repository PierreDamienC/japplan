import { Preferences } from '@capacitor/preferences'
import { DriveFile } from '../plugins/DriveFile'
import { migrateDatabase } from './migrations'
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

async function readDatabaseContent(file: ConnectedFile): Promise<{ database: Database; migrated: boolean }> {
  const { granted } = await DriveFile.hasPersistedAccess({ uri: file.uri })
  if (!granted) throw new AccessRevokedError()

  let content: string
  try {
    ;({ content } = await DriveFile.readText({ uri: file.uri }))
  } catch (e) {
    throw new ReadError(e instanceof Error ? e.message : String(e))
  }

  if (content.trim().length === 0) {
    return { database: { trips: [] }, migrated: false }
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

  // Appliqué à chaque lecture distante (chargement initial, rebase d'écriture,
  // polling de fraîcheur) — migrateDatabase est idempotente et purement en
  // mémoire, donc ça garantit que toute donnée manipulée par l'app est toujours
  // à la forme courante, peu importe le point d'entrée qui l'a récupérée.
  return migrateDatabase(parsed)
}

// Relit le contenu distant sans retoucher aux Preferences — utilisé par le rebase
// d'écriture et le polling de fraîcheur dans useDatabase.ts, qui connaissent déjà
// le `ConnectedFile` courant.
export async function fetchRemoteDatabase(file: ConnectedFile): Promise<Database> {
  const { database } = await readDatabaseContent(file)
  return database
}

// Vérification légère (métadonnée seule, pas de contenu) de la version distante —
// voir le commentaire sur DriveFilePlugin.getMetadata pour le format du jeton.
export async function getRemoteVersion(file: ConnectedFile): Promise<string> {
  const { modifiedTime } = await DriveFile.getMetadata({ uri: file.uri })
  return modifiedTime
}

export async function loadDatabase(): Promise<{ database: Database; file: ConnectedFile; version: string | null }> {
  const file = await getStoredFile()
  if (!file) throw new NoFileSelectedError()

  const { database, migrated } = await readDatabaseContent(file)
  if (migrated) {
    // Best-effort : la forme migrée est déjà celle retournée et utilisée en
    // mémoire même si l'écriture échoue (hors-ligne, etc.) — migrateDatabase
    // est idempotente, donc le prochain chargement ou la prochaine
    // modification depuis l'app la réécrira.
    saveDatabase(file, database).catch(() => {})
  }
  // Un échec du check de version ne doit pas faire échouer tout le chargement — le
  // contenu est déjà lu avec succès ; on démarre juste avec une base "inconnue"
  // (null), ce qui ne fait que déclencher un rebase superflu-mais-inoffensif à la
  // prochaine écriture (voir runWriteLoop dans useDatabase.ts).
  const version = await getRemoteVersion(file).catch(() => null)

  return { database, file, version }
}

export async function saveDatabase(file: ConnectedFile, database: Database): Promise<void> {
  await DriveFile.writeText({ uri: file.uri, content: JSON.stringify(database, null, 2) })
}

export async function connectFile(): Promise<ConnectedFile> {
  const { uri, name } = await DriveFile.pickFile()
  await Promise.all([Preferences.set({ key: URI_KEY, value: uri }), Preferences.set({ key: NAME_KEY, value: name })])
  return { uri, name }
}
