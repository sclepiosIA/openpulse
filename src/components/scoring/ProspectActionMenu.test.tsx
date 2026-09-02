import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProspectActionMenu } from './ProspectActionMenu';

const { MOCKS } = vi.hoisted(() => {
  const navigateMock = vi.fn();
  const toastFn = vi.fn();
  const mutateAsyncMock = vi.fn();
  const useAcknowledgeProspectMock = vi.fn(() => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }));

  const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{props.children}</button>
  );

  const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const DropdownMenuContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...rest }) => (
    <div {...rest}>{children}</div>
  );
  const DropdownMenuItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...rest }) => (
    <div role="menuitem" tabIndex={0} {...rest}>
      {children}
    </div>
  );
  const DropdownMenuSeparator: React.FC = () => <hr />;
  const DropdownMenuTrigger: React.FC<{ asChild?: boolean; children: React.ReactElement }> = ({ children }) => children;

  const Dialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }> = ({ children }) => (
    <div>{children}</div>
  );
  const DialogContent: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2>{children}</h2>;
  const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>;
  const DialogTrigger: React.FC<{ asChild?: boolean; children: React.ReactElement }> = ({ children }) => children;

  const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => <input {...props} />;
  const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = (props) => <label {...props} />;
  const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => <textarea {...props} />;

  const IconStub: React.FC<React.SVGProps<SVGSVGElement>> = () => <svg />;

  return {
    MOCKS: {
      navigateMock,
      toastFn,
      mutateAsyncMock,
      useAcknowledgeProspectMock,
      ui: {
        Button,
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuSeparator,
        DropdownMenuTrigger,
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogFooter,
        DialogTrigger,
        Input,
        Label,
        Textarea,
      },
      icons: {
        MoreVertical: IconStub,
        Eye: IconStub,
        ListPlus: IconStub,
        BellOff: IconStub,
        ExternalLink: IconStub,
      },
    },
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => MOCKS.navigateMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: MOCKS.ui.Button,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: MOCKS.ui.DropdownMenu,
  DropdownMenuContent: MOCKS.ui.DropdownMenuContent,
  DropdownMenuItem: MOCKS.ui.DropdownMenuItem,
  DropdownMenuSeparator: MOCKS.ui.DropdownMenuSeparator,
  DropdownMenuTrigger: MOCKS.ui.DropdownMenuTrigger,
}));

vi.mock('lucide-react', () => ({
  MoreVertical: MOCKS.icons.MoreVertical,
  Eye: MOCKS.icons.Eye,
  ListPlus: MOCKS.icons.ListPlus,
  BellOff: MOCKS.icons.BellOff,
  ExternalLink: MOCKS.icons.ExternalLink,
}));

vi.mock('@/hooks/crm/useBehavioralScore', () => ({
  useAcknowledgeProspect: MOCKS.useAcknowledgeProspectMock,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: MOCKS.toastFn }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: MOCKS.ui.Dialog,
  DialogContent: MOCKS.ui.DialogContent,
  DialogHeader: MOCKS.ui.DialogHeader,
  DialogTitle: MOCKS.ui.DialogTitle,
  DialogFooter: MOCKS.ui.DialogFooter,
  DialogTrigger: MOCKS.ui.DialogTrigger,
}));

vi.mock('@/components/ui/input', () => ({
  Input: MOCKS.ui.Input,
}));

