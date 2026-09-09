import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker?url'
import { Protocol, PMTiles } from 'pmtiles'
import { layers as protomapsLayers, namedFlavor } from '@protomaps/basemaps'
import { DEFAULT_WISHLIST_STAMP_LABEL, type Trip, type Stage, type TransportLeg, type TransportMode, type Coordinates, type Activity, type ActivityCategory } from '../types/trip'
import { ALL_CATEGORIES, TRANSPORT_COLORS, TRAIL_COLOR, type ResolvedTheme } from '../theme/categories'
import MapFilterModal from './MapFilterModal'
import { OfflinePmtilesSource, OFFLINE_PMTILES_KEY } from '../utils/offlinePmtilesSource'
import { DriveFile } from '../plugins/DriveFile'
import { getCachedRoute, setCachedRoute } from '../utils/routeCache'
import { formatDayLabel } from '../utils/formatDate'
import { escapeHtml, safeUrl } from '../utils/escapeHtml'
import { iconHtml } from './ui/iconData'
import Button from './ui/Button'
import Chip from './ui/Chip'

// Vite's dependency pre-bundling doesn't preserve the import.meta.url the
// library normally uses to locate its own worker script, so the worker
// never starts and tiles never load. Point it at the CSP worker explicitly.
setWorkerUrl(maplibreWorkerUrl)

// Registered once globally, like setWorkerUrl above — see "Carte hors ligne"
// in CLAUDE.md. The actual PMTiles instance (tied to whichever Drive URI is
// connected) is (re)added to this protocol at mount time, below.
const pmtilesProtocol = new Protocol()
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile)

interface MapViewProps {
  trip: Trip
  selectedStageId: string | null
  selectedActivityId: string | null
  offline: boolean
  offlineMapUri?: string
  theme: ResolvedTheme
  onGoToStage: (stageId: string) => void
  onGoToActivity: (activityId: string) => void
}

// OpenFreeMap ne propose pas de style sombre (catalogue : bright, positron,
// liberty) — positron (gris désaturé) est le moins agressif à côté du chrome
// sumi. Hors ligne, @protomaps/basemaps a un vrai flavor "dark" (voir
// buildOfflineStyle) : l'asymétrie clair/sombre en ligne vs hors ligne est
// une limite connue de OpenFreeMap, pas un oubli.
const MAP_STYLES: Record<ResolvedTheme, string> = {
  light: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/positron',
}

function formatDateRange(checkIn: string, checkOut: string) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const inDate = new Date(checkIn).toLocaleDateString('fr-FR', opts)
  const outDate = new Date(checkOut).toLocaleDateString('fr-FR', opts)
  return `${inDate} → ${outDate}`
}

