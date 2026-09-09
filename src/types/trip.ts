export interface Coordinates {
  lat: number
  lng: number
}

export interface Accommodation {
  id: string
  name: string
  checkIn: string // ISO date
  checkOut: string // ISO date
  coordinates?: Coordinates
  bookingLink?: string
  notes?: string
}

export interface Excursion {
  id: string
  name: string
  date: string // ISO date
  coordinates?: Coordinates
  notes?: string
  mode?: TransportMode
}

export type ActivityCategory = 'restaurant' | 'museum' | 'shop' | 'point_of_interest' | 'hike' | 'cycling'

// Activités/restaurants/musées etc. — imbriquées dans leur Trip, chargées à
// l'exécution depuis la base JSON partagée sur Google Drive (voir
// src/hooks/useDatabase.ts), alimentées soit en masse via
// scripts/build-activities.mjs (CSV, data/activities-sources/), soit
// directement dans l'app (ajout/modif/suppression).
export interface Activity {
  id: string
  name: string
  stageGroup: string // groupe d'affichage tel que fourni dans la source, ex "Tokyo (1er séjour)"
  stageId?: string // étape correspondante quand elle est identifiable
  category: ActivityCategory
  mapsUrl: string
  hours?: string
  notes?: string
  date?: string // ISO date — journée à laquelle l'activité est planifiée, si l'utilisateur l'a fixée
  time?: string // "HH:mm" — heure de début prévue ce jour-là, indépendant de `hours` (horaires d'ouverture, texte libre issu du CSV)
  endTime?: string // "HH:mm" — heure de fin optionnelle ; sans elle l'activité reste un simple point sur la frise (DayAgenda), avec elle un créneau bloqué visuellement. Ignorée si `time` n'est pas défini.
  // Absente si non géocodée (Nominatim côté release, ou non renseignée en app) —
  // l'activité reste utilisable, juste sans pin carte.
  coordinates?: Coordinates
  done?: boolean // cochée une fois faite sur place
  rating?: string // emoji choisi librement (clavier emoji du téléphone), ressenti perso une fois faite
  comment?: string // commentaire perso, distinct de `notes` (issu des sources CSV)
  wishlist?: boolean // "j'ai très envie de faire ça" — pour repérer/planifier plus tard, indépendant de `done`
  favorite?: boolean // "coup de cœur" une fois faite — coché en même temps que la note, indépendant de `rating`
}

// Lien utile (glossaire de ressources) — flat sous Trip comme Activity, propre
// à chaque voyage et éditable dans l'app. `stageId` absent = ressource générique
// valable pour tout le voyage (ex: réservation shinkansen) ; présent = rattachée
// à une étape précise (ex: plan de transport d'une ville).
export interface Resource {
  id: string
  label: string
  url: string
  stageId?: string
  icon?: string // emoji libre, affiché devant le libellé
  description?: string // une ou deux phrases expliquant à quoi sert ce lien
}

export type TransportMode = 'shinkansen' | 'train' | 'bus' | 'plane' | 'ferry'

export interface TransportLeg {
  id: string
  mode: TransportMode
  from: string
  to: string
  fromCoordinates: Coordinates
  toCoordinates: Coordinates
}

export interface Stage {
  id: string
  city: string
  order: number
  coordinates: Coordinates
  accommodations: Accommodation[]
  excursions: Excursion[]
  // Comment on arrive depuis l'étape précédente (absent pour la 1ère étape).
  arrivalLegs?: TransportLeg[]
}

// Un voyage complet — l'app gère plusieurs Trip en parallèle (voir
// src/hooks/useDatabase.ts) ; l'utilisateur choisit celui affiché via le
// sélecteur du header.
export interface Trip {
  id: string
  name: string
  stages: Stage[]
  // Dernier trajet du voyage, après la dernière étape (ex: hôtel -> aéroport).
  departureLegs?: TransportLeg[]
  activities?: Activity[]
  resources?: Resource[]
  // Texte du tampon "envie de faire" (ActivityCard, popup MapView) —
  // "Ikitai" (行きたい, japonais pour "je veux y aller") n'a de sens que pour
  // un voyage au Japon, d'où le rendre configurable par voyage. Voir
  // DEFAULT_WISHLIST_STAMP_LABEL.
  wishlistStampLabel?: string
}

export const DEFAULT_WISHLIST_STAMP_LABEL = 'Wishlist'

// Racine du fichier JSON partagé sur Google Drive (voir src/hooks/useDatabase.ts
// et src/data/databaseRepository.ts) — chaque Trip est autonome (stages +
// activités imbriqués), pas de clé étrangère entre trips.
//
// `schemaVersion` absent = fichier jamais passé par le pipeline de migration
// (src/data/migrations.ts), traité comme la version courante au chargement —
// voir ce fichier pour la logique de migration.
export interface Database {
  trips: Trip[]
  schemaVersion?: number
}
