import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallCard, TeamMessage } from './JarvisUnifiedPanel.renderers';

vi.mock('framer-motion', () => {
  const ReactMock = require('react');
  return {
    motion: {
      div: ReactMock.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        ({ children, ...props }, ref) => (
          <div ref={ref} {...props}>
            {children}
          </div>
        ),
      ),
    },
  };
});

vi.mock('react-markdown', () => {
  const ReactMock = require('react');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="react-markdown">{children}</div>,
  };
});

vi.mock('lucide-react', () => {
  const ReactMock = require('react');
  const Icon = (props: ReactMock.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Loader2: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    Users: Icon,
    MessageSquare: Icon,
    ExternalLink: Icon,
  };
});

const { mockCn, mockButton, mockBadge, mockJarvisAgentAvatar, mockGetToolIcon } = vi.hoisted(() => {
  return {
    mockCn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(' ')),
    mockButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
      <button {...props}>{children}</button>
    ),
    mockBadge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: string }) => (
      <span data-testid="badge" {...props}>
        {children}
      </span>
    ),
    mockJarvisAgentAvatar: vi.fn(({ agentId }: { agentId: string; size: string; status: string }) => (
      <div data-testid="jarvis-avatar">{agentId}</div>
    )),
    mockGetToolIcon: vi.fn(() => (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="tool-icon" {...props} />),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: mockButton,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: mockBadge,
}));

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('./JarvisAgentAvatar', () => ({
  JarvisAgentAvatar: mockJarvisAgentAvatar,
}));

vi.mock('./JarvisUnifiedPanel.constants', () => ({
  getToolIcon: mockGetToolIcon,
}));

describe('ToolCallCard', () => {
  it('affiche le nom de l’outil et l’icône de statut en exécution', () => {
    const toolCall = {
      id: 'tc1',
      name: 'my_tool',
      status: 'executing',
    } as const;

    const onConfirm = vi.fn();
    const onReject = vi.fn();

    render(
      <ToolCallCard
        toolCall={toolCall as any}
        isConfirming={false}
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );

    expect(mockGetToolIcon).toHaveBeenCalledWith('my_tool');
    expect(screen.getByText('my tool')).toBeInTheDocument();
    expect(screen.getByTestId('tool-icon')).toBeInTheDocument();
  });

  it('affiche le bouton de confirmation quand requires_confirmation et déclenche onConfirm/onReject', () => {
    const toolCall = {
      id: 'tc2',
      name: 'confirm_tool',
      status: 'requires_confirmation',
    } as const;

    const onConfirm = vi.fn();
    const onReject = vi.fn();

    render(
      <ToolCallCard
        toolCall={toolCall as any}
        isConfirming={false}
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /Confirmer/i });
    const cancelButton = screen.getByRole('button', { name: /Annuler/i });

    fireEvent.click(confirmButton);
    fireEvent.click(cancelButton);

    expect(onConfirm).toHaveBeenCalledWith('tc2');
    expect(onReject).toHaveBeenCalledWith('tc2');
  });

  it('affiche loader pendant la confirmation et désactive les boutons', () => {
    const toolCall = {
      id: 'tc3',
      name: 'confirm_tool',
      status: 'requires_confirmation',
    } as const;

    const onConfirm = vi.fn();
    const onReject = vi.fn();

    render(
      <ToolCallCard
        toolCall={toolCall as any}
        isConfirming={true}
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );

    expect(screen.getByText('Envoi en cours...')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => {
      expect(b).toBeDisabled();
    });
  });

  it('affiche les icônes de succès ou d’échec selon le statut', () => {
    const completed = {
      id: 'tc4',
      name: 'done_tool',
      status: 'completed',
    } as const;

    const failed = {
      id: 'tc5',
      name: 'fail_tool',
      status: 'failed',
    } as const;

    const { rerender } = render(
      <ToolCallCard
        toolCall={completed as any}
        isConfirming={false}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('icon').length).toBeGreaterThan(0);

    rerender(
      <ToolCallCard
        toolCall={failed as any}
        isConfirming={false}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('icon').length).toBeGreaterThan(0);
  });
});

describe('TeamMessage', () => {
  it('rend un message utilisateur avec avatar de texte et timestamp', () => {
    const message = {
      id: 'm1',
      agentId: 'user',
      content: 'Bonjour **Jarvis**',
      timestamp: new Date('2024-01-01T10:15:00.000Z').toISOString(),
    } as const;

    const getAgentMeta = vi.fn();

    render(<TeamMessage message={message as any} getAgentMeta={getAgentMeta} />);

    expect(screen.getByText('Bonjour **Jarvis**')).toBeInTheDocument();
    expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(getAgentMeta).not.toHaveBeenCalled();
  });

  it('rend un message prime (JARVIS TEAM) avec badge de domaine absent et avatar spécial', () => {
    const message = {
      id: 'm2',
      agentId: 'prime',
      content: 'Message de la team',
      timestamp: new Date('2024-01-01T09:30:00.000Z').toISOString(),
    } as const;

    const getAgentMeta = vi.fn();

    render(<TeamMessage message={message as any} getAgentMeta={getAgentMeta} />);

    expect(screen.getByText('JARVIS TEAM')).toBeInTheDocument();
    expect(screen.queryByTestId('jarvis-avatar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
  });

  it('rend un message d’agent avec meta et badge de domaine', () => {
    const message = {
      id: 'm3',
      agentId: 'agent-42',
      content: 'Diagnostic terminé',
      timestamp: new Date('2024-01-01T08:00:00.000Z').toISOString(),
    } as const;

    const getAgentMeta = vi.fn(() => ({
      name: 'Agent Alpha',
      color: '#123456',
      domain: 'Ops',
    }));

    render(<TeamMessage message={message as any} getAgentMeta={getAgentMeta} />);

    expect(getAgentMeta).toHaveBeenCalledWith('agent-42');
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    expect(screen.getByText('Ops')).toBeInTheDocument();
    expect(screen.getByTestId('jarvis-avatar')).toHaveTextContent('agent-42');
  });

  it('gère les liens internes et externes dans le markdown', () => {
    const content = 'Voir [interne](/dashboard) et [externe](https://example.org)';
    const message = {
      id: 'm4',
      agentId: 'agent-link',
      content,
      timestamp: new Date().toISOString(),
    } as const;

    const getAgentMeta = vi.fn(() => ({
      name: 'Linker',
      color: '#654321',
      domain: 'Links',
    }));

    render(<TeamMessage message={message as any} getAgentMeta={getAgentMeta} />);

    const container = screen.getByTestId('react-markdown');
    expect(container).toHaveTextContent(content);
  });
});