function navLinkHtml(coordinates: Coordinates) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`
  return `<a class="popup-nav-link" href="${url}" target="_blank" rel="noopener">${iconHtml('external', 13)}Itinéraire</a>`
}

// data-goto-* attributes are read by a single delegated click listener on the
// map container (see mount effect) rather than wiring a handler per popup —
// simpler than fighting MapLibre's popup DOM lifecycle.
function gotoStageButtonHtml(stageId: string) {
  return `<button type="button" class="popup-goto-btn" data-goto-kind="stage" data-goto-id="${stageId}">Voir dans Planning →</button>`
}

function gotoActivityButtonHtml(activityId: string) {
  return `<button type="button" class="popup-goto-btn" data-goto-kind="activity" data-goto-id="${activityId}">Voir dans Activités →</button>`
}

function stagePopupHtml(stage: Stage) {
  const accommodations = stage.accommodations
    .map((acc) => `<div>${escapeHtml(acc.name)}<br>${formatDateRange(acc.checkIn, acc.checkOut)}</div>`)
    .join('')
  return `<strong>${stage.order}. ${escapeHtml(stage.city)}</strong>${accommodations}<div class="popup-actions">${gotoStageButtonHtml(stage.id)}${navLinkHtml(stage.coordinates)}</div>`
}

function makeStageMarkerEl(order: number) {
  const el = document.createElement('div')
  el.className = 'stage-marker'
  el.textContent = String(order)
  return el
}

function makeExcursionMarkerEl() {
  const el = document.createElement('div')
  el.className = 'excursion-marker'
  el.innerHTML = '<span></span>'
  return el
}

function makeAccommodationMarkerEl() {
  const el = document.createElement('div')
  el.className = 'accommodation-marker'
  return el
}


// --marker-color pilote la couleur (theme/categories.ts écrit --cat-* sur
// <html>) : une seule règle CSS .activity-marker pour les 6 catégories, qui
// se recolore seule au changement de thème sans code supplémentaire.
function makeActivityMarkerEl(category: ActivityCategory) {
  const el = document.createElement('div')
  el.className = 'activity-marker'
  el.style.setProperty('--marker-color', `var(--cat-${category})`)
  return el
}

function activityPopupHtml(activity: Activity, wishlistLabel: string) {
  const notes =
    activity.notes && activity.notes.length > 160
      ? `${activity.notes.slice(0, 160)}…`
      : activity.notes
  const doneTag = activity.done ? ' ✓' : ''
  const ratingTag = activity.rating ? ` ${activity.rating}` : ''
  const wishlistStamp = activity.wishlist
    ? `<span class="popup-stamp popup-stamp--wishlist">${escapeHtml(wishlistLabel)}</span>`
    : ''
  const favoriteStamp = activity.favorite
    ? '<span class="popup-stamp popup-stamp--favorite">Coup de cœur</span>'
    : ''
  const mapsUrl = safeUrl(activity.mapsUrl)
  const mapsLink = mapsUrl
    ? `<a class="popup-nav-link" href="${mapsUrl}" target="_blank" rel="noopener">${iconHtml('external', 13)}En Maps</a>`
    : ''
  return `<div class="activity-popup">${wishlistStamp}${favoriteStamp}<strong>${escapeHtml(activity.name)}${doneTag}${escapeHtml(ratingTag)}</strong>${activity.hours ? `<br>${escapeHtml(activity.hours)}` : ''}${
    activity.date ? `<p class="popup-planned">${iconHtml('calendar', 13)}${formatDayLabel(activity.date)}</p>` : ''
  }${
    notes ? `<p class="popup-notes">${escapeHtml(notes)}</p>` : ''
  }${
    activity.comment ? `<p class="popup-notes">${iconHtml('comment', 13)}${escapeHtml(activity.comment)}</p>` : ''
  }<div class="popup-actions">${gotoActivityButtonHtml(activity.id)}${mapsLink}</div></div>`
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Nominatim request failed')
  const data = await res.json()
  const addr = data.address ?? {}
  const street = addr.road ?? addr.pedestrian ?? addr.neighbourhood ?? ''
  const place = addr.suburb ?? addr.city_district ?? addr.city ?? addr.town ?? addr.village ?? ''
  const label = [street, place].filter(Boolean).join(', ')
  return label || data.display_name || 'Lieu inconnu'
}

async function fetchLegCoordinates(leg: TransportLeg): Promise<[number, number][]> {
  const straightLine: [number, number][] = [
    [leg.fromCoordinates.lng, leg.fromCoordinates.lat],
    [leg.toCoordinates.lng, leg.toCoordinates.lat],
  ]
  if (leg.mode === 'plane' || leg.mode === 'ferry') return straightLine

  const cached = getCachedRoute(leg)
  if (cached) return cached

  const url = `https://router.project-osrm.org/route/v1/driving/${leg.fromCoordinates.lng},${leg.fromCoordinates.lat};${leg.toCoordinates.lng},${leg.toCoordinates.lat}?overview=full&geometries=geojson`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('OSRM request failed')
    const data = await res.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (Array.isArray(coords) && coords.length > 0) {
      setCachedRoute(leg, coords)
      return coords
    }
  } catch {
    // fall through to straight line
  }
  return straightLine
}

