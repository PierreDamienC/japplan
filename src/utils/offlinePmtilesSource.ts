import type { RangeResponse, Source } from 'pmtiles'
import { DriveFile } from '../plugins/DriveFile'

// Fixed lookup key used both when registering the PMTiles instance with the
// protocol (protocol.add()) and in the offline style's source `url` — see
// pmtiles' Protocol.tile(), which resolves `pmtiles://<key>` by looking up
// this exact string in its internal Map.
export const OFFLINE_PMTILES_KEY = 'offline-japan'

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// Reads archive bytes straight from the connected Drive content:// URI via
// SAF byte-range reads (DriveFilePlugin.readRange) — no local copy, see
// CLAUDE.md "Carte hors ligne".
export class OfflinePmtilesSource implements Source {
  private uri: string

  constructor(uri: string) {
    this.uri = uri
  }

  getKey(): string {
    return OFFLINE_PMTILES_KEY
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    try {
      const { dataBase64 } = await DriveFile.readRange({ uri: this.uri, offset, length })
      return { data: base64ToArrayBuffer(dataBase64) }
    } catch (e) {
      console.error(`OfflinePmtilesSource.getBytes(${offset}, ${length}) failed:`, e)
      throw e
    }
  }
}
