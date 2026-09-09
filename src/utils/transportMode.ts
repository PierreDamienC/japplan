import type { TransportMode } from '../types/trip'

export const transportModeLabels: Record<TransportMode, string> = {
  shinkansen: 'Shinkansen',
  train: 'Train',
  bus: 'Bus',
  plane: 'Avion',
  ferry: 'Ferry',
}

export const TRANSPORT_MODES = Object.keys(transportModeLabels) as TransportMode[]