function routeLineStyle(mode: TransportMode, theme: ResolvedTheme): maplibregl.LineLayerSpecification['paint'] {
  const color = TRANSPORT_COLORS[mode][theme]
  switch (mode) {
    case 'shinkansen':
      return { 'line-color': color, 'line-width': 3, 'line-opacity': 0.85 }
    case 'train':
      return { 'line-color': color, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [3, 1] }
    case 'bus':
      return { 'line-color': color, 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [2, 2] }
    case 'plane':
      return { 'line-color': color, 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [1, 2] }
    case 'ferry':
      return { 'line-color': color, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [1, 1] }
  }
}

// Construit depuis le schéma Protomaps, pas l'OpenMapTiles utilisé en ligne
// par OpenFreeMap/Bright — l'archive PMTiles hors ligne est extraite du
// basemap Protomaps (voir CLAUDE.md "Carte hors ligne"), dont les noms de
// couches vecteur ne correspondent pas à OpenMapTiles.
const OFFLINE_SOURCE_NAME = 'protomaps'
function buildOfflineStyle(theme: ResolvedTheme): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${theme}`,
    sources: {
      [OFFLINE_SOURCE_NAME]: {
        type: 'vector',
        url: `pmtiles://${OFFLINE_PMTILES_KEY}`,
      },
    },
    layers: protomapsLayers(OFFLINE_SOURCE_NAME, namedFlavor(theme)),
  }
}

