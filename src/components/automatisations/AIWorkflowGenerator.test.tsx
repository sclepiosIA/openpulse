/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AIWorkflowGenerator } from './AIWorkflowGenerator';

const {
  TOAST_FN,
  GENERATE_FN,
  SANITIZE_FN,
  GENERATED_NODES,
  GENERATED_EDGES,
  CONFIRM_FN,
} = vi.hoisted(() => ({
  TOAST_FN: vi.fn(),
  GENERATE_FN: vi.fn(),
  SANITIZE_FN: vi.fn(),
  GENERATED_NODES: [
    { id: 'n1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Trigger' } },
    { id: 'n2', type: 'action', position: { x: 100, y: 100 }, data: { label: 'Email' } },
  ],
  GENERATED_EDGES: [{ id: 'e1-2', source: 'n1', target: 'n2' }],
  CONFIRM_FN: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props),
  Loader2: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) =>
    React.createElement('button', { onClick, disabled, type: type ?? 'button', ...props }, children),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    React.createElement('textarea', props),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: React.LabelHTMLAttributes<HTMLLabelElement>) =>
    React.createElement('label', { htmlFor, className }, children),
}));

vi.mock('@/components/ui/dialog', async () => {
  const ReactModule = await import('react');

  const DialogContext = ReactModule.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null>(null);

  function Dialog({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) {
    return ReactModule.createElement(
      DialogContext.Provider,
      { value: { open, onOpenChange } },
      children
    );
  }

  function DialogTrigger({
    children,
    asChild,
  }: {
    children: React.ReactElement;
    asChild?: boolean;
  }) {
    const ctx = ReactModule.useContext(DialogContext);
    if (!ctx) return children;

    if (asChild && ReactModule.isValidElement(children)) {
      const childProps = children.props as {
        onClick?: (event: React.MouseEvent<HTMLElement>) => void;
      };

      return ReactModule.cloneElement(children, {
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          childProps.onClick?.(event);
          ctx.onOpenChange(true);
        },
      });
    }

    return ReactModule.createElement(
      'button',
      { type: 'button', onClick: () => ctx.onOpenChange(true) },
      children
    );
  }

  function DialogContent({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    const ctx = ReactModule.useContext(DialogContext);
    if (!ctx?.open) return null;
    return ReactModule.createElement('div', { role: 'dialog', className }, children);
  }

  const passthrough =
    (tag: keyof React.JSX.IntrinsicElements) =>
    ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) =>
      ReactModule.createElement(tag, { className }, children);

  return {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader: passthrough('div'),
    DialogTitle: passthrough('h2'),
    DialogDescription: passthrough('p'),
    DialogFooter: passthrough('div'),
  };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}));

vi.mock('@/services/automatisations/generateWorkflow', () => ({
  generateWorkflowFromPrompt: GENERATE_FN,
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: SANITIZE_FN,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('AIWorkflowGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', CONFIRM_FN);
    CONFIRM_FN.mockReturnValue(true);
  });

  it('ouvre le dialogue, permet de choisir un exemple et affiche le compteur de caractères', async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();

    render(React.createElement(AIWorkflowGenerator, { onGenerated, hasExistingNodes: false }), {
      wrapper: createWrapper(),
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /générer avec ia/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const exampleText =
      'Quand une facture est en retard, envoie un email de relance professionnel généré par IA et crée une tâche de suivi';

    await user.click(within(dialog).getByRole('button', { name: exampleText }));

    const textarea = within(dialog).getByLabelText(/description du workflow/i);
    expect(textarea).toHaveValue(exampleText);
    expect(within(dialog).getByText(`${exampleText.length} / 4000 caractères`)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^générer$/i })).toBeEnabled();
  });

  it('laisse le bouton désactivé si la description est trop courte et ne lance aucune génération', async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();

    render(React.createElement(AIWorkflowGenerator, { onGenerated, hasExistingNodes: false }), {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /générer avec ia/i }));

    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByLabelText(/description du workflow/i);

    await user.type(textarea, '123456789');

    expect(within(dialog).getByRole('button', { name: /^générer$/i })).toBeDisabled();
    expect(GENERATE_FN).not.toHaveBeenCalled();
    expect(TOAST_FN).not.toHaveBeenCalled();
  });

  it('génère un workflow avec succès, appelle onGenerated avec les données métier et réinitialise la saisie', async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    const prompt =
      "Quand le statut d'un établissement passe à Production, crée une tâche d'onboarding et notifie le CSM";

    let resolveGeneration: ((value: { nodes: typeof GENERATED_NODES; edges: typeof GENERATED_EDGES }) => void) | undefined;
    GENERATE_FN.mockImplementation(
      () =>
        new Promise<{ nodes: typeof GENERATED_NODES; edges: typeof GENERATED_EDGES }>((resolve) => {
          resolveGeneration = resolve;
        })
    );

    render(React.createElement(AIWorkflowGenerator, { onGenerated, hasExistingNodes: false }), {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /générer avec ia/i }));

    const dialog = screen.getByRole('dialog');
    const textarea = within(dialog).getByLabelText(/description du workflow/i);
    await user.type(textarea, prompt);

    const generateButton = within(dialog).getByRole('button', { name: /^générer$/i });
    await user.click(generateButton);

    await waitFor(() => {
      expect(GENERATE_FN).toHaveBeenCalledWith(prompt);
    });

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /génération/i })).toBeDisabled();
    expect(within(screen.getByRole('dialog')).getByLabelText(/description du workflow/i)).toBeDisabled();

    resolveGeneration?.({ nodes: GENERATED_NODES, edges: GENERATED_EDGES });

    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledWith(GENERATED_NODES, GENERATED_EDGES);
    });

    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: '✨ Workflow généré',
      description: '2 bloc(s) créé(s) — pense à enregistrer.',
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('demande confirmation si un graphe existe déjà et annule la génération si refusé', async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    const prompt =
      'Tous les jours à 9h, lance une relance pour les prospects chauds inactifs depuis 7 jours, avec un email rédigé par IA';

    CONFIRM_FN.mockReturnValue(false);

    render(React.createElement(AIWorkflowGenerator, { onGenerated, hasExistingNodes: true }), {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /générer avec ia/i }));

    const dialog = screen.getByRole('dialog');

    expect(
      within(dialog).getByText(/le graphe actuel sera remplacé par celui généré/i)
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/description du workflow/i), prompt);
    await user.click(within(dialog).getByRole('button', { name: /^générer$/i }));

    expect(CONFIRM_FN).toHaveBeenCalledWith('Le graphe actuel sera remplacé. Continuer ?');
    expect(GENERATE_FN).not.toHaveBeenCalled();
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("affiche un toast d'erreur sanitizé si la génération échoue", async () => {
    const user = userEvent.setup();
    const onGenerated = vi.fn();
    const prompt =
      'Quand un email contient le mot "résiliation", crée un ticket support urgent et envoie un email empathique au client';
    const error = { message: 'x' };

    GENERATE_FN.mockRejectedValue(error);
    SANITIZE_FN.mockReturnValue('Erreur lisible');

    render(React.createElement(AIWorkflowGenerator, { onGenerated, hasExistingNodes: false }), {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /générer avec ia/i }));

    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/description du workflow/i), prompt);
    await user.click(within(dialog).getByRole('button', { name: /^générer$/i }));

    await waitFor(() => {
      expect(SANITIZE_FN).toHaveBeenCalledWith(error);
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Échec de la génération',
      description: 'Erreur lisible',
      variant: 'destructive',
    });

    expect(onGenerated).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByLabelText(/description du workflow/i)).toHaveValue(prompt);
  });
});