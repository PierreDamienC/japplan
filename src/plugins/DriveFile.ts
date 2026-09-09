import { registerPlugin } from '@capacitor/core'

export interface DriveFilePickResult {
  uri: string
  name: string
}

export interface DriveFilePlugin {
  pickFile(): Promise<DriveFilePickResult>
  hasPersistedAccess(options: { uri: string }): Promise<{ granted: boolean }>
  readText(options: { uri: string }): Promise<{ content: string }>
  writeText(options: { uri: string; content: string }): Promise<void>
  // Vérification légère de fraîcheur (aucun contenu de fichier lu) pour la synchro
  // multi-utilisateur — voir useDatabase.ts. `modifiedTime` est un jeton opaque
  // spécifique à la plateforme (epoch-millis en string sur Android, ISO-8601 sur
  // web/Drive REST) : ne jamais le comparer entre plateformes, seulement à une
  // valeur précédente obtenue via cette même méthode dans la même session.
  getMetadata(options: { uri: string }): Promise<{ modifiedTime: string }>
  // Reads `length` bytes starting at `offset` from `uri`. The native side keeps the file
  // descriptor open across calls for the same URI (see DriveFilePlugin.kt) — call closeRangeRead()
  // when done reading a given file (e.g. leaving offline map mode) to release it.
  readRange(options: { uri: string; offset: number; length: number }): Promise<{ dataBase64: string }>
  closeRangeRead(): Promise<void>
}

export const DriveFile = registerPlugin<DriveFilePlugin>('DriveFile', {
  web: () => import('./DriveFile.web').then((m) => new m.DriveFileWeb()),
})
