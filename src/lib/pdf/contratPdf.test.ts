import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const { JS_PDF_INSTANCES, addImageMock, saveMock, html2canvasMock, toDataURLMock } = vi.hoisted(() => {
  const addImage = vi.fn();
  const save = vi.fn();
  const instances: Array<{ addImage: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> }> = [];
  const toDataURL = vi.fn(() => 'data:image/png;base64,mock');
  const html2canvas = vi.fn(async () => ({
    width: 1000,
    height: 2000,
    toDataURL,
  }));

  return {
    JS_PDF_INSTANCES: instances,
    addImageMock: addImage,
    saveMock: save,
    html2canvasMock: html2canvas,
    toDataURLMock: toDataURL,
  };
});

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => {
    const instance = {
      addImage: addImageMock,
      save: saveMock,
    };
    JS_PDF_INSTANCES.push(instance);
    return instance;
  }),
}));

vi.mock('html2canvas', () => ({
  default: html2canvasMock,
}));

vi.mock('@/types/contrats', () => ({
  CONTRAT_TYPE_LABELS: {
    maintenance: 'Maintenance',
    services: 'Prestations de services',
    abonnement: 'Abonnement',
  },
}));

import { exportContratPdf } from './contratPdf';

describe('exportContratPdf', () => {
  beforeEach(() => {
    addImageMock.mockClear();
    saveMock.mockClear();
    html2canvasMock.mockClear();
    toDataURLMock.mockClear();
    JS_PDF_INSTANCES.length = 0;
    document.body.innerHTML = '';
  });

  it('génère le PDF avec le contenu métier attendu et supprime le noeud temporaire après succès', async () => {
    const contrat = {
      id: 'ctr-1',
      titre: 'Contrat principal',
      numero: 'C-2024-01',
      client_nom: 'Client Exemple',
      client_adresse: '10 rue de Paris',
      client_siret: '123 456 789 00010',
      type: 'maintenance' as const,
      montant_annuel_ht: 1200,
      montant_mensuel_ht: 100,
      date_debut: '2024-01-15',
      date_fin: '2024-12-31',
      conditions_particulieres: '<script>alert(1)</script>\nLigne 2',
    };

    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    await exportContratPdf(contrat);

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    const nodeArg = html2canvasMock.mock.calls[0][0] as HTMLElement;
    const optionsArg = html2canvasMock.mock.calls[0][1];
    expect(optionsArg).toEqual({ scale: 2, useCORS: true, logging: false });

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(nodeArg);
    expect(document.body.children).toHaveLength(0);

    expect(nodeArg.textContent).toContain('Contrat principal');
    expect(nodeArg.textContent).toContain('Contrat n° C-2024-01');
    expect(nodeArg.textContent).toContain('Client');
    expect(nodeArg.textContent).toContain('Client Exemple');
    expect(nodeArg.textContent).toContain('10 rue de Paris');
    expect(nodeArg.textContent).toContain('SIRET: 123 456 789 00010');
    expect(nodeArg.textContent).toContain('Détails du contrat');
    expect(nodeArg.textContent).toContain('Type: Maintenance');
    expect(nodeArg.textContent).toContain('Montant annuel HT: 1 200,00 €');
    expect(nodeArg.textContent).toContain('Montant mensuel HT: 100,00 €');
    expect(nodeArg.textContent).toContain(
      `Date de début: ${format(new Date('2024-01-15'), 'dd MMMM yyyy', { locale: fr })}`,
    );
    expect(nodeArg.textContent).toContain(
      `Date de fin: ${format(new Date('2024-12-31'), 'dd MMMM yyyy', { locale: fr })}`,
    );
    expect(nodeArg.textContent).toContain('Conditions particulières');
    expect(nodeArg.textContent).toContain('<script>alert(1)</script>');
    expect(nodeArg.innerHTML).not.toContain('<script>alert(1)</script>');
    expect(nodeArg.textContent).toContain('Le Prestataire');
    expect(nodeArg.textContent).toContain('Le Client');
    expect(nodeArg.textContent?.match(/Signature/g)?.length).toBe(2);

    expect(toDataURLMock).toHaveBeenCalledWith('image/png');
    expect(JS_PDF_INSTANCES).toHaveLength(1);
    expect(addImageMock).toHaveBeenCalledTimes(1);
    expect(addImageMock).toHaveBeenCalledWith(
      'data:image/png;base64,mock',
      'PNG',
      0,
      0,
      210,
      420,
    );
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('contrat_C-2024-01.pdf');
  });

  it('utilise les valeurs de repli quand numero, dates et conditions sont absents', async () => {
    const contrat = {
      id: 'ctr-2',
      titre: 'Contrat secondaire',
      numero: null,
      client_nom: 'Autre Client',
      client_adresse: null,
      client_siret: null,
      type: 'services' as const,
      montant_annuel_ht: 2400.5,
      montant_mensuel_ht: 200.04,
      date_debut: null,
      date_fin: null,
      conditions_particulieres: null,
    };

    await exportContratPdf(contrat);

    const nodeArg = html2canvasMock.mock.calls[0][0] as HTMLElement;

    expect(nodeArg.textContent).toContain('Contrat n° Non numéroté');
    expect(nodeArg.textContent).toContain('Type: Prestations de services');
    expect(nodeArg.textContent).toContain('Montant annuel HT: 2 400,50 €');
    expect(nodeArg.textContent).toContain('Montant mensuel HT: 200,04 €');
    expect(nodeArg.textContent).not.toContain('Date de début:');
    expect(nodeArg.textContent).not.toContain('Date de fin:');
    expect(nodeArg.textContent).not.toContain('Conditions particulières');
    expect(nodeArg.textContent).not.toContain('SIRET:');
    expect(saveMock).toHaveBeenCalledWith('contrat_ctr-2.pdf');
  });

  it('supprime le noeud temporaire même si html2canvas échoue', async () => {
    const contrat = {
      id: 'ctr-3',
      titre: 'Contrat erreur',
      numero: 'ERR-1',
      client_nom: 'Client erreur',
      type: 'abonnement' as const,
      montant_annuel_ht: 300,
      montant_mensuel_ht: 25,
    };

    const error = new Error('capture impossible');
    html2canvasMock.mockRejectedValueOnce(error);
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    await expect(exportContratPdf(contrat)).rejects.toThrow('capture impossible');

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(document.body.children).toHaveLength(0);
    expect(addImageMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });
});