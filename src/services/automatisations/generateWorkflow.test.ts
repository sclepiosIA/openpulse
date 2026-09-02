import { generateWorkflowFromPrompt } from './generateWorkflow';

const { MOCK_NODES, MOCK_EDGES, mockInvoke, mockFrom, BUILDER } = vi.hoisted(() => {
  const MOCK_NODES = [
    { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Start' }, type: 'input' },
    { id: 'n2', position: { x: 200, y: 100 }, data: { label: 'Task' }, type: 'default' },
  ];
  const MOCK_EDGES = [
    { id: 'e1', source: 'n1', target: 'n2' },
  ];
  const BUILDER = {
    select: vi.fn(() => BUILDER),
    eq: vi.fn(() => BUILDER),
    gte: vi.fn(() => BUILDER),
    lte: vi.fn(() => BUILDER),
    in: vi.fn(() => BUILDER),
    order: vi.fn(() => BUILDER),
    limit: vi.fn(() => BUILDER),
    insert: vi.fn(() => BUILDER),
    update: vi.fn(() => BUILDER),
    delete: vi.fn(() => BUILDER),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn((resolve) => Promise.resolve({ data: null, error: null }).then(resolve)),
    catch: vi.fn((reject) => Promise.resolve().catch(reject)),
  };
  const mockFrom = vi.fn(() => BUILDER);
  const mockInvoke = vi.fn();
  return { MOCK_NODES, MOCK_EDGES, mockInvoke, mockFrom, BUILDER };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

describe('generateWorkflowFromPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        graph: {
          nodes: MOCK_NODES,
          edges: MOCK_EDGES,
        },
      },
      error: null,
    });
  });

  it('appelle la fonction Edge avec le bon nom et construit le graphe en succès', async () => {
    const prompt = 'Créer un workflow simple';
    const result = await generateWorkflowFromPrompt(prompt);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('generate-workflow-from-prompt', { body: { prompt } });

    expect(result.nodes).toBe(MOCK_NODES);
    expect(result.edges).toBe(MOCK_EDGES);
    expect(result.nodes[0].id).toBe('n1');
    expect(result.edges[0].source).toBe('n1');
  });

  it('propage une erreur Supabase si invoke échoue', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Appel fonction échoué' },
    });

    await expect(generateWorkflowFromPrompt('x')).rejects.toMatchObject({ message: 'Appel fonction échoué' });
  });

  it('rejette si la réponse ne contient pas un graphe valide', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false },
      error: null,
    });

    await expect(generateWorkflowFromPrompt('y')).rejects.toThrowError('Réponse IA invalide');

    mockInvoke.mockResolvedValue({
      data: { success: true, graph: null },
      error: null,
    });

    await expect(generateWorkflowFromPrompt('z')).rejects.toThrowError('Réponse IA invalide');
  });
});