// Pile des modales actuellement ouvertes, dans l'ordre d'ouverture — pas de
// contexte React nécessaire, une seule instance de l'app tourne à la fois.
// Le bouton retour Android (voir useBackButtonClose.ts) ferme la modale du
// dessus plutôt que de quitter l'app.
type CloseHandler = () => void

const stack: CloseHandler[] = []

export function pushBackButtonHandler(handler: CloseHandler): () => void {
  stack.push(handler)
  return () => {
    const i = stack.lastIndexOf(handler)
    if (i !== -1) stack.splice(i, 1)
  }
}

export function closeTopModal(): boolean {
  const handler = stack.at(-1)
  if (!handler) return false
  handler()
  return true
}
