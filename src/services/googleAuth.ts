// Enveloppe promise-based du token client OAuth2 de Google Identity Services
// (GIS). Le script GIS est chargé dès l'import de ce module (pas paresseusement
// au premier appel) : GIS ouvre une vraie fenêtre popup pour CHAQUE tentative
// (y compris le renouvellement "silencieux" `prompt: ''`, qui n'est pas un
// simple iframe caché), et les popups ouverts après un aller-retour réseau
// (le chargement du script) perdent le lien avec le geste utilisateur d'origine
// et se font bloquer par le navigateur — observé concrètement en test. Charger
// le script en amont laisse le temps qu'il soit prêt avant tout clic.
//
// GIS ne fournit pas de refresh token exploitable côté client pur : le jeton
// d'accès expire au bout d'environ une heure. `getAccessToken({interactive:
// false})` (vérifications en arrière-plan, pas de clic) tente un renouvellement
// silencieux qui échoue proprement sans rien afficher si impossible.
// `getAccessToken({interactive: true})` (clic explicite, ex. "Choisir le
// fichier Google Drive") fait un unique appel — pas de tentative silencieuse
// préalable ici, qui ajouterait un aller-retour et casserait à son tour le
// geste utilisateur pour le popup interactif suivant.

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const EXPIRY_MARGIN_MS = 60_000

let scriptPromise: Promise<void> | null = null
let tokenClient: GoogleTokenClient | null = null
let cachedToken: { accessToken: string; expiresAt: number } | null = null
let pendingRequest: { resolve: (token: string) => void; reject: (err: Error) => void } | null = null

function loadGisScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Impossible de charger Google Identity Services.'))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

// Démarre le chargement dès l'import du module plutôt que d'attendre un
// premier appel — voir la note en tête de fichier.
void loadGisScript()

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!id) throw new Error('VITE_GOOGLE_CLIENT_ID manquant (voir .env.local.example).')
  return id
}

function settlePending(settle: (p: NonNullable<typeof pendingRequest>) => void) {
  const request = pendingRequest
  pendingRequest = null
  if (request) settle(request)
}

async function ensureTokenClient(): Promise<GoogleTokenClient> {
  await loadGisScript()
  if (!tokenClient) {
    if (!window.google) throw new Error('Google Identity Services indisponible.')
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          settlePending((r) => r.reject(new Error(response.error_description || response.error)))
          return
        }
        cachedToken = { accessToken: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 }
        settlePending((r) => r.resolve(response.access_token))
      },
      error_callback: (error) => {
        settlePending((r) => r.reject(new Error(error.message || error.type)))
      },
    })
  }
  return tokenClient
}

async function requestToken(overrideConfig?: { prompt?: '' | 'consent' }): Promise<string> {
  const client = await ensureTokenClient()
  return new Promise<string>((resolve, reject) => {
    pendingRequest = { resolve, reject }
    client.requestAccessToken(overrideConfig)
  })
}

// `interactive: false` (vérifications en arrière-plan) tente un renouvellement
// silencieux uniquement. `interactive: true` (geste utilisateur direct, ex. le
// clic sur "Choisir le fichier Google Drive") fait un unique appel sans prompt
// forcé — GIS n'affiche un écran que si nécessaire — pour rester au plus près
// du clic d'origine et éviter le blocage de popup.
export async function getAccessToken(options: { interactive: boolean }): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return cachedToken.accessToken
  }
  return requestToken(options.interactive ? undefined : { prompt: '' })
}
