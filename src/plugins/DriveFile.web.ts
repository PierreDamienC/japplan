import { WebPlugin } from '@capacitor/core'
import type { DriveFilePickResult, DriveFilePlugin } from './DriveFile'
import { getAccessToken } from '../services/googleAuth'
import { openPicker } from '../services/googlePicker'

// La carte hors-ligne (PMTiles) n'est pas encore prise en charge côté web —
// contrairement à database.json (readText/writeText), elle nécessiterait un
// vrai appel réseau HTTP Range par tuile plutôt qu'une simple lecture locale.
const OFFLINE_MAP_UNAVAILABLE = "La carte hors-ligne n'est pas encore disponible sur navigateur."

export class DriveFileWeb extends WebPlugin implements DriveFilePlugin {
  async pickFile(): Promise<DriveFilePickResult> {
    const token = await getAccessToken({ interactive: true })
    const { fileId, name } = await openPicker(token)
    return { uri: fileId, name }
  }

  async hasPersistedAccess(): Promise<{ granted: boolean }> {
    try {
      await getAccessToken({ interactive: false })
      return { granted: true }
    } catch {
      return { granted: false }
    }
  }

  async readText(options: { uri: string }): Promise<{ content: string }> {
    const token = await getAccessToken({ interactive: false })
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${options.uri}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Lecture Drive échouée (${res.status}).`)
    return { content: await res.text() }
  }

  async writeText(options: { uri: string; content: string }): Promise<void> {
    const token = await getAccessToken({ interactive: false })
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${options.uri}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: options.content,
    })
    if (!res.ok) throw new Error(`Écriture Drive échouée (${res.status}).`)
  }

  readRange(): Promise<{ dataBase64: string }> {
    return Promise.reject(new Error(OFFLINE_MAP_UNAVAILABLE))
  }

  closeRangeRead(): Promise<void> {
    return Promise.reject(new Error(OFFLINE_MAP_UNAVAILABLE))
  }
}
