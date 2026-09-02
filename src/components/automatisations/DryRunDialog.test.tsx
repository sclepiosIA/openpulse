import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DryRunDialog } from './DryRunDialog';

const { textareaPropsRef } = vi.hoisted(() => ({
  textareaPropsRef: { current: null as null | React.TextareaHTMLAttributes<HTMLTextAreaElement> },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} data-variant={variant} data-size={size} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
    textareaPropsRef.current = props;
    return <textarea aria-label="Payload du déclencheur (JSON)" {...props} />;
  },
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

vi.mock('lucide-react', () => ({
  FlaskConical: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-flask" {...props} />,
  Wand2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-wand" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

describe('DryRunDialog', () => {
  beforeEach(() => {
    textareaPropsRef.current = null;
  });

  it('affiche le payload exemple correspondant au trigger ouvert', async () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="email.received"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    expect(screen.getByText('Tester le workflow')).toBeInTheDocument();
    expect(screen.getByText(/aucun email envoyé/i)).toBeInTheDocument();

    const textarea = screen.getByLabelText('Payload du déclencheur (JSON)') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      sender_email: 'contact@exemple.fr',
      subject: 'Demande de démo',
      body: 'Bonjour, nous souhaiterions une démonstration.',
    });

    expect(screen.queryByText(/JSON invalide/i)).not.toBeInTheDocument();
    expect(screen.getByText('Lancer le test')).toBeInTheDocument();
  });

  it('formate un JSON valide saisi par l’utilisateur', async () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="ticket.created"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    const textarea = screen.getByLabelText('Payload du déclencheur (JSON)') as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: '{"ticket_id":"1","priorite":"high","nested":{"a":1}}' },
    });

    fireEvent.click(screen.getByText('Formater'));

    await waitFor(() => {
      const formatted = (screen.getByLabelText('Payload du déclencheur (JSON)') as HTMLTextAreaElement).value;
      expect(formatted).toContain('\n  "ticket_id": "1"');
      expect(formatted).toContain('\n  "nested": {\n    "a": 1\n  }\n');
    });

    expect(screen.queryByText(/JSON invalide/i)).not.toBeInTheDocument();
  });

  it('affiche une erreur si le formatage reçoit un JSON invalide', async () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="facture.overdue"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    const textarea = screen.getByLabelText('Payload du déclencheur (JSON)') as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: '{"numero":' },
    });

    fireEvent.click(screen.getByText('Formater'));

    await waitFor(() => {
      expect(screen.getByText(/JSON invalide/i)).toBeInTheDocument();
    });

    expect(onLaunch).not.toHaveBeenCalled();
  });

  it('lance le test avec le payload parsé réel', async () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="devis.signed"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    const textarea = screen.getByLabelText('Payload du déclencheur (JSON)') as HTMLTextAreaElement;
    const customPayload = {
      devis_id: 'd-1',
      montant: 4500,
      etablissement_id: 'e-2',
      note: 'signature ok',
    };

    fireEvent.change(textarea, {
      target: { value: JSON.stringify(customPayload) },
    });

    fireEvent.click(screen.getByText('Lancer le test'));

    await waitFor(() => {
      expect(onLaunch).toHaveBeenCalledTimes(1);
      expect(onLaunch).toHaveBeenCalledWith(customPayload);
    });

    expect(screen.queryByText(/JSON invalide/i)).not.toBeInTheDocument();
  });

  it('n’exécute pas onLaunch et affiche une erreur si le JSON est invalide au lancement', async () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="contrat.signed"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Payload du déclencheur (JSON)'), {
      target: { value: '{"contrat_id":"x",' },
    });

    fireEvent.click(screen.getByText('Lancer le test'));

    await waitFor(() => {
      expect(screen.getByText(/JSON invalide/i)).toBeInTheDocument();
    });

    expect(onLaunch).not.toHaveBeenCalled();
  });

  it('réinitialise le payload quand le trigger change et que la dialog est ouverte', async () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    const { rerender } = render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="task.completed"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Payload du déclencheur (JSON)'), {
      target: { value: '{"custom":true}' },
    });

    rerender(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="etablissement.statut_changed"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    await waitFor(() => {
      const parsed = JSON.parse((screen.getByLabelText('Payload du déclencheur (JSON)') as HTMLTextAreaElement).value) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        etablissement_nom: 'Clinique Exemple',
        statut_old: 'Prospect',
        statut_new: 'Production',
      });
    });
  });

  it('désactive le bouton de lancement et affiche le loader pendant isPending', () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="manual"
        onLaunch={onLaunch}
        isPending={true}
      />
    );

    const launchButton = screen.getByRole('button', { name: /Lancer le test/i });
    expect(launchButton).toBeDisabled();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
  });

  it('ferme via Annuler en appelant onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType="manual"
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    fireEvent.click(screen.getByText('Annuler'));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('utilise le fallback example:value pour un trigger inconnu', async () => {
    const onOpenChange = vi.fn();
    const onLaunch = vi.fn();

    render(
      <DryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        triggerType={'unknown.trigger' as never}
        onLaunch={onLaunch}
        isPending={false}
      />
    );

    await waitFor(() => {
      const parsed = JSON.parse((screen.getByLabelText('Payload du déclencheur (JSON)') as HTMLTextAreaElement).value) as Record<string, unknown>;
      expect(parsed).toEqual({ example: 'value' });
    });
  });
});