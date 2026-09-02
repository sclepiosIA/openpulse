import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProduitImport, parseProduitsCSV } from './useProduitImport';
import type { ParsedProduitRow } from './useProduitImport';

const { mockFrom, mockInsert, mockToast, mockSanitize } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  const mockToast = vi.fn();
  const mockSanitize = vi.fn(() => 'erreur nettoyée');
  return { mockFrom, mockInsert, mockToast, mockSanitize };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

describe('parseProduitsCSV', () => {
  it('retourne un tableau vide si moins de 2 lignes', () => {
    expect(parseProduitsCSV('')).toEqual([]);
    expect(parseProduitsCSV('code,nom,type')).toEqual([]);
  });

  it('parse une ligne valide avec toutes les colonnes', () => {
    const csv = [
      'code,nom,description,type,categorie,prix_unitaire_ht,taux_tva,unite,est_actif',
      'P001,Produit A,Desc A,produit,Cat1,100.50,20,pièce,true',
    ].join('\n');
    const rows = parseProduitsCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      code: 'P001',
      nom: 'Produit A',
      description: 'Desc A',
      type: 'produit',
      categorie: 'Cat1',
      prix_unitaire_ht: 100.5,
      taux_tva: 20,
      unite: 'pièce',
      est_actif: true,
      _errors: undefined,
    });
  });

  it('gère les guillemets, virgules internes et guillemets échappés', () => {
    const csv = [
      'code,nom,type,prix_unitaire_ht',
      '"P002","Nom, avec virgule et ""quote""",service,50',
    ].join('\n');
    const rows = parseProduitsCSV(csv);
    expect(rows[0].code).toBe('P002');
    expect(rows[0].nom).toBe('Nom, avec virgule et "quote"');
    expect(rows[0].prix_unitaire_ht).toBe(50);
    expect(rows[0]._errors).toBeUndefined();
  });

  it('accepte la virgule comme séparateur décimal', () => {
    const csv = [
      'code,nom,type,prix_unitaire_ht,taux_tva',
      '"P003","Produit B",licence,"19,99","5,5"',
    ].join('\n');
    const rows = parseProduitsCSV(csv);
    expect(rows[0].prix_unitaire_ht).toBe(19.99);
    expect(rows[0].taux_tva).toBe(5.5);
  });

  it('signale les erreurs : code manquant, nom manquant, type invalide, prix invalide', () => {
    const csv = [
      'code,nom,type,prix_unitaire_ht',
      ',,inconnu,-5',
    ].join('\n');
    const rows = parseProduitsCSV(csv);
    expect(rows[0]._errors).toEqual([
      'Ligne 2: code manquant',
      'Ligne 2: nom manquant',
      'Ligne 2: type invalide (inconnu)',
      'Ligne 2: prix invalide',
    ]);
    expect(rows[0].prix_unitaire_ht).toBe(-5);
  });

  it('applique les valeurs par défaut quand les colonnes sont absentes', () => {
    const csv = ['code,nom', 'P004,Produit D'].join('\n');
    const rows = parseProduitsCSV(csv);
    expect(rows[0].type).toBe('service');
    expect(rows[0].prix_unitaire_ht).toBe(0);
    expect(rows[0].taux_tva).toBe(20);
    expect(rows[0].unite).toBe('unité');
    expect(rows[0].description).toBeNull();
    expect(rows[0].categorie).toBeNull();
    expect(rows[0].est_actif).toBe(true);
  });

  it.each([
    ['false', false],
    ['FALSE', false],
    ['0', false],
    ['true', true],
    ['1', true],
  ])('interprète est_actif=%s comme %s', (val, expected) => {
    const csv = ['code,nom,est_actif', `P005,Produit E,${val}`].join('\n');
    const rows = parseProduitsCSV(csv);
    expect(rows[0].est_actif).toBe(expected);
  });
});

describe('useProduitImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));
  });

  const validRow: ParsedProduitRow = {
    code: 'P001',
    nom: 'Produit A',
    type: 'produit',
    prix_unitaire_ht: 100,
    taux_tva: 20,
    unite: 'unité',
    est_actif: true,
    description: null,
    categorie: null,
  };

  it('importe les lignes valides et affiche un toast de succès', async () => {
    mockInsert.mockResolvedValue({ error: null, count: 2 });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useProduitImport(), { wrapper });

    expect(result.current.isImporting).toBe(false);

    let res: { inserted: number } | undefined;
    await act(async () => {
      res = await result.current.importRows([
        validRow,
        { ...validRow, code: 'P002', nom: 'Produit B' },
        { ...validRow, code: '', nom: '', _errors: ['Ligne 4: code manquant'] },
      ]);
    });

    expect(res).toEqual({ inserted: 2 });
    expect(mockFrom).toHaveBeenCalledWith('catalogue_produits');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [insertedRows, options] = mockInsert.mock.calls[0];
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]).not.toHaveProperty('_errors');
    expect(insertedRows[0].code).toBe('P001');
    expect(insertedRows[1].code).toBe('P002');
    expect(options).toEqual({ count: 'exact' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['catalogue_produits'] });
    expect(mockToast).toHaveBeenCalledWith({ title: '2 produits importés' });
    await waitFor(() => expect(result.current.isImporting).toBe(false));
  });

  it("n'insère rien et affiche un toast destructif si aucune ligne valide", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProduitImport(), { wrapper });

    let res: { inserted: number } | undefined;
    await act(async () => {
      res = await result.current.importRows([
        { ...validRow, _errors: ['Ligne 2: nom manquant'] },
      ]);
    });

    expect(res).toEqual({ inserted: 0 });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Aucune ligne valide',
      variant: 'destructive',
    });
  });

  it("gère l'erreur supabase via sanitizeSupabaseError et retourne inserted:0", async () => {
    const supaError = { message: 'boom' };
    mockInsert.mockResolvedValue({ error: supaError, count: null });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProduitImport(), { wrapper });

    let res: { inserted: number } | undefined;
    await act(async () => {
      res = await result.current.importRows([validRow]);
    });

    expect(res).toEqual({ inserted: 0 });
    expect(mockSanitize).toHaveBeenCalledWith(supaError);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Erreur import',
      description: 'erreur nettoyée',
      variant: 'destructive',
    });
    expect(result.current.isImporting).toBe(false);
  });

  it('exportCSV génère un fichier CSV avec en-têtes et valeurs échappées', () => {
    let capturedParts: BlobPart[] | undefined;
    let capturedType: string | undefined;
    const OriginalBlob = globalThis.Blob;
    class CapturingBlob extends OriginalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        capturedParts = parts;
        capturedType = options?.type;
      }
    }
    vi.stubGlobal('Blob', CapturingBlob);

    const createObjectURLSpy = vi.fn(() => 'blob:fake-url');
    const revokeObjectURLSpy = vi.fn();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useProduitImport(), { wrapper });

    act(() => {
      result.current.exportCSV([
        {
          code: 'P001',
          nom: 'Nom, virgule',
          description: null,
          type: 'produit',
          prix_unitaire_ht: 10,
          taux_tva: 20,
          unite: 'unité',
          est_actif: true,
          categorie: 'Cat1',
        },
      ]);
    });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:fake-url');
    expect(capturedType).toBe('text/csv;charset=utf-8');

    const text = String(capturedParts?.[0] ?? '');
    const lines = text.split('\n');
    expect(lines[0]).toBe('code,nom,description,type,categorie,prix_unitaire_ht,taux_tva,unite,est_actif');
    expect(lines[1]).toBe('P001,"Nom, virgule",,produit,Cat1,10,20,unité,true');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});