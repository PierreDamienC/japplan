import type { ActivityCategory, Database } from '../types/trip'

// Version de la forme de `Database` que ce build de l'app comprend. À
// incrémenter uniquement pour un changement cassant (champ renommé, type de
// champ changé, structure déplacée) — un nouveau champ optionnel n'a besoin
// de rien puisqu'il est simplement absent (undefined) sur les anciennes
// données.
export const CURRENT_SCHEMA_VERSION = 2

interface Migration {
  toVersion: number
  migrate: (database: Database) => Database
}

// Une entrée par changement cassant, dans l'ordre. Exemple à suivre le jour
// où il en faut une :
//   { toVersion: 2, migrate: (db) => ({ ...db, trips: db.trips.map(...) }) }
const migrations: Migration[] = [
  {
    // Activity.category (une seule) → Activity.categories (liste, la première
    // étant la principale).
    toVersion: 2,
    migrate: (db) => ({
      ...db,
      trips: db.trips.map((trip) => ({
        ...trip,
        activities: trip.activities?.map((activity) => {
          const { category, ...rest } = activity as typeof activity & { category?: ActivityCategory }
          return { ...rest, categories: activity.categories ?? (category ? [category] : []) }
        }),
      })),
    }),
  },
]

// Applique en mémoire toutes les migrations manquantes par rapport à
// `CURRENT_SCHEMA_VERSION`. Idempotente : rappelable sans risque sur une
// base déjà à jour (boucle simplement vide). Le fichier absent de
// `schemaVersion` (jamais passé par ce pipeline) est forcément antérieur à
// son introduction, donc à la forme de la version 1 — pas à la version
// courante, sinon les migrations suivantes ne s'y appliqueraient jamais.
export function migrateDatabase(database: Database): { database: Database; migrated: boolean } {
  let current = database
  let version = database.schemaVersion ?? 1

  for (const step of migrations) {
    if (version >= step.toVersion) continue
    current = step.migrate(current)
    version = step.toVersion
  }

  if (version === database.schemaVersion) {
    return { database: current, migrated: false }
  }
  return { database: { ...current, schemaVersion: version }, migrated: true }
}