export default function MapView({
  trip,
  selectedStageId,
  selectedActivityId,
  offline,
  offlineMapUri,
  theme,
  onGoToStage,
  onGoToActivity,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Record<string, maplibregl.Marker>>({})
  const clickPopupRef = useRef<maplibregl.Popup | null>(null)
  const activityMarkerByIdRef = useRef<Record<string, maplibregl.Marker>>({})
  const [visibleCategories, setVisibleCategories] = useState<Set<ActivityCategory>>(
    () => new Set(ALL_CATEGORIES),
  )
  const [wishlistOnly, setWishlistOnly] = useState(false)
  const [plannedOnly, setPlannedOnly] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const sortedStages = [...trip.stages].sort((a, b) => a.order - b.order)

    if (offline && offlineMapUri) {
      pmtilesProtocol.add(new PMTiles(new OfflinePmtilesSource(offlineMapUri)))
    }

    const map = new maplibregl.Map({
      container,
      style: offline && offlineMapUri ? buildOfflineStyle(theme) : MAP_STYLES[theme],
      center: [136.5, 36.5],
      zoom: 5,
      // Replié en icône (i) plutôt que masqué : l'attribution OpenStreetMap/
      // OpenFreeMap reste requise par leur licence, juste moins envahissante.
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    // MapLibre fails a source/tile fetch by firing 'error' without ever throwing or
    // logging anything on its own — without this listener a broken style/source (e.g.
    // the offline pmtiles source) shows a blank map with zero diagnostic trace.
    map.on('error', (e) => console.error('MapLibre error:', e.error))

    // Appui long (ou clic droit sur desktop) plutôt qu'un simple tap, pour
    // éviter de faire apparaître ce popup au moindre clic accidentel.
    function showAddressPopup(lngLat: maplibregl.LngLat) {
      clickPopupRef.current?.remove()
      const popup = new maplibregl.Popup({ offset: 4 })
        .setLngLat(lngLat)
        .setHTML('<em>Recherche…</em>')
        .addTo(map)
      clickPopupRef.current = popup

      const coords = { lat: lngLat.lat, lng: lngLat.lng }
      reverseGeocode(lngLat.lat, lngLat.lng)
        .then((label) => popup.setHTML(`<strong>${escapeHtml(label)}</strong>${navLinkHtml(coords)}`))
        .catch(() => popup.setHTML(`<em>Adresse introuvable</em>${navLinkHtml(coords)}`))
    }

    function isOnMarkerOrPopup(target: EventTarget | null) {
      return (
        target instanceof HTMLElement &&
        (target.closest('.maplibregl-marker') || target.closest('.maplibregl-popup'))
      )
    }

    // Desktop: navigateur natif (clic droit).
    map.on('contextmenu', (e) => {
      if (isOnMarkerOrPopup(e.originalEvent.target)) return
      e.originalEvent.preventDefault()
      showAddressPopup(e.lngLat)
    })

    // Mobile: MapLibre gère lui-même le pan/zoom tactile, donc le
    // "contextmenu" natif du navigateur ne se déclenche pas de façon fiable
    // au toucher long — on détecte l'appui long nous-mêmes.
    const LONG_PRESS_MS = 550
    const MOVE_CANCEL_PX = 10
    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let longPressStart: { lngLat: maplibregl.LngLat; point: maplibregl.Point } | null = null

    function cancelLongPress() {
      if (longPressTimer) clearTimeout(longPressTimer)
      longPressTimer = null
      longPressStart = null
    }

    map.on('touchstart', (e) => {
      if (e.points.length > 1 || isOnMarkerOrPopup(e.originalEvent.target)) {
        cancelLongPress()
        return
      }
      longPressStart = { lngLat: e.lngLat, point: e.point }
      longPressTimer = setTimeout(() => {
        if (longPressStart) showAddressPopup(longPressStart.lngLat)
        longPressTimer = null
      }, LONG_PRESS_MS)
    })
    map.on('touchmove', (e) => {
      if (!longPressStart) return
      if (e.point.dist(longPressStart.point) > MOVE_CANCEL_PX) cancelLongPress()
    })
    map.on('touchend', cancelLongPress)
    map.on('touchcancel', cancelLongPress)
    map.on('dragstart', cancelLongPress)

    // Un seul listener délégué pour tous les boutons "Voir dans…" des popups,
    // plutôt qu'un par popup — évite de dépendre du cycle de vie DOM interne
    // (création/réouverture) des Popup MapLibre.
    function handleGotoClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest('.popup-goto-btn')
      if (!btn) return
      const kind = btn.getAttribute('data-goto-kind')
      const id = btn.getAttribute('data-goto-id')
      if (!id) return
      if (kind === 'stage') onGoToStage(id)
      else if (kind === 'activity') onGoToActivity(id)
    }
    container.addEventListener('click', handleGotoClick)

    sortedStages.forEach((stage) => {
      const marker = new maplibregl.Marker({ element: makeStageMarkerEl(stage.order) })
        .setLngLat([stage.coordinates.lng, stage.coordinates.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(stagePopupHtml(stage)))
        .addTo(map)
      markersRef.current[stage.id] = marker

      // Logements de la même étape situés ailleurs (ex: deux ryokans dans le
      // même village) : un pin dédié pour pouvoir consulter leurs dates.
      stage.accommodations
        .filter(
          (acc) =>
            acc.coordinates &&
            (acc.coordinates.lat !== stage.coordinates.lat || acc.coordinates.lng !== stage.coordinates.lng),
        )
        .forEach((acc) => {
          new maplibregl.Marker({ element: makeAccommodationMarkerEl() })
            .setLngLat([acc.coordinates!.lng, acc.coordinates!.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 14 }).setHTML(
                `<strong>${escapeHtml(stage.city)}</strong><div>${escapeHtml(acc.name)}<br>${formatDateRange(acc.checkIn, acc.checkOut)}</div><div class="popup-actions">${gotoStageButtonHtml(stage.id)}${navLinkHtml(acc.coordinates!)}</div>`,
              ),
            )
            .addTo(map)
        })

      stage.excursions
        .filter((ex) => ex.coordinates)
        .forEach((ex) => {
          new maplibregl.Marker({ element: makeExcursionMarkerEl() })
            .setLngLat([ex.coordinates!.lng, ex.coordinates!.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 12 }).setHTML(
                `<strong>${escapeHtml(ex.name)}</strong><br>${new Date(ex.date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}${ex.notes ? `<br><em>${escapeHtml(ex.notes)}</em>` : ''}<div class="popup-actions">${gotoStageButtonHtml(stage.id)}${navLinkHtml(ex.coordinates!)}</div>`,
              ),
            )
            .addTo(map)
        })
    })

    const wishlistLabel = trip.wishlistStampLabel ?? DEFAULT_WISHLIST_STAMP_LABEL
    ;(trip.activities ?? [])
      .filter((activity) => activity.coordinates)
      .forEach((activity) => {
        const marker = new maplibregl.Marker({ element: makeActivityMarkerEl(activity.category) })
          .setLngLat([activity.coordinates!.lng, activity.coordinates!.lat])
          .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(activityPopupHtml(activity, wishlistLabel)))
          .addTo(map)
        marker.getElement().style.display = 'none'
        activityMarkerByIdRef.current[activity.id] = marker
      })

    map.on('load', () => {
      // Les chemins/sentiers (highway=path) sont déjà présents dans les tuiles
      // (couche transportation en ligne, roads hors ligne) mais peu visibles
      // par défaut — on les fait ressortir pour repérer les sentiers de rando.
      if (offline && offlineMapUri) {
        map.addLayer({
          id: 'hiking-paths',
          type: 'line',
          source: OFFLINE_SOURCE_NAME,
          'source-layer': 'roads',
          filter: ['==', 'kind', 'path'],
          minzoom: 11,
          paint: {
            'line-color': TRAIL_COLOR[theme],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 3],
            'line-dasharray': [1.5, 0.75],
          },
        })
      } else if (map.getLayer('highway-path')) {
        map.setLayerZoomRange('highway-path', 11, 24)
        map.setPaintProperty('highway-path', 'line-color', TRAIL_COLOR[theme])
        map.setPaintProperty('highway-path', 'line-width', ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 3])
      }

      if (selectedActivityId) {
        const activity = (trip.activities ?? []).find((a) => a.id === selectedActivityId)
        if (activity?.coordinates) {
          map.jumpTo({ center: [activity.coordinates.lng, activity.coordinates.lat], zoom: 16 })
          activityMarkerByIdRef.current[selectedActivityId]?.togglePopup()
        }
      } else if (selectedStageId) {
        const stage = sortedStages.find((s) => s.id === selectedStageId)
        if (stage) {
          map.jumpTo({ center: [stage.coordinates.lng, stage.coordinates.lat], zoom: 11 })
          markersRef.current[selectedStageId]?.togglePopup()
        }
      } else {
        const bounds = new maplibregl.LngLatBounds()
        sortedStages.forEach((stage) => bounds.extend([stage.coordinates.lng, stage.coordinates.lat]))
        map.fitBounds(bounds, { padding: 40, duration: 0 })
      }

      const excursionLegs: TransportLeg[] = sortedStages.flatMap((stage) =>
        stage.excursions
          .filter((ex): ex is typeof ex & { mode: TransportMode; coordinates: NonNullable<typeof ex.coordinates> } =>
            Boolean(ex.mode && ex.coordinates),
          )
          .map((ex) => ({
            id: ex.id,
            mode: ex.mode,
            from: stage.city,
            to: ex.name,
            fromCoordinates: stage.coordinates,
            toCoordinates: ex.coordinates,
          })),
      )
      const legs = [
        ...sortedStages.flatMap((stage) => stage.arrivalLegs ?? []),
        ...excursionLegs,
        ...(trip.departureLegs ?? []),
      ]
      Promise.all(legs.map((leg) => fetchLegCoordinates(leg))).then((coordsList) => {
        const legsByMode: Record<TransportMode, [number, number][][]> = {
          shinkansen: [],
          train: [],
          bus: [],
          plane: [],
          ferry: [],
        }
        legs.forEach((leg, i) => legsByMode[leg.mode].push(coordsList[i]))

        ;(Object.keys(legsByMode) as TransportMode[]).forEach((mode) => {
          const lines = legsByMode[mode]
          if (lines.length === 0) return
          const sourceId = `route-${mode}`
          if (map.getSource(sourceId)) return
          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: lines.map((coordinates) => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates },
              })),
            },
          })
          map.addLayer({
            id: sourceId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: routeLineStyle(mode, theme),
          })
        })
      })
    })

    return () => {
      cancelLongPress()
      container.removeEventListener('click', handleGotoClick)
      map.remove()
      mapRef.current = null
      markersRef.current = {}
      clickPopupRef.current = null
      activityMarkerByIdRef.current = {}
      if (offline && offlineMapUri) DriveFile.closeRangeRead()
    }
    // Mounted fresh each time the map tab is shown (App.tsx also forces a
    // remount via key={mode+theme+tripId} on toggle), so selectedStageId/
    // selectedActivityId/offline/offlineMapUri/theme at mount time are the
    // only values that matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // "Envie de faire" et "Planifiées" sont des filtres rapides indépendants des
    // catégories : dès qu'un des deux est actif, il prime sur la visibilité des
    // catégories (montre toutes les activités concernées, quel que soit leur type)
    // plutôt que de s'y ajouter — combiner "catégorie visible" + "wishlist" était
    // source de confusion (voir historique : fallait activer les deux pour voir quoi que ce soit).
    const quickFilterActive = wishlistOnly || plannedOnly
    ;(trip.activities ?? []).forEach((activity) => {
      const marker = activityMarkerByIdRef.current[activity.id]
      if (!marker) return
      const show = quickFilterActive
        ? (!wishlistOnly || Boolean(activity.wishlist)) && (!plannedOnly || Boolean(activity.date))
        : visibleCategories.has(activity.category)
      marker.getElement().style.display = show ? '' : 'none'
      marker.getElement().classList.toggle('activity-marker--wishlist', wishlistOnly && Boolean(activity.wishlist))
    })
  }, [trip, visibleCategories, wishlistOnly, plannedOnly])

  function toggleCategory(category: ActivityCategory) {
    setVisibleCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  // Compté depuis les données (pas depuis les marqueurs, remplis après le
  // premier rendu et qui ne déclencherait pas de re-render tout seul) — ne
  // compte que les activités géocodées, seules à avoir un pin sur la carte.
  const geocodedCounts = useMemo(() => {
    const counts = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 0])) as Record<ActivityCategory, number>
    let wishlist = 0
    let planned = 0
    ;(trip.activities ?? []).forEach((a) => {
      if (!a.coordinates) return
      counts[a.category]++
      if (a.wishlist) wishlist++
      if (a.date) planned++
    })
    return { byCategory: counts, wishlist, planned }
  }, [trip])

  const activeFilterCount =
    (ALL_CATEGORIES.length - visibleCategories.size) +
    (wishlistOnly ? 1 : 0) +
    (plannedOnly ? 1 : 0)

  function resetFilters() {
    setVisibleCategories(new Set(ALL_CATEGORIES))
    setWishlistOnly(false)
    setPlannedOnly(false)
  }

  return (
    <div className="map-wrapper">
      <div ref={containerRef} className="map-container" />
      <Button
        variant={activeFilterCount > 0 ? 'secondary' : 'ghost'}
        icon="filter"
        className="map-filter-btn"
        onClick={() => setFilterPanelOpen(true)}
      >
        Filtres
        {activeFilterCount > 0 && (
          <Chip as="span" tone="indigo" active className="activities__filter-badge">
            {activeFilterCount}
          </Chip>
        )}
      </Button>
      {filterPanelOpen && (
        <MapFilterModal
          categories={ALL_CATEGORIES}
          visibleCategories={visibleCategories}
          categoryCounts={geocodedCounts.byCategory}
          wishlistOnly={wishlistOnly}
          wishlistCount={geocodedCounts.wishlist}
          plannedOnly={plannedOnly}
          plannedCount={geocodedCounts.planned}
          onToggleCategory={toggleCategory}
          onToggleWishlist={() => setWishlistOnly((prev) => !prev)}
          onTogglePlanned={() => setPlannedOnly((prev) => !prev)}
          onReset={resetFilters}
          onClose={() => setFilterPanelOpen(false)}
        />
      )}
    </div>
  )
}
