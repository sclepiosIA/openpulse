// @vitest-environment jsdom

import React from 'react';
import { render, cleanup } from '@testing-library/react';

/**
 * Ces attentes ont changé avec la bibliothèque : le composant employait
 * `react-leaflet` (Hippocratic-2.1, incompatible avec la distribution MIT) et
 * emploie maintenant `maplibre-gl` (BSD-3), déjà présent dans l'arbre.
 *
 * Le dernier test est un garde-fou et non une vérification de rendu : la
 * version précédente allait chercher sa feuille de style et ses images de
 * marqueur sur unpkg.com à chaque affichage. Sur une distribution qui promet
 * que les données restent chez l'exploitant, une carte qui appelle un CDN tiers
 * est une fuite — et elle était invisible, parce que rien ne la testait.
 */

const { constructeurCarte, setCenter, addControl, removeCarte,
        marqueurSetLngLat, marqueurAddTo, marqueurRemove } = vi.hoisted(() => ({
  constructeurCarte: vi.fn(),
  setCenter: vi.fn(),
  addControl: vi.fn(),
  removeCarte: vi.fn(),
  marqueurSetLngLat: vi.fn(),
  marqueurAddTo: vi.fn(),
  marqueurRemove: vi.fn(),
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

vi.mock('maplibre-gl', () => {
  class Map {
    constructor(options: unknown) { constructeurCarte(options); }
    setCenter = setCenter;
    addControl = addControl;
    remove = removeCarte;
  }
  class Marker {
    setLngLat = (c: unknown) => { marqueurSetLngLat(c); return this; };
    addTo = (m: unknown) => { marqueurAddTo(m); return this; };
    remove = marqueurRemove;
  }
  class NavigationControl {}
  return { default: { Map, Marker, NavigationControl } };
});

import LocationMapInner from './LocationMapInner';

describe('LocationMapInner', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('centre la carte sur les coordonnées reçues, en ordre longitude puis latitude', () => {
    render(<LocationMapInner lat={48.8566} lng={2.3522} label="Siège" />);
    expect(constructeurCarte).toHaveBeenCalledTimes(1);
    const options = constructeurCarte.mock.calls[0][0] as { center: number[]; zoom: number };
    // L'inversion longitude/latitude est l'erreur classique de ce portage :
    // leaflet attend [lat, lng], maplibre attend [lng, lat]. Une carte
    // silencieusement posée au milieu de l'océan Indien en serait le symptôme.
    expect(options.center).toEqual([2.3522, 48.8566]);
    expect(options.zoom).toBe(15);
  });

  it('ne laisse pas la molette capturer le défilement de la page', () => {
    render(<LocationMapInner lat={1} lng={2} />);
    const options = constructeurCarte.mock.calls[0][0] as { scrollZoom: boolean };
    expect(options.scrollZoom).toBe(false);
  });

  it('pose un marqueur au même endroit que le centre', () => {
    render(<LocationMapInner lat={48.8566} lng={2.3522} />);
    expect(marqueurSetLngLat).toHaveBeenCalledWith([2.3522, 48.8566]);
    expect(marqueurAddTo).toHaveBeenCalledTimes(1);
  });

  it('recentre sans reconstruire la carte quand les coordonnées changent', () => {
    const { rerender } = render(<LocationMapInner lat={48.85} lng={2.35} />);
    rerender(<LocationMapInner lat={45.75} lng={4.85} />);
    expect(setCenter).toHaveBeenCalledWith([4.85, 45.75]);
    expect(constructeurCarte).toHaveBeenCalledTimes(1);
  });

  it('libère la carte au démontage', () => {
    const { unmount } = render(<LocationMapInner lat={1} lng={2} />);
    unmount();
    expect(removeCarte).toHaveBeenCalledTimes(1);
    expect(marqueurRemove).toHaveBeenCalledTimes(1);
  });

  it('ne va chercher aucune ressource sur un service tiers', () => {
    render(<LocationMapInner lat={1} lng={2} />);
    const source = String(constructeurCarte.mock.calls[0][0]);
    expect(document.head.innerHTML).not.toMatch(/unpkg\.com/);
    expect(source).not.toMatch(/unpkg\.com/);
  });
});
