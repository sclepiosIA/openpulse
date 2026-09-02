import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Carte d'un lieu de rendez-vous.
 *
 * POURQUOI CE COMPOSANT A CHANGÉ DE BIBLIOTHÈQUE
 * Il s'appuyait sur `react-leaflet`, publié sous licence Hippocratic-2.1 —
 * qui n'est pas une licence libre reconnue et impose des restrictions d'usage
 * incompatibles avec la distribution MIT de ce dépôt. `leaflet` lui-même est
 * pourtant en BSD-2 : c'est le liant React, et lui seul, qui posait problème.
 *
 * Plutôt que de réécrire ce liant, on emploie `maplibre-gl` (BSD-3), DÉJÀ
 * présent dans l'arbre et déjà utilisé par `src/components/pipeline/Map.tsx`.
 * Le dépôt portait donc deux bibliothèques de cartes pour deux écrans : celle
 * qui restait est aussi celle dont la licence convient.
 *
 * ET UNE FUITE VERS UN SERVICE TIERS EN MOINS
 * La version précédente chargeait sa feuille de style et ses trois images de
 * marqueur depuis unpkg.com, à chaque affichage — sur une distribution qui
 * annonce à l'écran de connexion que les données restent chez l'exploitant.
 * La feuille de style est désormais empaquetée avec l'application, et le
 * marqueur est dessiné par la bibliothèque : plus aucun appel à unpkg.
 *
 * Les tuiles, elles, viennent toujours d'openstreetmap.org : une carte a besoin
 * de fonds de plan, et c'est la même source que l'autre écran de cartographie.
 * C'est un appel sortant assumé, visible dans la politique de sécurité de
 * contenu, et remplaçable par un serveur de tuiles interne.
 */

interface Props {
  lat: number;
  lng: number;
  label?: string;
}

export default function LocationMapInner({ lat, lng, label }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<maplibregl.Map | null>(null);
  const marqueur = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!conteneur.current || carte.current) return;

    carte.current = new maplibregl.Map({
      container: conteneur.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [lng, lat],
      zoom: 15,
      // La molette ne doit pas capturer le défilement de la page : c'est le
      // comportement qu'avait `scrollWheelZoom={false}` sur l'implémentation
      // précédente, et le perdre rend la fiche de rendez-vous pénible à lire.
      scrollZoom: false,
    });

    carte.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    marqueur.current = new maplibregl.Marker().setLngLat([lng, lat]).addTo(carte.current);

    return () => {
      marqueur.current?.remove();
      marqueur.current = null;
      carte.current?.remove();
      carte.current = null;
    };
    // Volontairement au montage seul : le recentrage sur changement de
    // coordonnées est traité par l'effet suivant, sans reconstruire la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentrage, équivalent du composant `Recenter` de la version précédente.
  useEffect(() => {
    if (!carte.current) return;
    carte.current.setCenter([lng, lat]);
    marqueur.current?.setLngLat([lng, lat]);
  }, [lat, lng]);

  return (
    <div
      ref={conteneur}
      style={{ height: '100%', width: '100%' }}
      role="img"
      aria-label={label ? `Carte : ${label}` : 'Carte du lieu'}
    />
  );
}
