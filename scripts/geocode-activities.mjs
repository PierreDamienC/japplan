// Géocode les activités (data/activities-sources/*.csv) via Nominatim
// (OpenStreetMap, gratuit) et met en cache le résultat dans
// data/activities-coordinates.json, clé = place_id Google Maps.
// Ré-exécuter à chaque nouveau CSV : ne relance que les lieux pas encore
// en cache (respecte la limite Nominatim d'1 requête/seconde).
//
//   node scripts/geocode-activities.mjs

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const sourcesDir = path.join(rootDir, 'data', 'activities-sources')
const cacheFile = path.join(rootDir, 'data', 'activities-coordinates.json')

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const chars = text.replace(/\r\n/g, '\n')
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (inQuotes) {
      if (c === '"') {
        if (chars[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// Deux formats de lien Google Maps rencontrés selon la source du CSV : les
// liens "partager" classiques (?...&query_place_id=XXX) et les liens
// reconstruits directement à partir d'un place_id connu (?q=place_id:XXX,
// le même format que le fallback documenté dans CLAUDE.md).
function placeIdOf(mapsUrl) {
  return mapsUrl.match(/query_place_id=([^&]+)/)?.[1] ?? mapsUrl.match(/q=place_id:([^&]+)/)?.[1]
}

function cityHint(stageGroup) {
  return stageGroup.replace(/\s*\(.*\)\s*$/, '').trim()
}

// "Byōdō-in + musée Hōshōkan" / "Honke Daiichi-Asahi (ramen)" -> le nom seul
// recherche bien mieux sur Nominatim que le nom complet avec son descriptif.
function simplifyName(name) {
  return name.split(/\s+\+\s+|\s+\(/)[0].trim()
}

function loadRows() {
  const rows = []
  const seenPlaceIds = new Set()
  for (const file of readdirSync(sourcesDir).filter((f) => f.endsWith('.csv')).sort()) {
    const text = readFileSync(path.join(sourcesDir, file), 'utf-8')
    const [header, ...dataRows] = parseCsv(text)
    const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
    for (const r of dataRows) {
      const name = r[col['Nom']]?.trim()
      const mapsUrl = r[col['Lien Google Maps']]?.trim() ?? ''
      const stageGroup = r[col['Étape']]?.trim() ?? ''
      const placeId = placeIdOf(mapsUrl)
      if (!name || !placeId) continue
      // Le même lieu peut apparaître dans deux CSV (ex: Osaka listé à la fois
      // depuis Tokyo et depuis son propre fichier) : ne le géocoder qu'une
      // fois, sinon la 2e requête peut écraser un bon résultat par un échec.
      if (seenPlaceIds.has(placeId)) continue
      seenPlaceIds.add(placeId)
      rows.push({ name, placeId, stageGroup })
    }
  }
  return rows
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Une 429 veut dire qu'on est rate-limited par Nominatim (ou son cache
// Fastly) : ce n'est PAS "lieu introuvable", il faut ralentir et réessayer,
// sinon on écrit des faux négatifs définitifs dans le cache.
async function searchOnce(query, attempt = 1) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`
  const res = await fetch(url, { headers: { 'User-Agent': 'Japplan-personal-trip-app/1.0' } })
  if (res.status === 429) {
    if (attempt > 5) throw new Error('Toujours rate-limited après 5 tentatives, abandon.')
    const wait = 6000 * attempt
    console.warn(`  429 (rate limit) — pause ${wait / 1000}s puis nouvel essai...`)
    await sleep(wait)
    return searchOnce(query, attempt + 1)
  }
  if (!res.ok) return null
  const results = await res.json()
  if (results.length === 0) return null
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) }
}

// Essaie le nom complet, puis le nom simplifié (sans le descriptif entre
// parenthèses ou après un "+") si le premier essai échoue.
async function geocode(name, stageGroup) {
  const city = cityHint(stageGroup)
  const found = await searchOnce(`${name}, ${city}, Japan`)
  if (found) return found

  const simplified = simplifyName(name)
  if (simplified === name) return null
  await sleep(1500)
  return searchOnce(`${simplified}, ${city}, Japan`)
}

const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf-8')) : {}
const rows = loadRows()
const todo = rows.filter((r) => !(r.placeId in cache))

console.log(`${rows.length} lieux au total, ${todo.length} à géocoder (${rows.length - todo.length} déjà en cache).`)

let found = 0
let notFound = 0
for (const [i, row] of todo.entries()) {
  let coords
  try {
    coords = await geocode(row.name, row.stageGroup)
  } catch (err) {
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
    console.error(`Arrêt après ${i}/${todo.length} : ${err.message}`)
    console.error('Progrès sauvegardé. Relance le script plus tard pour reprendre où on en était.')
    process.exit(1)
  }
  cache[row.placeId] = coords // null = vraiment introuvable, évite de reredemander à chaque run
  if (coords) found++
  else {
    notFound++
    console.warn(`Introuvable : "${row.name}" (${row.stageGroup})`)
  }
  if ((i + 1) % 10 === 0) writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
  await sleep(1500)
}

writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
console.log(`Terminé : ${found} géocodés, ${notFound} introuvables. Lance maintenant npm run activities:build.`)
