import { useCallback, useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'

const CACHE_KEY = 'exchangeRateEurJpy'

export interface ExchangeRate {
  /** Nombre de yens pour 1 €. */
  rate: number
  /** Date du taux publiée par la source (ISO `YYYY-MM-DD`). */
  date: string
  source: 'BCE' | 'ExchangeRate-API'
}

export type ExchangeRateStatus = 'loading' | 'ready' | 'offline' | 'error'

// Frankfurter publie le taux de référence BCE (mis à jour chaque jour ouvré
// vers 16h CET). open.er-api.com sert de repli si Frankfurter est indisponible.
// Aucune des deux n'exige de clé API et toutes deux autorisent le CORS.
async function fetchRate(): Promise<ExchangeRate> {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=JPY')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { date: string; rates: { JPY?: number } }
    if (typeof json.rates.JPY !== 'number') throw new Error('JPY absent')
    return { rate: json.rates.JPY, date: json.date, source: 'BCE' }
  } catch {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { time_last_update_unix: number; rates: { JPY?: number } }
    if (typeof json.rates.JPY !== 'number') throw new Error('JPY absent')
    const date = new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10)
    return { rate: json.rates.JPY, date, source: 'ExchangeRate-API' }
  }
}

async function readCache(): Promise<ExchangeRate | null> {
  const { value } = await Preferences.get({ key: CACHE_KEY })
  if (!value) return null
  try {
    return JSON.parse(value) as ExchangeRate
  } catch {
    return null
  }
}

/**
 * Taux EUR→JPY du jour. Le dernier taux obtenu est mis en cache pour rester
 * utilisable sans réseau (cas typique en voyage) — le statut `'offline'` signale
 * alors qu'on affiche un taux potentiellement ancien.
 */
export function useExchangeRate() {
  const [rate, setRate] = useState<ExchangeRate | null>(null)
  const [status, setStatus] = useState<ExchangeRateStatus>('loading')

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      const fresh = await fetchRate()
      setRate(fresh)
      setStatus('ready')
      await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(fresh) })
    } catch {
      const cached = await readCache()
      setRate((current) => current ?? cached)
      setStatus(cached ? 'offline' : 'error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Affiche immédiatement le taux en cache pendant que le réseau répond.
    readCache().then((cached) => {
      if (!cancelled && cached) setRate((current) => current ?? cached)
    })
    refresh()
    return () => {
      cancelled = true
    }
  }, [refresh])

  return { rate, status, refresh }
}
