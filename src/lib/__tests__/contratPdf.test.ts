import { describe, it, expect, vi } from 'vitest';

const saveMock = vi.fn();
const addImageMock = vi.fn();
const jsPDFCtor = vi.fn(() => ({ addImage: addImageMock, save: saveMock }));

vi.mock('jspdf', () => ({ default: jsPDFCtor }));
vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    height: 1000,
    width: 800,
    toDataURL: () => 'data:image/png;base64,xxx',
  })),
}));

describe('contratPdf', () => {
  it('exportContratPdf builds, renders and cleans up the DOM node', async () => {
    const { exportContratPdf } = await import('../pdf/contratPdf');
    const before = document.body.children.length;
    await exportContratPdf({
      id: 'c-1',
      titre: 'Mon Contrat',
      numero: 'C-001',
      client_nom: 'Acme',
      client_adresse: '1 rue de Paris',
      client_siret: '12345678901234',
      type: 'maintenance',
      montant_annuel_ht: 12000,
      montant_mensuel_ht: 1000,
      date_debut: '2026-01-01',
      date_fin: '2026-12-31',
      conditions_particulieres: 'Conditions spéciales',
    } as never);
    expect(document.body.children.length).toBe(before);
    expect(jsPDFCtor).toHaveBeenCalledWith('p', 'mm', 'a4');
    expect(addImageMock).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledWith('contrat_C-001.pdf');
  });

  it('falls back to id when numero is missing', async () => {
    saveMock.mockClear();
    const { exportContratPdf } = await import('../pdf/contratPdf');
    await exportContratPdf({
      id: 'fallback-id',
      titre: 'X',
      client_nom: 'Y',
      type: 'maintenance',
      montant_annuel_ht: 0,
      montant_mensuel_ht: 0,
    } as never);
    expect(saveMock).toHaveBeenCalledWith('contrat_fallback-id.pdf');
  });
});
