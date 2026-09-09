import { useCallback, useEffect, useState } from 'react'
import {
  AccessRevokedError,
  NoFileSelectedError,
  connectMapFile,
  getStoredMode,
  loadMapFile,
  setStoredMode,
  type MapMode,
} from '../data/offlineMapRepository'

export type OfflineMapStatus = 'loading' | 'no-file' | 'error' | 'ready'

export interface UseOfflineMapResult {
  status: OfflineMapStatus
  error?: string
  fileUri?: string
  fileName?: string
  mode: MapMode
  connectMap: () => Promise<void>
  setMode: (mode: MapMode) => Promise<void>
}

export function useOfflineMap(): UseOfflineMapResult {
  const [status, setStatus] = useState<OfflineMapStatus>('loading')
  const [error, setError] = useState<string>()
  const [fileUri, setFileUri] = useState<string>()
  const [fileName, setFileName] = useState<string>()
  const [mode, setModeState] = useState<MapMode>('online')

  const refresh = useCallback(async () => {
    setStatus('loading')
    setError(undefined)
    try {
      setModeState(await getStoredMode())
      const file = await loadMapFile()
      setFileUri(file.uri)
      setFileName(file.name)
      setStatus('ready')
    } catch (e) {
      if (e instanceof NoFileSelectedError) {
        setStatus('no-file')
        return
      }
      if (e instanceof AccessRevokedError) {
        setError("L'accès au fichier de carte a été révoqué — reconnecte-le.")
        setStatus('no-file')
        return
      }
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const connectMap = useCallback(async () => {
    setStatus('loading')
    setError(undefined)
    try {
      await connectMapFile()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('no-file')
    }
  }, [refresh])

  const setMode = useCallback(async (next: MapMode) => {
    await setStoredMode(next)
    setModeState(next)
  }, [])

  return { status, error, fileUri, fileName, mode, connectMap, setMode }
}
