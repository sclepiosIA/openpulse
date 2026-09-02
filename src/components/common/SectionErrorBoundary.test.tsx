/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionErrorBoundary } from './SectionErrorBoundary';

const { debugErrorMock, buttonPropsSpy } = vi.hoisted(() => ({
  debugErrorMock: vi.fn(),
  buttonPropsSpy: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-icon" {...props} />,
  RotateCcw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="retry-icon" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string }) => {
    buttonPropsSpy(props);
    return (
      <button type="button" onClick={onClick} {...props}>
        {children}
      </button>
    );
  },
}));

class ThrowOnRender extends React.Component<{ message: string }> {
  render() {
    throw new Error(this.props.message);
  }
}

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend ses enfants quand aucune erreur ne survient', () => {
    render(
      <SectionErrorBoundary label="Bloc critique">
        <div>Contenu stable</div>
      </SectionErrorBoundary>,
    );

    expect(screen.getByText('Contenu stable')).toBeInTheDocument();
    expect(screen.queryByText('Bloc critique')).not.toBeInTheDocument();
    expect(debugErrorMock).not.toHaveBeenCalled();
  });

  it('affiche le fallback par défaut avec le label et le message d’erreur, puis loggue via debug.error', () => {
    render(
      <SectionErrorBoundary label="Widget météo">
        <ThrowOnRender message="Donnée invalide" />
      </SectionErrorBoundary>,
    );

    expect(screen.getByText('Widget météo')).toBeInTheDocument();
    expect(screen.getByText('Donnée invalide')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    expect(screen.getByTestId('retry-icon')).toBeInTheDocument();

    expect(debugErrorMock).toHaveBeenCalledTimes(1);
    const firstCall = debugErrorMock.mock.calls[0];
    expect(firstCall[0]).toBe('[SectionErrorBoundary]');
    expect(firstCall[1]).toBe('Widget météo');
    expect(firstCall[2]).toBeInstanceOf(Error);
    expect((firstCall[2] as Error).message).toBe('Donnée invalide');
    expect(typeof firstCall[3]).toBe('string');
  });

  it('utilise le libellé par défaut quand aucun label n’est fourni', () => {
    render(
      <SectionErrorBoundary>
        <ThrowOnRender message="Crash section" />
      </SectionErrorBoundary>,
    );

    expect(screen.getByText('Une erreur est survenue dans cette section.')).toBeInTheDocument();
    expect(screen.getByText('Crash section')).toBeInTheDocument();
  });

  it('transmet un fallback custom avec erreur et reset, puis réessaie correctement', () => {
    let shouldThrow = true;
    const fallbackSpy = vi.fn((error: Error, reset: () => void) => (
      <div>
        <span>Fallback custom: {error.message}</span>
        <button
          type="button"
          onClick={() => {
            shouldThrow = false;
            reset();
          }}
        >
          Reset custom
        </button>
      </div>
    ));

    const MaybeThrow = () => {
      if (shouldThrow) {
        throw new Error('Boom custom');
      }
      return <div>Section restaurée</div>;
    };

    render(
      <SectionErrorBoundary fallback={fallbackSpy}>
        <MaybeThrow />
      </SectionErrorBoundary>,
    );

    expect(fallbackSpy).toHaveBeenCalled();
    const firstArgs = fallbackSpy.mock.calls[0];
    expect(firstArgs[0]).toBeInstanceOf(Error);
    expect((firstArgs[0] as Error).message).toBe('Boom custom');
    expect(typeof firstArgs[1]).toBe('function');
    expect(screen.getByText('Fallback custom: Boom custom')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset custom' }));

    expect(screen.getByText('Section restaurée')).toBeInTheDocument();
    expect(screen.queryByText('Fallback custom: Boom custom')).not.toBeInTheDocument();
  });

  it('déclenche le reset via le bouton Réessayer du fallback par défaut', () => {
    let shouldThrow = true;

    const MaybeThrow = () => {
      if (shouldThrow) {
        throw new Error('Erreur temporaire');
      }
      return <div>Données rechargées</div>;
    };

    render(
      <SectionErrorBoundary label="Graphique ventes">
        <MaybeThrow />
      </SectionErrorBoundary>,
    );

    expect(screen.getByText('Graphique ventes')).toBeInTheDocument();
    expect(screen.getByText('Erreur temporaire')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /réessayer/i }));

    expect(screen.getByText('Erreur temporaire')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /réessayer/i }));

    expect(screen.getByText('Données rechargées')).toBeInTheDocument();
    expect(screen.queryByText('Erreur temporaire')).not.toBeInTheDocument();
  });

  it('passe les props attendues au composant Button', () => {
    render(
      <SectionErrorBoundary label="Stats">
        <ThrowOnRender message="Erreur bouton" />
      </SectionErrorBoundary>,
    );

    expect(buttonPropsSpy).toHaveBeenCalled();
    const lastCall = buttonPropsSpy.mock.calls.at(-1);
    expect(lastCall).toBeTruthy();
    const props = lastCall?.[0] as { size?: string; variant?: string; className?: string };
    expect(props.size).toBe('sm');
    expect(props.variant).toBe('outline');
    expect(props.className).toBe('gap-2');
  });
});