import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Etablissement } from '@/hooks/crm/useEtablissements'
import { GEO_PHASE_COLORS } from '@/config/phases'
import { getGeoPhaseFromStatus } from '@/config/phases'
import { debug } from '@/lib/debug'

interface MapProps {
  etablissements: Etablissement[]
  className?: string
  onMarkerClick?: (etablissement: Etablissement) => void
  selectedRegion?: string | null
  enableClustering?: boolean
}

const Map: React.FC<MapProps> = ({
  etablissements,
  className = '',
  onMarkerClick,
  selectedRegion,
  enableClustering = false,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const markerListenersRef = useRef<
    Array<{ element: HTMLElement; listeners: Array<{ type: string; handler: EventListener }> }>
  >([])
  const popupsRef = useRef<maplibregl.Popup[]>([])

  // Filter establishments by selected region
  const filteredEtablissements = selectedRegion
    ? etablissements.filter((e) => e.region === selectedRegion)
    : etablissements

  useEffect(() => {
    if (!mapContainer.current) return

    // Initialize map
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
            },
          ],
        },
        center: [2.3522, 48.8566], // Paris, France
        zoom: 5.5,
      })

      // Add navigation controls
      map.current.addControl(
        new maplibregl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      )

      // Wait for map to load before adding markers
      map.current.on('load', () => {
        addEtablissementMarkers()
      })
    } catch (error) {
      debug.error('Map component - Error creating map:', error)
    }

    return () => {
      // Nettoyage des event listeners des marqueurs
      try {
        markerListenersRef.current.forEach(({ element, listeners }) => {
          listeners.forEach(({ type, handler }) => {
            try {
              element.removeEventListener(type, handler)
            } catch (listenerError) {
              debug.warn('Warning: event listener removal failed:', listenerError)
            }
          })
        })
        markerListenersRef.current = []
      } catch (listenerCleanupError) {
        debug.warn('Warning: marker listeners cleanup failed:', listenerCleanupError)
      }

      // Nettoyage des popups
      try {
        popupsRef.current.forEach((popup) => popup.remove())
        popupsRef.current = []
      } catch (popupCleanupError) {
        debug.warn('Warning: popup cleanup failed:', popupCleanupError)
      }

      // Nettoyage sécurisé des marqueurs existants
      try {
        markersRef.current.forEach((marker) => {
          try {
            marker.remove()
          } catch (markerError) {
            debug.warn('Warning: marker removal failed:', markerError)
          }
        })
        markersRef.current = []
      } catch (cleanupError) {
        debug.warn('Warning: marker cleanup failed:', cleanupError)
      }

      // Nettoyage sécurisé de la carte
      try {
        if (map.current) {
          map.current.remove()
          map.current = null
        }
      } catch (mapError) {
        debug.warn('Warning: map removal failed:', mapError)
      }
    }
  }, [])

  useEffect(() => {
    if (map.current) {
      addEtablissementMarkers()
    }
  }, [filteredEtablissements, selectedRegion])

  const addEtablissementMarkers = () => {
    if (!map.current) return

    // Nettoyage des event listeners existants
    try {
      markerListenersRef.current.forEach(({ element, listeners }) => {
        listeners.forEach(({ type, handler }) => {
          try {
            element.removeEventListener(type, handler)
          } catch (listenerError) {
            debug.warn('Warning: event listener removal failed:', listenerError)
          }
        })
      })
      markerListenersRef.current = []
    } catch (listenerCleanupError) {
      debug.warn('Warning: marker listeners cleanup failed:', listenerCleanupError)
    }

    // Nettoyage sécurisé des marqueurs existants
    try {
      markersRef.current.forEach((marker) => {
        try {
          marker.remove()
        } catch (markerError) {
          debug.warn('Warning: marker removal failed:', markerError)
        }
      })
      markersRef.current = []
    } catch (cleanupError) {
      debug.warn('Warning: marker cleanup failed:', cleanupError)
    }

    // Nettoyage des popups existants
    try {
      popupsRef.current.forEach((popup) => popup.remove())
      popupsRef.current = []
    } catch (popupCleanupError) {
      debug.warn('Warning: popup cleanup failed:', popupCleanupError)
    }

    filteredEtablissements.forEach((etablissement) => {
      // Priorité: coordonnées GPS de la BDD, sinon fallback géocodage local
      const etabAny = etablissement as any
      const hasDbCoords =
        typeof etabAny.latitude === 'number' && typeof etabAny.longitude === 'number'

      const coordsPromise = hasDbCoords
        ? Promise.resolve([etabAny.longitude, etabAny.latitude] as [number, number])
        : getCoordinates(etablissement.ville, etablissement.region)

      coordsPromise
        .then((coordinates) => {
          if (coordinates && map.current) {
            const phase = getGeoPhaseFromStatus(etablissement.statut)
            const color = GEO_PHASE_COLORS[phase] || '#6b7280'

            // Créer un élément DOM pour le marqueur
            const markerElement = document.createElement('div')
            markerElement.className = 'marker'
            markerElement.style.backgroundColor = color
            markerElement.style.width = '16px'
            markerElement.style.height = '16px'
            markerElement.style.borderRadius = '50%'
            markerElement.style.border = '3px solid white'
            markerElement.style.cursor = 'pointer'
            markerElement.style.boxShadow = '0 3px 6px rgba(0,0,0,0.4)'
            markerElement.style.transition = 'all 0.2s ease'

            // Effet hover avec nettoyage des listeners
            let isHovered = false
            const mouseEnterHandler = () => {
              isHovered = true
              markerElement.style.transform = 'scale(1.2)'
              markerElement.style.zIndex = '1000'
            }

            const mouseLeaveHandler = () => {
              isHovered = false
              markerElement.style.transform = 'scale(1)'
              markerElement.style.zIndex = '1'
            }

            markerElement.addEventListener('mouseenter', mouseEnterHandler)
            markerElement.addEventListener('mouseleave', mouseLeaveHandler)

            // Stocker les listeners pour nettoyage ultérieur
            markerListenersRef.current.push({
              element: markerElement,
              listeners: [
                { type: 'mouseenter', handler: mouseEnterHandler },
                { type: 'mouseleave', handler: mouseLeaveHandler },
              ],
            })

            // Créer le popup avec contenu sécurisé et enrichi
            const popupDiv = document.createElement('div')
            popupDiv.className = 'p-3 min-w-[200px]'

            const titleElement = document.createElement('h3')
            titleElement.className = 'font-bold text-base mb-2'
            titleElement.textContent = etablissement.nom

            const locationElement = document.createElement('p')
            locationElement.className = 'text-sm text-muted-foreground mb-2'
            locationElement.textContent = `${etablissement.ville}, ${etablissement.region}`

            const detailsContainer = document.createElement('div')
            detailsContainer.className = 'space-y-1 text-sm'

            // SECURITY: Use textContent instead of innerHTML to prevent XSS
            const statusLine = document.createElement('p')
            const statusLabel = document.createElement('span')
            statusLabel.className = 'font-medium'
            statusLabel.textContent = 'Statut: '
            statusLine.appendChild(statusLabel)
            statusLine.appendChild(document.createTextNode(etablissement.statut || ''))

            const typeLine = document.createElement('p')
            const typeLabel = document.createElement('span')
            typeLabel.className = 'font-medium'
            typeLabel.textContent = 'Type: '
            typeLine.appendChild(typeLabel)
            typeLine.appendChild(document.createTextNode(etablissement.type || ''))

            detailsContainer.appendChild(statusLine)
            detailsContainer.appendChild(typeLine)

            if (etablissement.dpi) {
              const dpiLine = document.createElement('p')
              const dpiLabel = document.createElement('span')
              dpiLabel.className = 'font-medium'
              dpiLabel.textContent = 'DPI: '
              dpiLine.appendChild(dpiLabel)
              dpiLine.appendChild(document.createTextNode(etablissement.dpi))
              detailsContainer.appendChild(dpiLine)
            }

            popupDiv.appendChild(titleElement)
            popupDiv.appendChild(locationElement)
            popupDiv.appendChild(detailsContainer)

            if (onMarkerClick) {
              const viewButton = document.createElement('button')
              viewButton.className =
                'mt-2 w-full px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
              viewButton.textContent = 'Voir le détail'
              viewButton.onclick = () => onMarkerClick(etablissement)
              popupDiv.appendChild(viewButton)
            }

            const popup = new maplibregl.Popup({
              offset: 25,
              closeButton: true,
              closeOnClick: false,
            }).setDOMContent(popupDiv)

            popupsRef.current.push(popup)

            // Ajouter le marqueur
            const marker = new maplibregl.Marker(markerElement)
              .setLngLat(coordinates)
              .setPopup(popup)
              .addTo(map.current)

            // Stocker la référence du marqueur
            markersRef.current.push(marker)

            // Animation d'apparition
            markerElement.style.opacity = '0'
            markerElement.style.transform = 'scale(0.5)'
            requestAnimationFrame(() => {
              markerElement.style.transition = 'all 0.3s ease-out'
              markerElement.style.opacity = '1'
              markerElement.style.transform = isHovered ? 'scale(1.2)' : 'scale(1)'
            })
          }
        })
        .catch((error) => {
          debug.warn(
            `Géocodage échoué pour ${etablissement.ville}, ${etablissement.region}:`,
            error
          )
        })
    })
  }

  const getCoordinates = async (
    ville: string,
    region: string
  ): Promise<[number, number] | null> => {
    // For now, we use hardcoded coordinates (latitude/longitude storage can be added later)

    // Fallback to hardcoded coordinates for major French cities
    const cityCoordinates: Record<string, [number, number]> = {
      // Île-de-France
      paris: [2.3522, 48.8566],
      argenteuil: [2.2478, 48.9477],
      pontoise: [2.0944, 49.0506],
      'mantes-la-jolie': [1.7169, 48.9906],
      'saint-denis-idf': [2.3565, 48.9362], // Saint-Denis Île-de-France
      rambouillet: [1.8315, 48.6439],

      // Hauts-de-France
      valenciennes: [3.5218, 50.3598],
      amiens: [2.2956, 49.8942],
      lille: [3.0573, 50.6292],
      douai: [3.0808, 50.3711],
      calais: [1.8542, 50.9513],
      dunkerque: [2.3822, 51.0347],
      'boulogne-sur-mer': [1.6138, 50.7264],
      'le-cateau-cambresis': [3.5439, 50.1061],
      'cateau-cambresis': [3.5439, 50.1061],

      // Normandie
      'verneuil-sur-avre': [0.9336, 48.7394],
      rouen: [1.0999, 49.4431],
      caen: [0.3707, 49.1829],
      'le havre': [0.107, 49.4944],
      cherbourg: [1.6369, 49.6338],

      // Grand Est
      épinal: [6.4498, 48.1736],
      epinal: [6.4498, 48.1736],
      strasbourg: [7.7521, 48.5734],
      metz: [6.1757, 49.1193],
      nancy: [6.184, 48.6921],
      reims: [4.0317, 49.2583],
      mulhouse: [7.3359, 47.7508],
      colmar: [7.3589, 48.0794],

      // Bourgogne-Franche-Comté
      'lons-le-saunier': [5.5547, 46.6756],
      dijon: [5.0415, 47.322],
      besançon: [6.024, 47.2378],
      'chalon-sur-saône': [4.8565, 46.7811],

      // Auvergne-Rhône-Alpes
      lyon: [4.8357, 45.764],
      grenoble: [5.7243, 45.1885],
      'saint-étienne': [4.3872, 45.4397],
      'clermont-ferrand': [3.0863, 45.7772],
      villeurbanne: [4.8794, 45.7665],
      annecy: [6.1294, 45.8992],

      // Provence-Alpes-Côte d'Azur
      marseille: [5.3698, 43.2965],
      nice: [7.2619, 43.7102],
      toulon: [5.928, 43.1242],
      'aix-en-provence': [5.4474, 43.5297],
      cannes: [7.0171, 43.5513],

      // Occitanie
      toulouse: [1.4442, 43.6047],
      montpellier: [3.8767, 43.6109],
      nîmes: [4.3601, 43.8367],
      perpignan: [2.8956, 42.6886],

      // Nouvelle-Aquitaine
      bordeaux: [0.5792, 44.8378],
      limoges: [1.2611, 45.8336],
      poitiers: [0.3344, 46.5802],
      pau: [0.3706, 43.2951],
      'la rochelle': [1.1517, 46.1603],

      // Pays de la Loire
      nantes: [1.5534, 47.2184],
      angers: [0.5553, 47.4784],
      'le mans': [0.1996, 47.9965],

      // Bretagne
      rennes: [1.6778, 48.1173],
      brest: [4.486, 48.3904],
      quimper: [4.0977, 47.996],
      cornouaille: [4.0977, 47.996], // Cornouaille = Quimper
      lorient: [3.3668, 47.7482],
      'saint-brieuc': [2.7659, 48.5149],
      vannes: [2.7574, 47.6584],
      fougères: [-1.2019, 48.3534], // Fougères
      fougeres: [-1.2019, 48.3534], // Fougères sans accent
      'saint-malo': [-1.9981, 48.6496],
      lannion: [-3.4592, 48.732],

      // Centre-Val de Loire
      bourges: [2.3964, 47.081],
      chartres: [1.4877, 48.447],
      blois: [1.3302, 47.5868],
      tours: [0.6848, 47.3941],
      orleans: [1.9039, 47.9029],
      châteauroux: [1.6906, 46.8115],

      // Villes supplémentaires importantes
      béziers: [3.2136, 43.3409],
      narbonne: [3.0027, 43.1839],
      carcassonne: [2.3491, 43.213],
      albi: [2.1481, 43.9298],
      tarbes: [0.0792, 43.2337],
      bayonne: [-1.4748, 43.4832],
      agen: [0.6237, 44.2028],
      périgueux: [0.7213, 45.1885],
      guéret: [1.871, 46.1699],
      tulle: [1.7713, 45.2661],
      aurillac: [2.4419, 44.9236],
      'le-puy-en-velay': [3.8847, 45.0439],
      privas: [4.5996, 44.7355],
      valence: [4.8918, 44.9322],
      chambéry: [5.9158, 45.5646],
      'bourg-en-bresse': [5.2281, 46.2059],
      mâcon: [4.8323, 46.3063],
      nevers: [3.1569, 47.0038],
      auxerre: [3.5726, 47.7982],
      sens: [3.2836, 48.1989],
      troyes: [4.0838, 48.2973],
      chaumont: [5.1391, 48.1115],
      'châlons-en-champagne': [4.3676, 48.9567],
      'charleville-mézières': [4.7197, 49.7634],
      sedan: [4.9378, 49.7011],
      verdun: [5.3872, 49.159],
      'bar-le-duc': [5.1609, 48.7706],
      épernay: [3.959, 49.0373],

      // Outre-mer - COORDONNÉES CORRIGÉES [longitude, latitude]
      'fort-de-france': [-61.0594, 14.6037], // Martinique
      'pointe-a-pitre': [-61.533, 16.2413], // Guadeloupe
      cayenne: [-52.3236, 4.9344], // Guyane
      'saint-denis-reunion': [55.4504, -20.8789], // Réunion
      noumea: [166.4572, -22.2758], // Nouvelle-Calédonie
      mamoudzou: [45.2275, -12.7806], // Mayotte

      // Villes supplémentaires pour améliorer le géocodage
      'saint-pierre': [55.4785, -21.3393], // Saint-Pierre, Réunion
      'le-tampon': [55.5155, -21.2784], // Le Tampon, Réunion
      'saint-paul': [55.2699, -21.0099], // Saint-Paul, Réunion
      'saint-louis': [55.4099, -21.2906], // Saint-Louis, Réunion
    }

    const normalizedVille = ville
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z\s-]/g, '') // Garder seulement les lettres, espaces et tirets
      .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
      .trim()

    // Recherche directe
    if (cityCoordinates[normalizedVille]) {
      return cityCoordinates[normalizedVille]
    }

    // Recherche avec des variantes communes
    const variants = [
      normalizedVille,
      normalizedVille.replace('-', ' '),
      normalizedVille.replace(' ', '-'),
      normalizedVille.replace(/^le-/, ''),
      normalizedVille.replace(/^la-/, ''),
      normalizedVille.replace(/^les-/, ''),
      normalizedVille.replace(/^saint-/, 'st-'),
      normalizedVille.replace(/^st-/, 'saint-'),
    ]

    for (const variant of variants) {
      if (cityCoordinates[variant]) {
        return cityCoordinates[variant]
      }
    }

    // Recherche partielle
    for (const [cityKey, coords] of Object.entries(cityCoordinates)) {
      if (cityKey.includes(normalizedVille) || normalizedVille.includes(cityKey)) {
        return coords
      }
    }

    // Si aucune correspondance, retourner des coordonnées par défaut pour la région
    const regionCoordinates: Record<string, [number, number]> = {
      'île-de-france': [2.3522, 48.8566],
      'ile-de-france': [2.3522, 48.8566],
      'auvergne-rhône-alpes': [4.8357, 45.764],
      'auvergne-rhone-alpes': [4.8357, 45.764],
      "provence-alpes-côte d'azur": [5.3698, 43.2965],
      'provence-alpes-cote-d-azur': [5.3698, 43.2965],
      occitanie: [1.4442, 43.6047],
      'nouvelle-aquitaine': [0.5792, 44.8378],
      'grand est': [7.7521, 48.5734],
      'hauts-de-france': [3.0573, 50.6292],
      'pays de la loire': [1.5534, 47.2184],
      bretagne: [1.6778, 48.1173],
      normandie: [1.0999, 49.4431],
      'bourgogne-franche-comté': [5.0415, 47.322],
      'bourgogne-franche-comte': [5.0415, 47.322],
      'centre-val de loire': [1.902, 47.9029],
      martinique: [-61.0594, 14.6037],
      guadeloupe: [-61.533, 16.2413],
      guyane: [-52.3236, 4.9344],
      réunion: [55.4504, -20.8789],
      reunion: [55.4504, -20.8789],
      mayotte: [45.2275, -12.7806],
    }

    const normalizedRegion = region
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (regionCoordinates[normalizedRegion]) {
      return regionCoordinates[normalizedRegion]
    }
    return null
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainer}
        className="absolute inset-0 rounded-lg shadow-lg"
        style={{
          minHeight: '350px',
          height: '50vh',
        }}
      />
      {/* Mobile-friendly overlay controls could be added here */}
      <div className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-auto sm:bottom-4 pointer-events-none">
        <div className="bg-card/90 backdrop-blur-sm rounded-lg p-2 text-xs text-foreground shadow-sm sm:max-w-xs">
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Production</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Déploiement</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span>Prospect</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Map
