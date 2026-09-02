import {
  ACCES_FORMATION,
  BEAUCOUP_PAS_DU_TOUT,
  CSM_COMPREHENSION,
  CSM_CONTRIB,
  CSM_FREQUENCE,
  CSM_REACTIVITE,
  CSM_UTILITE_COMITES,
  DPIS,
  ENQUETE_LABELS,
  FONCTIONNALITES,
  FONCTIONS,
  FORMATION_RECUE,
  FREQUENCE_USAGE,
  GAIN_TEMPS,
  INTENTION_USAGE,
  MODULES,
  OUI_NON_4,
  OUI_PARTIEL_NON,
  type EnqueteType,
} from './constants';

type Option = Readonly<{
  value: string;
  label: string;
}>;

const REFERENTIELS: ReadonlyArray<readonly [name: string, options: readonly Option[], expectedLength: number]> = [
  ['FONCTIONS', FONCTIONS, 8],
  ['DPIS', DPIS, 7],
  ['FONCTIONNALITES', FONCTIONNALITES, 5],
  ['MODULES', MODULES, 4],
  ['OUI_NON_4', OUI_NON_4, 4],
  ['OUI_PARTIEL_NON', OUI_PARTIEL_NON, 3],
  ['INTENTION_USAGE', INTENTION_USAGE, 4],
  ['ACCES_FORMATION', ACCES_FORMATION, 3],
  ['FREQUENCE_USAGE', FREQUENCE_USAGE, 4],
  ['BEAUCOUP_PAS_DU_TOUT', BEAUCOUP_PAS_DU_TOUT, 4],
  ['GAIN_TEMPS', GAIN_TEMPS, 5],
  ['FORMATION_RECUE', FORMATION_RECUE, 3],
  ['CSM_CONTRIB', CSM_CONTRIB, 4],
  ['CSM_COMPREHENSION', CSM_COMPREHENSION, 4],
  ['CSM_REACTIVITE', CSM_REACTIVITE, 4],
  ['CSM_UTILITE_COMITES', CSM_UTILITE_COMITES, 4],
  ['CSM_FREQUENCE', CSM_FREQUENCE, 3],
];

