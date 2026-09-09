import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import Button from './ui/Button'
import Icon from './ui/Icon'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

// Filet racine : depuis React 18, une exception au rendu démonte tout l'arbre
// sans message ni logs propres — écran blanc pur. Sur un téléphone hors ligne
// au Japon, sans devtools ni possibilité de rebuild, c'est la panne la plus
// chère du projet quelle que soit sa cause. N'attrape que les erreurs de
// rendu — les rejets de promesse (ex: écriture Drive) n'en font pas partie,
// voir useDatabase.ts pour ce cas-là.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non rattrapée :', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopy = () => {
    const { error } = this.state
    if (!error) return
    const detail = `${error.name}: ${error.message}\n${error.stack ?? ''}`
    navigator.clipboard?.writeText(detail).catch(() => {})
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="error-boundary">
        <div className="error-boundary__icon">
          <Icon name="alert" size={32} />
        </div>
        <h1 className="error-boundary__title">Une erreur inattendue s'est produite</h1>
        <p className="error-boundary__message">{error.message}</p>
        <pre className="error-boundary__stack">{error.stack}</pre>
        <div className="error-boundary__actions">
          <Button variant="secondary" onClick={this.handleCopy}>
            Copier le détail
          </Button>
          <Button variant="primary" onClick={this.handleReload}>
            Recharger
          </Button>
        </div>
      </div>
    )
  }
}
