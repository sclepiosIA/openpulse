import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PollCreatorModal } from './PollCreatorModal';

const {
  POLL,
  MESSAGE,
  createPollState,
  mockCreatePollMutate,
  mockSendMessageMutate,
  mockUpdatePollMessageMutate,
  mockOnOpenChange,
} = vi.hoisted(() => {
  const POLL = { id: 'poll1' };
  const MESSAGE = { id: 'msg1' };
  const createPollState = { isPending: false, shouldError: false };
  const mockCreatePollMutate = vi.fn((vars, opts) => {
    if (createPollState.shouldError) {
      const error = { message: 'x' };
      opts?.onError?.(error);
    } else {
      opts?.onSuccess?.(POLL);
    }
  });
  const mockSendMessageMutate = vi.fn((vars, opts) => {
    opts?.onSuccess?.(MESSAGE);
  });
  const mockUpdatePollMessageMutate = vi.fn();
  const mockOnOpenChange = vi.fn();
  return {
    POLL,
    MESSAGE,
    createPollState,
    mockCreatePollMutate,
    mockSendMessageMutate,
    mockUpdatePollMessageMutate,
    mockOnOpenChange,
  };
});

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <span data-icon className={className} />;
  return { BarChart3: Icon, Plus: Icon, Trash2: Icon, Loader2: Icon };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...rest }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: (props: any) => <label {...props} />,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ id, checked, onCheckedChange }: { id?: string; checked?: boolean; onCheckedChange?: (v: boolean) => void }) => (
    <input
      id={id}
      type="checkbox"
      role="switch"
      aria-checked={checked}
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.currentTarget.checked)}
    />
  ),
}));

vi.mock('@/hooks/pulse/usePulsePolls', () => ({
  useCreatePulsePoll: () => ({
    mutate: mockCreatePollMutate,
    get isPending() {
      return createPollState.isPending;
    },
    get isError() {
      return createPollState.shouldError;
    },
  }),
  useUpdatePollMessage: () => ({
    mutate: mockUpdatePollMessageMutate,
  }),
}));

vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  useSendPulseMessage: () => ({
    mutate: mockSendMessageMutate,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('PollCreatorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPollState.isPending = false;
    createPollState.shouldError = false;
  });

  it('renders and manages options add/remove and validation state', async () => {
    renderWithClient(
      <PollCreatorModal open={true} onOpenChange={mockOnOpenChange} conversationId="conv1" />
    );

    expect(screen.getByText('Créer un sondage')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Créer le sondage/i });
    expect(submitBtn).toBeDisabled();

    let optionInputs = screen.getAllByPlaceholderText(/Option \d+/i);
    expect(optionInputs).toHaveLength(2);

    const addBtn = screen.getByRole('button', { name: /Ajouter une option/i });
    await act(async () => {
      await userEvent.click(addBtn);
    });

    optionInputs = screen.getAllByPlaceholderText(/Option \d+/i);
    expect(optionInputs).toHaveLength(3);

    let removeButtons = screen.getAllByRole('button', { name: 'Supprimer' });
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      await userEvent.click(removeButtons[0]);
    });

    optionInputs = screen.getAllByPlaceholderText(/Option \d+/i);
    expect(optionInputs).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
  });

  it('submits successfully: creates poll, sends message, links poll to message, resets and closes', async () => {
    createPollState.shouldError = false;

    renderWithClient(
      <PollCreatorModal open={true} onOpenChange={mockOnOpenChange} conversationId="conv1" />
    );

    const questionInput = screen.getByLabelText('Question');
    await act(async () => {
      await userEvent.type(questionInput, 'Qui vient ?');
    });

    const optionInputs = screen.getAllByPlaceholderText(/Option \d+/i);
    await act(async () => {
      await userEvent.type(optionInputs[0], 'Alice');
      await userEvent.type(optionInputs[1], 'Bob');
    });

    const multipleSwitch = screen.getByLabelText('Choix multiples autorisés');
    const anonymousSwitch = screen.getByLabelText('Vote anonyme');
    await act(async () => {
      await userEvent.click(multipleSwitch);
      await userEvent.click(anonymousSwitch);
    });

    const submitBtn = screen.getByRole('button', { name: /Créer le sondage/i });
    expect(submitBtn).toBeEnabled();

    await act(async () => {
      await userEvent.click(submitBtn);
    });

    expect(mockCreatePollMutate).toHaveBeenCalledTimes(1);
    const [vars] = mockCreatePollMutate.mock.calls[0];
    expect(vars).toEqual({
      conversationId: 'conv1',
      question: 'Qui vient ?',
      options: ['Alice', 'Bob'],
      isMultipleChoice: true,
      isAnonymous: true,
    });

    expect(mockSendMessageMutate).toHaveBeenCalledTimes(1);
    const [sendVars] = mockSendMessageMutate.mock.calls[0];
    expect(sendVars).toEqual({
      conversation_id: 'conv1',
      content: '#[Qui vient ?](poll:poll1)',
      mentions: [],
    });

    expect(mockUpdatePollMessageMutate).toHaveBeenCalledTimes(1);
    expect(mockUpdatePollMessageMutate).toHaveBeenCalledWith({
      pollId: POLL.id,
      messageId: MESSAGE.id,
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);

    const resetQuestionInput = screen.getByLabelText('Question') as HTMLInputElement;
    expect(resetQuestionInput.value).toBe('');

    const resetOptions = screen.getAllByPlaceholderText(/Option \d+/i) as HTMLInputElement[];
    expect(resetOptions).toHaveLength(2);
    expect((resetOptions[0] as HTMLInputElement).value).toBe('');
    expect((resetOptions[1] as HTMLInputElement).value).toBe('');
  });

  it('handles create poll error without sending message or closing', async () => {
    createPollState.shouldError = true;

    renderWithClient(
      <PollCreatorModal open={true} onOpenChange={mockOnOpenChange} conversationId="conv1" />
    );

    const questionInput = screen.getByLabelText('Question');
    await act(async () => {
      await userEvent.type(questionInput, 'Quelle date ?');
    });

    const optionInputs = screen.getAllByPlaceholderText(/Option \d+/i);
    await act(async () => {
      await userEvent.type(optionInputs[0], 'Lundi');
      await userEvent.type(optionInputs[1], 'Mardi');
    });

    const submitBtn = screen.getByRole('button', { name: /Créer le sondage/i });
    await act(async () => {
      await userEvent.click(submitBtn);
    });

    expect(mockCreatePollMutate).toHaveBeenCalledTimes(1);
    expect(mockSendMessageMutate).not.toHaveBeenCalled();
    expect(mockUpdatePollMessageMutate).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it('disables submit and shows loader during pending state', async () => {
    createPollState.isPending = true;

    renderWithClient(
      <PollCreatorModal open={true} onOpenChange={mockOnOpenChange} conversationId="conv1" />
    );

    const questionInput = screen.getByLabelText('Question');
    await act(async () => {
      await userEvent.type(questionInput, 'Question test');
    });

    const optionInputs = screen.getAllByPlaceholderText(/Option \d+/i);
    await act(async () => {
      await userEvent.type(optionInputs[0], 'Opt1');
      await userEvent.type(optionInputs[1], 'Opt2');
    });

    const submitBtn = screen.getByRole('button', { name: /Créer le sondage/i });
    expect(submitBtn).toBeDisabled();

    const loader = submitBtn.querySelector('.animate-spin');
    expect(loader).toBeTruthy();
  });
});