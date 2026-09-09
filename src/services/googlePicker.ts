// Chargement paresseux du Google Picker (via gapi) et ouverture d'un
// sélecteur de fichier Drive scopé par le jeton OAuth fourni. Deux vues sont
// ajoutées : "Mon Drive" et "Partagés avec moi", puisque le fichier partagé
// par l'autre personne vit dans la seconde.

const GAPI_SRC = 'https://apis.google.com/js/api.js'

let gapiScriptPromise: Promise<void> | null = null
let pickerLoadedPromise: Promise<void> | null = null

function loadGapiScript(): Promise<void> {
  if (!gapiScriptPromise) {
    gapiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GAPI_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Impossible de charger l'API Google Picker."))
      document.head.appendChild(script)
    })
  }
  return gapiScriptPromise
}

async function ensurePickerLoaded(): Promise<void> {
  await loadGapiScript()
  if (!pickerLoadedPromise) {
    if (!window.gapi) throw new Error('gapi indisponible.')
    pickerLoadedPromise = new Promise((resolve) => window.gapi!.load('picker', () => resolve()))
  }
  return pickerLoadedPromise
}

function apiKey(): string {
  const key = import.meta.env.VITE_GOOGLE_PICKER_API_KEY
  if (!key) throw new Error('VITE_GOOGLE_PICKER_API_KEY manquant (voir .env.local.example).')
  return key
}

// Le scope drive.file exige explicitement setAppId (le NUMÉRO de projet Google
// Cloud, différent de l'ID projet) en plus de la clé API — sans lui, le Picker
// ne peut pas accorder l'accès par-fichier attendu par ce scope.
function appId(): string {
  const id = import.meta.env.VITE_GOOGLE_PROJECT_NUMBER
  if (!id) throw new Error('VITE_GOOGLE_PROJECT_NUMBER manquant (voir .env.local.example).')
  return id
}

export interface PickedFile {
  fileId: string
  name: string
}

export async function openPicker(accessToken: string): Promise<PickedFile> {
  await ensurePickerLoaded()
  if (!window.google) throw new Error('Google Picker indisponible.')
  const picker = window.google.picker

  return new Promise<PickedFile>((resolve, reject) => {
    const myDriveView = new picker.DocsView().setIncludeFolders(false)
    const sharedWithMeView = new picker.DocsView().setIncludeFolders(false).setOwnedByMe(false)

    const built = new picker.PickerBuilder()
      .addView(myDriveView)
      .addView(sharedWithMeView)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey())
      .setAppId(appId())
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) {
          const doc = response.docs?.[0]
          if (!doc) {
            reject(new Error('Aucun fichier sélectionné.'))
            return
          }
          resolve({ fileId: doc.id, name: doc.name })
        } else if (response.action === picker.Action.CANCEL) {
          reject(new Error('Sélection annulée.'))
        }
      })
      .build()

    built.setVisible(true)
  })
}
