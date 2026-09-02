import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import type { Etablissement } from '@/hooks/crm/useEtablissements';

const H = vi.hoisted(() => {
  const mapInstances: unknown[] = [];
  const loadHandlers: Array<() => void> = [];
  const mapAddControl = vi.fn();
  const mapRemove = vi.fn();
  const markerInstances: Array<{ setLngLat: ReturnType<typeof vi.fn> }> = [];
  const popupContents: HTMLElement[] = [];

  class MockMap {
    addControl = mapAddControl;
    remove = mapRemove;
    on = vi.fn((event: string, cb: () => void) => {
      if (event === 'load') loadHandlers.push(cb);
    });
    constructor(_opts: unknown) {
      mapInstances.push(this);
    }
  }

  class MockNavigationControl {
    constructor(_opts?: unknown) {}
  }

  class MockMarker {
    element: HTMLElement;
    setLngLat = vi.fn().mockReturnThis();
    setPopup = vi.fn().mockReturnThis();
    addTo = vi.fn().mockReturnThis();
    remove = vi.fn();
    constructor(el: HTMLElement) {
      this.element = el;
      markerInstances.push(this);
    }
  }

  class MockPopup {
    constructor(_opts?: unknown) {}
    setDOMContent(content: HTMLElement) {
      popupContents.push(content);
      return this;
    }
    remove = vi.fn();
  }

  const mockGetGeoPhaseFromStatus = vi.fn(() => 'signature');

  return {
    mapInstances,
    loadHandlers,
    mapAddControl,
    mapRemove,
    markerInstances,
    popupContents,
    MockMap,
    MockNavigationControl,
    MockMarker,
    MockPopup,
    mockGetGeoPhaseFromStatus,
  };
});

vi.mock('maplibre-gl', () => ({
  default: {
    Map: H.MockMap,
    NavigationControl: H.MockNavigationControl,
    Marker: H.MockMarker,
    Popup: H.MockPopup,
  },
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({ default: {} }));

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: vi.fn(),
}));

vi.mock('@/config/phases', () => ({
  GEO_PHASE_COLORS: { signature: '#22c55e', prospection: '#3b82f6' },
  getGeoPhaseFromStatus: H.mockGetGeoPhaseFromStatus,
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() },
}));

import Map from './Map';

const ETABS = [
  {
    id: '1',
    nom: 'CH Paris',
    ville: 'Paris',
    region: 'Île-de-France',
    statut: 'Signé',
    type: 'CH',
    dpi: 'Easily',
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    id: '2',
    nom: 'CHU Lille',
    ville: 'Lille',
    region: 'Hauts-de-France',
    statut: 'Prospect',
    type: 'CHU',
    dpi: null,
    latitude: 50.6292,
    longitude: 3.0573,
  },
] as unknown as Etablissement[];

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('Map', () => {
  beforeEach(() => {
    H.mapInstances.length = 0;
    H.loadHandlers.length = 0;
    H.markerInstances.length = 0;
    H.popupContents.length = 0;
    H.mapAddControl.mockClear();
    H.mapRemove.mockClear();
    H.mockGetGeoPhaseFromStatus.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('initialise la carte maplibre et ajoute les contrôles de navigation', async () => {
    const { container } = render(<Map etablissements={ETABS} />);
    await flush();

    expect(container.firstElementChild).toBeTruthy();
    expect(H.mapInstances).toHaveLength(1);
    expect(H.mapAddControl).toHaveBeenCalledTimes(1);
    expect(H.mapAddControl).toHaveBeenCalledWith(
      expect.any(H.MockNavigationControl),
      'top-right'
    );
  });

  it('crée un marqueur par établissement avec les coordonnées GPS de la BDD', async () => {
    render(<Map etablissements={ETABS} />);
    await flush();

    expect(H.markerInstances).toHaveLength(2);
    expect(H.markerInstances[0].setLngLat).toHaveBeenCalledWith([2.3522, 48.8566]);
    expect(H.markerInstances[1].setLngLat).toHaveBeenCalledWith([3.0573, 50.6292]);
    expect(H.mockGetGeoPhaseFromStatus).toHaveBeenCalledWith('Signé');
    expect(H.mockGetGeoPhaseFromStatus).toHaveBeenCalledWith('Prospect');
  });

  it('génère un popup avec le nom, la localisation et le DPI de l’établissement', async () => {
    render(<Map etablissements={ETABS} />);
    await flush();

    expect(H.popupContents).toHaveLength(2);
    const firstPopup = H.popupContents[0];
    expect(firstPopup.textContent).toContain('CH Paris');
    expect(firstPopup.textContent).toContain('Paris, Île-de-France');
    expect(firstPopup.textContent).toContain('DPI: ');
    expect(firstPopup.textContent).toContain('Easily');
    expect(firstPopup.textContent).toContain('Statut: ');

    const secondPopup = H.popupContents[1];
    expect(secondPopup.textContent).toContain('CHU Lille');
    expect(secondPopup.textContent).not.toContain('DPI: ');
  });

  it('filtre les établissements selon selectedRegion', async () => {
    render(<Map etablissements={ETABS} selectedRegion="Hauts-de-France" />);
    await flush();

    expect(H.markerInstances).toHaveLength(1);
    expect(H.markerInstances[0].setLngLat).toHaveBeenCalledWith([3.0573, 50.6292]);
    expect(H.popupContents[0].textContent).toContain('CHU Lille');
  });

  it('appelle onMarkerClick avec l’établissement quand on clique sur "Voir le détail"', async () => {
    const onMarkerClick = vi.fn();
    render(<Map etablissements={ETABS} onMarkerClick={onMarkerClick} />);
    await flush();

    const button = H.popupContents[0].querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe('Voir le détail');

    await act(async () => {
      button?.click();
    });

    expect(onMarkerClick).toHaveBeenCalledTimes(1);
    expect(onMarkerClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', nom: 'CH Paris' })
    );
  });

  it('n’affiche pas de bouton de détail sans onMarkerClick', async () => {
    render(<Map etablissements={ETABS} />);
    await flush();

    expect(H.popupContents[0].querySelector('button')).toBeNull();
  });

  it('ne crée aucun marqueur quand la liste est vide', async () => {
    render(<Map etablissements={[]} />);
    await flush();

    expect(H.markerInstances).toHaveLength(0);
    expect(H.popupContents).toHaveLength(0);
  });

  it('nettoie la carte et les marqueurs au démontage', async () => {
    const { unmount } = render(<Map etablissements={ETABS} />);
    await flush();

    const markersBeforeUnmount = [...H.markerInstances];
    unmount();

    expect(H.mapRemove).toHaveBeenCalledTimes(1);
    markersBeforeUnmount.forEach((marker) => {
      expect((marker as unknown as { remove: ReturnType<typeof vi.fn> }).remove).toHaveBeenCalled();
    });
  });
});