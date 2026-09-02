import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNativeDocumentLoad } from '../useNativeDocumentLoad';

/**
 * Ces attentes ont changé avec le hook : il téléchargeait le contenu depuis
 * Nextcloud, service absent de toute composition de la distribution. Les
 * anciens tests validaient donc un appel à une fonction qui n'existe pas — ils
 * étaient verts sur du code qui ne pouvait pas fonctionner à l'installation.
 *
 * Le contenu est lu dans `documents.content`, par identifiant de document : une
 * page n'a pas de chemin de stockage, la contrainte le lui interdit.
 */

const mockInvoke = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [])),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...(args as [])) },
  },
}));

describe('useNativeDocumentLoad', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('expose loadContent et isLoading', () => {
    const { result } = renderHook(() => useNativeDocumentLoad());
    expect(typeof result.current.loadContent).toBe('function');
    expect(result.current.isLoading).toBe(false);
  });

  it('lit le contenu en base par identifiant, sans passer par un service externe', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { content: '<p>Bonjour</p>' }, error: null });

    const { result } = renderHook(() => useNativeDocumentLoad());
    let contenu: string | null = null;
    await act(async () => {
      contenu = await result.current.loadContent('doc-42');
    });

    expect(contenu).toBe('<p>Bonjour</p>');
    expect(mockFrom).toHaveBeenCalledWith('documents');
    expect(mockSelect).toHaveBeenCalledWith('content');
    expect(mockEq).toHaveBeenCalledWith('id', 'doc-42');
    // Garde-fou : aucune fonction edge n'est plus sollicitée pour lire un
    // document. C'est ce détour qui rendait la fonction inopérante.
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rend null pour un FICHIER, dont le contenu est dans le stockage et non en base', async () => {
    // Une ligne dont `content` est nul est un fichier téléversé, pas une page.
    // Rendre la chaîne vide ferait ouvrir l'éditeur sur un document vierge et
    // écraserait le fichier au premier enregistrement.
    mockMaybeSingle.mockResolvedValue({ data: { content: null }, error: null });

    const { result } = renderHook(() => useNativeDocumentLoad());
    let contenu: string | null = 'valeur-initiale';
    await act(async () => {
      contenu = await result.current.loadContent('doc-fichier');
    });

    expect(contenu).toBeNull();
  });

  it('rend null quand le document est introuvable', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useNativeDocumentLoad());
    let contenu: string | null = 'valeur-initiale';
    await act(async () => {
      contenu = await result.current.loadContent('inconnu');
    });

    expect(contenu).toBeNull();
  });

  it('rend null quand la base refuse la lecture', async () => {
    // Cas réel : la sécurité au niveau ligne refuse l'accès au document.
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('permission denied') });

    const { result } = renderHook(() => useNativeDocumentLoad());
    let contenu: string | null = 'valeur-initiale';
    await act(async () => {
      contenu = await result.current.loadContent('interdit');
    });

    expect(contenu).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
