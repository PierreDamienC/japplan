import { useCallback, useState } from 'react'
import type { FormEvent, MouseEvent, ReactNode } from 'react'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import Button from './Button'
import Icon from './Icon'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  as?: 'div' | 'form'
  onSubmit?: (e: FormEvent) => void
  tall?: boolean
  error?: string
}

// Doit rester en phase avec --dur-base (theme/tokens.css) : ce délai pilote
// quand React démonte réellement le composant, la transition CSS pilote ce
// que l'œil voit — les deux doivent durer pareil ou l'un coupe l'autre.
const CLOSE_ANIMATION_MS = 200

// N'anime la fermeture que pour les affordances que Sheet possède lui-même
// (fond, ✕, bouton retour Android). Les boutons du footer (Annuler,
// Enregistrer) sont fournis par l'appelant et restent câblés directement sur
// `onClose` — ils démontent sans animation. Suffisant pour cette migration ;
// un `SheetCloseContext` pourrait unifier les deux plus tard si besoin.
export default function Sheet({ title, onClose, children, footer, as = 'div', onSubmit, tall = false, error }: SheetProps) {
  const [closing, setClosing] = useState(false)

  const requestClose = useCallback(() => {
    setClosing(true)
    window.setTimeout(onClose, CLOSE_ANIMATION_MS)
  }, [onClose])

  useBackButtonClose(requestClose)

  function stop(e: MouseEvent) {
    e.stopPropagation()
  }

  const panelClass = ['sheet', tall && 'sheet--tall', closing && 'sheet--closing'].filter(Boolean).join(' ')
  const backdropClass = closing ? 'sheet-backdrop sheet-backdrop--closing' : 'sheet-backdrop'

  const panelBody = (
    <>
      <div className="sheet__handle" aria-hidden="true" />
      <div className="sheet__header">
        <h2 className="sheet__title">{title}</h2>
        <Button iconOnly variant="ghost" size="sm" icon="close" aria-label="Fermer" onClick={requestClose} />
      </div>
      <div className="sheet__body">{children}</div>
      {error && (
        <p className="sheet__error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
      {footer && <div className="sheet__footer">{footer}</div>}
    </>
  )

  return (
    <div className={backdropClass} onClick={requestClose}>
      {as === 'form' ? (
        <form className={panelClass} onClick={stop} onSubmit={onSubmit}>
          {panelBody}
        </form>
      ) : (
        <div className={panelClass} onClick={stop}>
          {panelBody}
        </div>
      )}
    </div>
  )
}
