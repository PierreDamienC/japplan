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
  // Reads `length` bytes starting at `offset` from `uri`. The native side keeps the file
  // descriptor open across calls for the same URI (see DriveFilePlugin.kt) — call closeRangeRead()
  // when done reading a given file (e.g. leaving offline map mode) to release it.
  readRange(options: { uri: string; offset: number; length: number }): Promise<{ dataBase64: string }>
  closeRangeRead(): Promise<void>
}

export const DriveFile = registerPlugin<DriveFilePlugin>('DriveFile', {
  web: () => import('./DriveFile.web').then((m) => new m.DriveFileWeb()),
})
