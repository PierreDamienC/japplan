// Déclarations d'ambiance minimales pour Google Identity Services (GIS) et le
// Google Picker — chargés au runtime via injection de <script> (voir
// src/services/googleAuth.ts et googlePicker.ts), pas des packages npm.
// Ne couvre que la surface réellement utilisée.

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  error?: string
  error_description?: string
}

interface GoogleTokenClient {
  requestAccessToken(overrideConfig?: { prompt?: '' | 'consent' }): void
}

interface GoogleAccountsOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }): GoogleTokenClient
}

interface GooglePickerDocument {
  id: string
  name: string
}

interface GooglePickerResponse {
  action: string
  docs?: GooglePickerDocument[]
}

interface GooglePickerDocsView {
  setIncludeFolders(include: boolean): GooglePickerDocsView
  setOwnedByMe(ownedByMe: boolean): GooglePickerDocsView
}

interface GooglePickerBuilt {
  setVisible(visible: boolean): void
}

interface GooglePickerBuilder {
  addView(view: GooglePickerDocsView): GooglePickerBuilder
  setOAuthToken(token: string): GooglePickerBuilder
  setDeveloperKey(key: string): GooglePickerBuilder
  setAppId(appId: string): GooglePickerBuilder
  setCallback(callback: (response: GooglePickerResponse) => void): GooglePickerBuilder
  build(): GooglePickerBuilt
}

interface GooglePickerNamespace {
  PickerBuilder: new () => GooglePickerBuilder
  DocsView: new () => GooglePickerDocsView
  Action: { PICKED: string; CANCEL: string }
}

interface Window {
  google?: {
    accounts: { oauth2: GoogleAccountsOAuth2 }
    picker: GooglePickerNamespace
  }
  gapi?: {
    load(api: 'picker', callback: () => void): void
  }
}