vi.mock('@/components/ui/label', () => ({
  Label: MOCKS.ui.Label,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: MOCKS.ui.Textarea,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ProspectActionMenu', () => {
  const etablissementId = 'etab-123';

  beforeEach(() => {
    MOCKS.navigateMock.mockReset();
    MOCKS.toastFn.mockReset();
    MOCKS.mutateAsyncMock.mockReset();
  });

  it('affiche les actions principales et déclenche onOpenSheet', () => {
    const onOpenSheet = vi.fn();
    renderWithClient(<ProspectActionMenu etablissementId={etablissementId} onOpenSheet={onOpenSheet} />);

    const moreButton = screen.getByRole('button', { name: "Plus d'options" });
    fireEvent.click(moreButton);

    const detailItem = screen.getByText('Détail scoring');
    fireEvent.click(detailItem);

    expect(onOpenSheet).toHaveBeenCalledTimes(1);
    expect(onOpenSheet).toHaveBeenCalledWith(etablissementId);
  });

  it('navigue vers la fiche complète et la création de tâche', () => {
    renderWithClient(<ProspectActionMenu etablissementId={etablissementId} />);

    const moreButton = screen.getByRole('button', { name: "Plus d'options" });
    fireEvent.click(moreButton);

    const ficheItem = screen.getByText('Fiche complète');
    fireEvent.click(ficheItem);
    expect(MOCKS.navigateMock).toHaveBeenCalledWith(`/etablissements/${etablissementId}`);

    const tacheItem = screen.getByText('Créer une tâche');
    fireEvent.click(tacheItem);
    expect(MOCKS.navigateMock).toHaveBeenCalledWith(`/taches/new?etablissement_id=${etablissementId}`);
  });

  it('ouvre le dialog de snooze et confirme avec les valeurs par défaut', async () => {
    renderWithClient(<ProspectActionMenu etablissementId={etablissementId} />);

    const moreButton = screen.getByRole('button', { name: "Plus d'options" });
    fireEvent.click(moreButton);

    const snoozeItem = screen.getByText('Mettre en pause (snooze)');
    fireEvent.click(snoozeItem);

    const confirmButton = screen.getByText('Confirmer');

    const dateInput = screen.getByLabelText("Jusqu'au") as HTMLInputElement;
    const noteInput = screen.getByLabelText('Note (optionnelle)') as HTMLTextAreaElement;

    const initialDate = dateInput.value;
    expect(initialDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(noteInput.value).toBe('');

    MOCKS.mutateAsyncMock.mockResolvedValueOnce(undefined);

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(MOCKS.mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(MOCKS.mutateAsyncMock).toHaveBeenCalledWith({
      id: etablissementId,
      until: initialDate,
      note: '',
    });

    expect(MOCKS.toastFn).toHaveBeenCalledWith({
      title: 'Prospect mis en pause',
      description: `Jusqu'au ${initialDate}`,
    });
  });

  it('permet de modifier la date et la note avant confirmation', async () => {
    renderWithClient(<ProspectActionMenu etablissementId={etablissementId} />);

    const moreButton = screen.getByRole('button', { name: "Plus d'options" });
    fireEvent.click(moreButton);

    const snoozeItem = screen.getByText('Mettre en pause (snooze)');
    fireEvent.click(snoozeItem);

    const dateInput = screen.getByLabelText("Jusqu'au") as HTMLInputElement;
    const noteInput = screen.getByLabelText('Note (optionnelle)') as HTMLTextAreaElement;

    const newDate = '2030-12-25';
    const newNote = 'Pause longue durée';

    fireEvent.change(dateInput, { target: { value: newDate } });
    fireEvent.change(noteInput, { target: { value: newNote } });

    expect(dateInput.value).toBe(newDate);
    expect(noteInput.value).toBe(newNote);

    MOCKS.mutateAsyncMock.mockResolvedValueOnce(undefined);

    const confirmButton = screen.getByText('Confirmer');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(MOCKS.mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(MOCKS.mutateAsyncMock).toHaveBeenCalledWith({
      id: etablissementId,
      until: newDate,
      note: newNote,
    });

    expect(MOCKS.toastFn).toHaveBeenCalledWith({
      title: 'Prospect mis en pause',
      description: `Jusqu'au ${newDate}`,
    });
  });

  it("affiche un toast d'erreur si la mutation échoue", async () => {
    renderWithClient(<ProspectActionMenu etablissementId={etablissementId} />);

    const moreButton = screen.getByRole('button', { name: "Plus d'options" });
    fireEvent.click(moreButton);

    const snoozeItem = screen.getByText('Mettre en pause (snooze)');
    fireEvent.click(snoozeItem);

    const error = new Error('Erreur réseau');
    MOCKS.mutateAsyncMock.mockRejectedValueOnce(error);

    const confirmButton = screen.getByText('Confirmer');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(MOCKS.mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(MOCKS.toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur réseau',
      variant: 'destructive',
    });
  });

  it('ferme le dialog en cliquant sur Annuler', () => {
    renderWithClient(<ProspectActionMenu etablissementId={etablissementId} />);

    const moreButton = screen.getByRole('button', { name: "Plus d'options" });
    fireEvent.click(moreButton);

    const snoozeItem = screen.getByText('Mettre en pause (snooze)');
    fireEvent.click(snoozeItem);

    const cancelButton = screen.getByText('Annuler');
    fireEvent.click(cancelButton);

    expect(screen.getByText('Confirmer')).toBeInTheDocument();
  });

  it("empêche la propagation du clic du bouton d'options", () => {
    const stopPropagation = vi.fn();
    renderWithClient(<ProspectActionMenu etablissementId={etablissementId} />);

    const moreButton = screen.getByRole('button', { name: "Plus d'options" });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'stopPropagation', {
      value: stopPropagation,
      writable: false,
    });

    moreButton.dispatchEvent(event);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});