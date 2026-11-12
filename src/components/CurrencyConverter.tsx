import { useState } from 'react'
import { useExchangeRate } from '../hooks/useExchangeRate'
import Button from './ui/Button'
import Icon from './ui/Icon'

type Side = 'eur' | 'jpy'

const eurFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const jpyFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const rateFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

// Accepte la virgule (clavier FR) comme le point, et ignore les espaces de
// milliers qu'Intl insère dans le champ calculé si on le réédite.
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function CurrencyConverter() {
  const { rate, status, refresh } = useExchangeRate()
  // Seul le champ saisi garde son texte brut ; l'autre est toujours recalculé,
  // pour que la conversion suive automatiquement un rafraîchissement du taux.
  const [edited, setEdited] = useState<{ side: Side; raw: string }>({ side: 'eur', raw: '' })

  const amount = parseAmount(edited.raw)
  const converted =
    rate && amount !== null ? (edited.side === 'eur' ? jpyFormat.format(amount * rate.rate) : eurFormat.format(amount / rate.rate)) : ''

  const eurValue = edited.side === 'eur' ? edited.raw : converted
  const jpyValue = edited.side === 'jpy' ? edited.raw : converted

  let statusText: string
  if (rate) {
    statusText = `1 € = ${rateFormat.format(rate.rate)} ¥ · taux du ${formatDate(rate.date)} (${rate.source})`
    if (status === 'offline') statusText += ' — hors ligne, dernier taux connu'
  } else if (status === 'error') {
    statusText = 'Taux indisponible — vérifiez la connexion'
  } else {
    statusText = 'Récupération du taux…'
  }

  return (
    <section className="converter" aria-label="Conversion euro / yen">
      <div className="converter__fields">
        <label className="converter__field">
          <span className="converter__currency">€</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={eurValue}
            disabled={!rate}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setEdited({ side: 'eur', raw: e.target.value })}
            aria-label="Montant en euros"
          />
        </label>
        <Icon name="swap" size={18} className="converter__arrow" />
        <label className="converter__field">
          <span className="converter__currency">¥</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={jpyValue}
            disabled={!rate}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setEdited({ side: 'jpy', raw: e.target.value })}
            aria-label="Montant en yens"
          />
        </label>
      </div>
      <div className="converter__footer">
        <span className={status === 'offline' || status === 'error' ? 'converter__rate converter__rate--warn' : 'converter__rate'}>
          {statusText}
        </span>
        <Button
          iconOnly
          variant="ghost"
          size="sm"
          icon="refresh"
          aria-label="Actualiser le taux"
          loading={status === 'loading'}
          onClick={refresh}
        />
      </div>
    </section>
  )
}
