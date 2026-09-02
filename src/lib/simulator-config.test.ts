import {
  DEFAULT_SIMULATION_PARAMS,
  CENTER_TYPES,
  DPI_TYPES,
  RESELLER_TYPES,
  PALIER_CONFIG,
  SIMULATOR_COLORS,
  LEVIER_NAMES,
  formatEuro,
  formatNumber,
  formatPercent,
  getCenterTypeById,
  getDPITypeById,
  getResellerTypeById,
} from './simulator-config';

describe('simulator-config constants and helpers', () => {
  it('DEFAULT_SIMULATION_PARAMS contains expected default values', () => {
    expect(DEFAULT_SIMULATION_PARAMS.passages).toBe(40000);
    expect(DEFAULT_SIMULATION_PARAMS.baseline).toBe(5);
    expect(DEFAULT_SIMULATION_PARAMS.cible).toBe(11);
    expect(DEFAULT_SIMULATION_PARAMS.taux_mono).toBe(70);
    expect(DEFAULT_SIMULATION_PARAMS.taux_avis_baseline).toBe(3);
    expect(DEFAULT_SIMULATION_PARAMS.taux_avis_cible).toBe(7);
    expect(DEFAULT_SIMULATION_PARAMS.taux_ccmu2_baseline).toBe(2);
    expect(DEFAULT_SIMULATION_PARAMS.taux_ccmu2_cible).toBe(5);
    expect(DEFAULT_SIMULATION_PARAMS.taux_ccmu3_baseline).toBe(2);
    expect(DEFAULT_SIMULATION_PARAMS.taux_ccmu3_cible).toBe(5);
    expect(DEFAULT_SIMULATION_PARAMS.TARIF_UHCD).toBe(400);
    expect(DEFAULT_SIMULATION_PARAMS.TARIF_AVIS_SPE).toBe(31.5);
    expect(DEFAULT_SIMULATION_PARAMS.TARIF_CCMU2).toBe(14.53);
    expect(DEFAULT_SIMULATION_PARAMS.TARIF_CCMU3).toBe(19.38);
    expect(DEFAULT_SIMULATION_PARAMS.BONUS_MONORUM).toBe(0.05);
  });

  it('CENTER_TYPES contains 3 items with correct fields', () => {
    expect(CENTER_TYPES).toHaveLength(3);
    const ch = CENTER_TYPES.find(c => c.id === 'ch');
    const chu = CENTER_TYPES.find(c => c.id === 'chu');
    const ght = CENTER_TYPES.find(c => c.id === 'ght');
    expect(ch?.name).toBe('Centres Hospitaliers');
    expect(ch?.prixPAU).toBe(2.0);
    expect(ch?.multiplicateurFrais).toBe(1.0);
    expect(chu?.name).toBe('Établissements supports & CHU');
    expect(chu?.prixPAU).toBe(2.30);
    expect(chu?.multiplicateurFrais).toBe(1.5);
    expect(ght?.name).toBe('Groupements Hospitaliers de Territoire (GHT)');
    expect(ght?.prixPAU).toBe(2.60);
    expect(ght?.multiplicateurFrais).toBe(2.0);
  });

  it('DPI_TYPES contains 2 items with correct fields', () => {
    expect(DPI_TYPES).toHaveLength(2);
    const web = DPI_TYPES.find(d => d.id === 'web');
    const nonWeb = DPI_TYPES.find(d => d.id === 'non-web');
    expect(web?.name).toBe('DPI Web');
    expect(web?.baseFrais).toBe(5000);
    expect(nonWeb?.name).toBe('DPI Non-Web');
    expect(nonWeb?.baseFrais).toBe(10000);
  });

  it('RESELLER_TYPES contains 2 items with correct fields', () => {
    expect(RESELLER_TYPES).toHaveLength(2);
    const softway = RESELLER_TYPES.find(r => r.id === 'softway');
    const effigen = RESELLER_TYPES.find(r => r.id === 'effigen');
    expect(softway?.name).toBe('Softway Médical');
    expect(softway?.markup).toBe(0.50);
    expect(effigen?.name).toBe('Effigen');
    expect(effigen?.markup).toBe(0.40);
  });

  it('PALIER_CONFIG contains 4 paliers with expected properties', () => {
    expect(PALIER_CONFIG).toHaveLength(4);
    const p1 = PALIER_CONFIG[0];
    const p2 = PALIER_CONFIG[1];
    const p3 = PALIER_CONFIG[2];
    const p4 = PALIER_CONFIG[3];

    expect(p1.palier).toBe(1);
    expect(p1.conditionMin).toBe(0);
    expect(p1.conditionMax).toBe(8);
    expect(p1.multiplicateur).toBe(0.25);
    expect(p1.augmentationMonoRum).toBe(1);

    expect(p2.palier).toBe(2);
    expect(p2.conditionMin).toBe(8);
    expect(p2.conditionMax).toBe(9);
    expect(p2.multiplicateur).toBe(0.50);
    expect(p2.augmentationMonoRum).toBe(2);

    expect(p3.palier).toBe(3);
    expect(p3.conditionMin).toBe(9);
    expect(p3.conditionMax).toBe(10);
    expect(p3.multiplicateur).toBe(0.975);
    expect(p3.augmentationMonoRum).toBe(3);

    expect(p4.palier).toBe(4);
    expect(p4.conditionMin).toBe(10);
    expect(p4.conditionMax).toBe(Infinity);
    expect(p4.multiplicateur).toBe(1.50);
    expect(p4.augmentationMonoRum).toBe(4);
  });

  it('SIMULATOR_COLORS exposes expected palette values', () => {
    expect(SIMULATOR_COLORS.blue[25]).toBe('#F0F6FF');
    expect(SIMULATOR_COLORS.blue[200]).toBe('#85B3FF');
    expect(SIMULATOR_COLORS.blue[500]).toBe('#2563EB');
    expect(SIMULATOR_COLORS.orange[500]).toBe('#F97316');
  });

  it('LEVIER_NAMES contains expected labels', () => {
    expect(LEVIER_NAMES.avis).toBe('Avis spécialisés');
    expect(LEVIER_NAMES.ccmu2).toBe('CCMU 2+');
    expect(LEVIER_NAMES.ccmu3).toBe('CCMU 3 et au-dessus');
    expect(LEVIER_NAMES.uhcd).toBe('UHCD Mono-RUM');
    expect(LEVIER_NAMES.bonus).toBe('Majoration 5% mono-RUM');
  });

  it('formatEuro formats values in fr-FR currency without decimals', () => {
    const v1 = formatEuro(1234);
    expect(v1).toMatch(/^1[\u00A0\u202F]234[\u00A0]€$/);

    const v2 = formatEuro(1999.6);
    expect(v2).toMatch(/^2[\u00A0\u202F]000[\u00A0]€$/);

    const v3 = formatEuro(0);
    expect(v3).toMatch(/^0[\u00A0]€$/);
  });

  it('formatNumber formats with fr-FR grouping and rounds to nearest integer', () => {
    const n1 = formatNumber(1234.5);
    expect(n1).toMatch(/^1[\u00A0\u202F]235$/);

    const n2 = formatNumber(999.4);
    expect(n2).toBe('999');

    const n3 = formatNumber(1000000);
    expect(n3).toMatch(/^1[\u00A0\u202F]000[\u00A0\u202F]000$/);
  });

  it('formatPercent formats with default 1 decimal and custom decimals', () => {
    expect(formatPercent(12.345)).toBe('12.3%');
    expect(formatPercent(5, 2)).toBe('5.00%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('getCenterTypeById returns the correct center type or undefined', () => {
    const ct = getCenterTypeById('chu');
    expect(ct?.name).toBe('Établissements supports & CHU');
    expect(ct?.prixPAU).toBe(2.30);
    expect(ct?.multiplicateurFrais).toBe(1.5);

    const unknown = getCenterTypeById('unknown');
    expect(unknown).toBeUndefined();
  });

  it('getDPITypeById returns the correct DPI type or undefined', () => {
    const dt = getDPITypeById('web');
    expect(dt?.name).toBe('DPI Web');
    expect(dt?.baseFrais).toBe(5000);

    const unknown = getDPITypeById('xxx');
    expect(unknown).toBeUndefined();
  });

  it('getResellerTypeById returns the correct reseller type or undefined', () => {
    const rt = getResellerTypeById('effigen');
    expect(rt?.name).toBe('Effigen');
    expect(rt?.markup).toBe(0.40);

    const unknown = getResellerTypeById('nope');
    expect(unknown).toBeUndefined();
  });
});