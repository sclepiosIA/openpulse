import { render, screen, fireEvent, act } from '@testing-library/react';
import { CreatePostDialog } from './CreatePostDialog';

const H = vi.hoisted(() => {
  const RESULT = { data: [], error: null };
  const builder: Record<string, unknown> = {};
  ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'update', 'delete', 'upsert'].forEach((m) => {
    builder[m] = vi.fn(() => builder);
  });
  builder.single = vi.fn(() => Promise.resolve(RESULT));
  builder.maybeSingle = vi.fn(() => Promise.resolve(RESULT));
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(RESULT).then(resolve, reject);
  builder.catch = (reject: (e: unknown) => unknown) => Promise.resolve(RESULT).catch(reject);
  const mockFrom = vi.fn(() => builder);

  const mutateAsync = vi.fn().mockResolvedValue({ id: 'p1' });
  const createPostState = { mutateAsync, isPending: false };

  const teamState: { isTeamMember: boolean; profile: { prenom: string; nom: string; fonction: string } | null } = {
    isTeamMember: false,
    profile: null,
  };

  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const debugError = vi.fn();

  return { RESULT, mockFrom, mutateAsync, createPostState, teamState, toastSuccess, toastError, debugError };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: H.mockFrom },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: H.debugError, log: vi.fn(), warn: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: H.toastSuccess, error: H.toastError },
}));

vi.mock('@/hooks/forum/useForumPosts', () => ({
  useCreateForumPost: () => H.createPostState,
}));

vi.mock('@/hooks/hr/useTeamMember', () => ({
  useIsTeamMember: () => ({ data: H.teamState.isTeamMember }),
  useTeamMemberProfile: () => ({ data: H.teamState.profile }),
}));

vi.mock('@/components/email/RichTextEditor', async () => {
  const React = await import('react');
  return {
    RichTextEditor: ({ content, onChange }: { content: string; onChange: (v: string) => void }) =>
      React.createElement('textarea', {
        'data-testid': 'rich-text-editor',
        value: content,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
      }),
  };
});

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('h2', null, children),
    DialogTrigger: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');
  return {
    Button: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
      const { variant: _v, ...rest } = props;
      return React.createElement('button', rest, children);
    },
  };
});

vi.mock('@/components/ui/input', async () => {
  const React = await import('react');
  return {
    Input: (props: Record<string, unknown>) => React.createElement('input', props),
  };
});

vi.mock('@/components/ui/label', async () => {
  const React = await import('react');
  return {
    Label: ({ children, htmlFor }: { children?: React.ReactNode; htmlFor?: string }) =>
      React.createElement('label', { htmlFor }, children),
  };
});

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Select: passthrough,
    SelectContent: passthrough,
    SelectTrigger: passthrough,
    SelectItem: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
      React.createElement('span', null, placeholder),
  };
});

vi.mock('@/components/ui/radio-group', async () => {
  const React = await import('react');
  return {
    RadioGroup: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { role: 'radiogroup' }, children),
    RadioGroupItem: ({ id }: { id?: string }) =>
      React.createElement('input', { type: 'radio', id }),
  };
});

vi.mock('lucide-react', () => ({
  Plus: () => null,
  Loader2: () => null,
}));

describe('CreatePostDialog', () => {
  beforeEach(() => {
    H.toastSuccess.mockClear();
    H.toastError.mockClear();
    H.mutateAsync.mockClear();
    H.mockFrom.mockClear();
    H.createPostState.isPending = false;
    H.teamState.isTeamMember = false;
    H.teamState.profile = null;
  });

  it('affiche le bouton déclencheur, le titre du dialog et le formulaire', () => {
    render(<CreatePostDialog />);

    expect(screen.getByText('Nouveau sujet')).toBeTruthy();
    expect(screen.getByText('Créer un nouveau sujet')).toBeTruthy();
    expect(screen.getByText('Publier')).toBeTruthy();
    expect(screen.getByText('Vos informations')).toBeTruthy();
    expect(screen.getByText('Titre du sujet *')).toBeTruthy();
    expect(screen.getByText('Annuler')).toBeTruthy();
  });

  it('refuse la soumission si titre/thème/contenu manquants et ne déclenche pas la mutation', async () => {
    const { container } = render(<CreatePostDialog />);

    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
    });

    expect(H.toastError).toHaveBeenCalledWith('Titre, thème et contenu sont obligatoires');
    expect(H.mutateAsync).not.toHaveBeenCalled();
    expect(H.toastSuccess).not.toHaveBeenCalled();
  });

  it("affiche l'état de publication en cours quand la mutation est pending", () => {
    H.createPostState.isPending = true;
    render(<CreatePostDialog />);

    expect(screen.getByText('Publication...')).toBeTruthy();
    expect(screen.queryByText('Publier')).toBeNull();
    const submitButton = screen.getByText('Publication...').closest('button');
    expect(submitButton).not.toBeNull();
    expect(submitButton?.disabled).toBe(true);
  });

  it("affiche un champ établissement OpenPulse désactivé pour un membre de l'équipe", () => {
    H.teamState.isTeamMember = true;
    H.teamState.profile = { prenom: 'Alice', nom: 'Martin', fonction: 'Support' };
    render(<CreatePostDialog />);

    const etabInput = screen.getByDisplayValue('OpenPulse') as HTMLInputElement;
    expect(etabInput.disabled).toBe(true);
    expect(etabInput.id).toBe('etablissement');
  });

  it("affiche l'astérisque obligatoire sur l'établissement pour un non-membre", () => {
    H.teamState.isTeamMember = false;
    render(<CreatePostDialog />);

    expect(screen.getByText(/Établissement/)).toBeTruthy();
    expect(screen.queryByDisplayValue('OpenPulse')).toBeNull();
  });
});