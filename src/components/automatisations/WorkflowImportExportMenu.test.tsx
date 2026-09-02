import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { WorkflowImportExportMenu } from './WorkflowImportExportMenu';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowTriggerType } from '@/types/workflow';

const { mockMutateAsync, mockNavigate, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/workflows/useWorkflows', () => ({
  useCreateWorkflow: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => null,
}));

const baseProps = {
  workflowId: 'wf-1',
  nom: 'Mon Flux',
  description: 'Une description',
  triggerType: 'manual' as WorkflowTriggerType,
  triggerConfig: { foo: 'bar' },
  nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as Node[],
  edges: [{ id: 'e1', source: 'n1', target: 'n1' }] as Edge[],
};

describe('WorkflowImportExportMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), {
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('affiche les trois entrées du menu', () => {
    render(<WorkflowImportExportMenu {...baseProps} />);
    expect(screen.getByText(/Exporter \(JSON\)/)).toBeTruthy();
    expect(screen.getByText(/Importer \(nouveau\)/)).toBeTruthy();
    expect(screen.getByText(/Dupliquer/)).toBeTruthy();
  });

  it('exporte le workflow en JSON et affiche un toast de succès', () => {
    render(<WorkflowImportExportMenu {...baseProps} />);
    fireEvent.click(screen.getByText(/Exporter \(JSON\)/));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(mockToastSuccess).toHaveBeenCalledWith('Workflow exporté');
  });

  it('duplique le workflow avec le suffixe (copie) et navigue vers la page d\'édition', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'new-42' });
    render(<WorkflowImportExportMenu {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Dupliquer/));
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({
      nom: 'Mon Flux (copie)',
      trigger_type: 'manual',
      description: 'Une description',
      graph: { nodes: baseProps.nodes, edges: baseProps.edges },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Workflow dupliqué');
    expect(mockNavigate).toHaveBeenCalledWith('/automatisations/new-42/edit');
  });

  it('affiche un toast d\'erreur si la duplication échoue', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('boom'));
    render(<WorkflowImportExportMenu {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText(/Dupliquer/));
    });
    expect(mockToastError).toHaveBeenCalledWith('Duplication échouée : boom');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('importe un fichier JSON valide, crée le workflow avec le suffixe (importé) et navigue', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'imp-7' });
    const payload = {
      format: 'marque.workflow.v1',
      nom: 'Flux Importé',
      description: 'desc importée',
      trigger_type: 'manual',
      graph: { nodes: [{ id: 'x' }], edges: [] },
    };
    const file = new File([JSON.stringify(payload)], 'workflow.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(JSON.stringify(payload)),
    });

    const { container } = render(<WorkflowImportExportMenu {...baseProps} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) return;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        nom: 'Flux Importé (importé)',
        trigger_type: 'manual',
        description: 'desc importée',
        graph: { nodes: [{ id: 'x' }], edges: [] },
      });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Workflow "Flux Importé" importé');
    expect(mockNavigate).toHaveBeenCalledWith('/automatisations/imp-7/edit');
  });

  it('affiche un toast d\'erreur si le fichier importé est invalide (champs requis manquants)', async () => {
    const payload = { format: 'marque.workflow.v1', nom: 'Sans graph' };
    const file = new File([JSON.stringify(payload)], 'bad.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(JSON.stringify(payload)),
    });

    const { container } = render(<WorkflowImportExportMenu {...baseProps} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) return;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Import échoué : Format invalide (champs requis : nom, trigger_type, graph)'
      );
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('affiche un toast d\'erreur si le JSON est illisible', async () => {
    const file = new File(['{pas du json'], 'broken.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve('{pas du json'),
    });

    const { container } = render(<WorkflowImportExportMenu {...baseProps} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (!input) return;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Import échoué'));
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});