describe('constants', () => {
  it('expose les référentiels avec les longueurs attendues', () => {
    for (const [name, options, expectedLength] of REFERENTIELS) {
      expect(options, name).toHaveLength(expectedLength);
    }
  });

  it('définit les fonctions utilisateurs avec des valeurs métier précises', () => {
    expect(FONCTIONS[0]).toEqual({ value: 'medecin', label: 'Médecin' });
    expect(FONCTIONS[1]).toEqual({ value: 'interne', label: 'Interne' });
    expect(FONCTIONS[4]).toEqual({ value: 'medecin_dim', label: 'Médecin DIM' });
    expect(FONCTIONS[5]).toEqual({ value: 'secretaire_medicale', label: 'Secrétaire médicale' });
    expect(FONCTIONS[7]).toEqual({ value: 'autre', label: 'Autre' });
  });

  it('définit les DPI, fonctionnalités et modules dans l’ordre attendu', () => {
    expect(DPIS).toEqual([
      { value: 'hopital_manager', label: 'Hôpital Manager' },
      { value: 'resurgence', label: 'Résurgence' },
      { value: 'mediboard', label: 'Mediboard' },
      { value: 'easily', label: 'Easily' },
      { value: 'crossway', label: 'Crossway' },
      { value: 'dxcare', label: 'DxCare' },
      { value: 'autre', label: 'Autre' },
    ]);

    expect(FONCTIONNALITES).toEqual([
      { value: 'dictee_vocale', label: 'Dictée vocale' },
      { value: 'ocr', label: 'OCR' },
      { value: 'aide_cotation', label: 'Aide à la cotation' },
      { value: 'generation_documents', label: 'Génération de documents' },
      { value: 'reformatage', label: 'Reformatage' },
    ]);

    expect(MODULES).toEqual([
      { value: 'urgence', label: 'Urgence' },
      { value: 'mco', label: 'MCO' },
      { value: 'smr', label: 'SMR' },
      { value: 'ioa', label: 'IOA' },
    ]);
  });

  it('définit les échelles de réponse génériques avec leurs libellés exacts', () => {
    expect(OUI_NON_4).toEqual([
      { value: 'oui_tout_a_fait', label: 'Oui, tout à fait' },
      { value: 'plutot_oui', label: 'Plutôt oui' },
      { value: 'plutot_non', label: 'Plutôt non' },
      { value: 'non_pas_du_tout', label: 'Non, pas du tout' },
    ]);

    expect(OUI_PARTIEL_NON).toEqual([
      { value: 'oui', label: 'Oui' },
      { value: 'partiellement', label: 'Partiellement' },
      { value: 'non', label: 'Non' },
    ]);

    expect(INTENTION_USAGE).toEqual([
      { value: 'oui_des_que_possible', label: 'Oui, dès que possible' },
      { value: 'oui_ponctuellement', label: 'Oui, ponctuellement' },
      { value: 'je_ne_sais_pas', label: 'Je ne sais pas encore' },
      { value: 'non', label: 'Non' },
    ]);

    expect(ACCES_FORMATION).toEqual([
      { value: 'oui', label: 'Oui' },
      { value: 'non', label: 'Non' },
      { value: 'je_ne_sais_pas', label: 'Je ne sais pas' },
    ]);
  });

  it('définit les échelles de fréquence, contribution, gain de temps et formation', () => {
    expect(FREQUENCE_USAGE[0]).toEqual({
      value: 'chaque_patient',
      label: 'Pour chaque patient pris en charge',
    });
    expect(FREQUENCE_USAGE[3]).toEqual({
      value: 'rarement',
      label: "Je l'utilise très rarement",
    });

    expect(BEAUCOUP_PAS_DU_TOUT).toEqual([
      { value: 'beaucoup', label: 'Beaucoup' },
      { value: 'un_peu', label: 'Un peu' },
      { value: 'tres_peu', label: 'Très peu' },
      { value: 'pas_du_tout', label: 'Pas du tout' },
    ]);

    expect(GAIN_TEMPS).toEqual([
      { value: '10_15min', label: 'Entre 10 et 15 minutes' },
      { value: '5_10min', label: 'Entre 5 et moins de 10 minutes' },
      { value: '2_5min', label: 'Entre 2 et moins de 5 minutes' },
      { value: 'moins_2min', label: 'Moins de 2 minutes' },
      { value: 'aucun', label: 'Aucun gain de temps constaté' },
    ]);

    expect(FORMATION_RECUE).toEqual([
      { value: 'oui_complete', label: 'Oui, formation complète' },
      { value: 'oui_partielle', label: 'Oui, formation partielle' },
      { value: 'non', label: 'Non' },
    ]);
  });

  it('définit les échelles dédiées au suivi CSM', () => {
    expect(CSM_CONTRIB).toEqual([
      { value: 'oui_beaucoup', label: 'Oui, beaucoup' },
      { value: 'oui_un_peu', label: 'Oui, un peu' },
      { value: 'tres_peu', label: 'Très peu' },
      { value: 'pas_du_tout', label: 'Pas du tout' },
    ]);

    expect(CSM_COMPREHENSION).toEqual([
      { value: 'oui_tout_a_fait', label: 'Oui, tout à fait' },
      { value: 'oui_globalement', label: 'Oui, globalement' },
      { value: 'partiellement', label: 'Partiellement' },
      { value: 'non', label: 'Non' },
    ]);

    expect(CSM_REACTIVITE).toEqual([
      { value: 'oui_systematiquement', label: 'Oui, systématiquement' },
      { value: 'oui_la_plupart', label: 'Oui, la plupart du temps' },
      { value: 'rarement', label: 'Rarement' },
      { value: 'jamais', label: 'Jamais' },
    ]);

    expect(CSM_UTILITE_COMITES).toEqual([
      { value: 'tres_utiles', label: 'Oui, très utiles' },
      { value: 'plutot_utiles', label: 'Oui, plutôt utiles' },
      { value: 'peu_utiles', label: 'Peu utiles' },
      { value: 'pas_utiles', label: 'Pas du tout utiles' },
    ]);

    expect(CSM_FREQUENCE).toEqual([
      { value: 'oui', label: 'Oui, adaptée' },
      { value: 'trop_frequente', label: 'Non, trop fréquente' },
      { value: 'pas_assez_frequente', label: 'Non, pas assez fréquente' },
    ]);
  });

  it('garantit une structure homogène et des values uniques dans chaque référentiel', () => {
    for (const [name, options] of REFERENTIELS) {
      const values = options.map((option) => option.value);

      expect(new Set(values).size, `${name} doit avoir des values uniques`).toBe(values.length);

      for (const option of options) {
        expect(Object.keys(option).sort(), `${name} option keys`).toEqual(['label', 'value']);
        expect(option.value, `${name} value`).toEqual(expect.any(String));
        expect(option.value.trim().length, `${name} value non vide`).toBeGreaterThan(0);
        expect(option.label, `${name} label`).toEqual(expect.any(String));
        expect(option.label.trim().length, `${name} label non vide`).toBeGreaterThan(0);
      }
    }
  });

  it('expose les libellés des enquêtes pour tous les types attendus', () => {
    const expectedTypes: EnqueteType[] = ['post_formation', 'ces', 'satisfaction', 'suivi_csm'];

    expect(Object.keys(ENQUETE_LABELS).sort()).toEqual([...expectedTypes].sort());
    expect(ENQUETE_LABELS).toEqual({
      post_formation: {
        title: 'Évaluation de la formation OpenPulse',
        subtitle: 'Votre retour nous aide à améliorer la qualité de nos formations.',
      },
      ces: {
        title: 'Évaluation de la prise en main de OpenPulse',
        subtitle: "Mesurez en moins de 2 minutes votre effort d'adoption.",
      },
      satisfaction: {
        title: 'Questionnaire de satisfaction – OpenPulse',
        subtitle: 'Aidez-nous à mieux vous accompagner et à faire évoluer le produit.',
      },
      suivi_csm: {
        title: 'Évaluation du suivi CSM',
        subtitle: "Votre avis sur l'accompagnement par votre Customer Success Manager.",
      },
    });
  });

  it('garantit une structure complète pour chaque libellé d’enquête', () => {
    for (const [type, label] of Object.entries(ENQUETE_LABELS)) {
      expect(['post_formation', 'ces', 'satisfaction', 'suivi_csm']).toContain(type);
      expect(Object.keys(label).sort()).toEqual(['subtitle', 'title']);
      expect(label.title.trim().length).toBeGreaterThan(0);
      expect(label.subtitle.trim().length).toBeGreaterThan(0);
    }
  });
});