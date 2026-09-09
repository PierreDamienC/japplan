import { useEffect, useRef } from 'react'
import { pushBackButtonHandler } from '../utils/backButtonStack'

// À appeler par toute modale plein écran : le bouton retour Android ferme la
// modale au lieu de quitter l'app (voir App.tsx pour l'écoute globale).
//
// `onClose` est lu via une ref plutôt que mis en deps de l'effet : Sheet.tsx
// route la fermeture à travers un `requestClose()` recréé à chaque rendu, et
// avec `onClose` en deps l'effet dépilerait/rempilerait le handler à chaque
// rendu de la modale — inoffensif tant qu'aucune modale n'est imbriquée dans
// une autre, mais ça romprait l'ordre LIFO dès que ce sera le cas.
export function useBackButtonClose(onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => pushBackButtonHandler(() => onCloseRef.current()), [])
}
