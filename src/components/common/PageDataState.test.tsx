// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageDataState } from './PageDataState';

const { classifyErrorMock, linkMock } = vi.hoisted(() => ({
  classifyErrorMock: vi.fn(),
  linkMock: vi.fn(({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  )),
}));

vi.mock('@/lib/errorClassifier', () => ({
  classifyError: classifyErrorMock,
}));

vi.mock('react-router-dom', () => ({
  Link: linkMock,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    asChild,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    variant?: string;
    size?: string;
  }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, props);
    }
    return (
      <button type="button" onClick={onClick} {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('lucide-react', () => ({
  ShieldAlert: ({ className }: { className?: string }) => <svg data-testid="icon-shield" className={className} />,
  AlertTriangle: ({ className }: { className?: string }) => <svg data-testid="icon-alert" className={className} />,
  RefreshCw: ({ className }: { className?: string }) => <svg data-testid="icon-refresh" className={className} />,
  WifiOff: ({ className }: { className?: string }) => <svg data-testid="icon-wifi-off" className={className} />,
  Inbox: ({ className }: { className?: string }) => <svg data-testid="icon-inbox" className={className} />,
}));

describe('PageDataState', () => {
  beforeEach(() => {
    classifyErrorMock.mockReset();
    linkMock.mockClear();
  });

  it('affiche les skeletons par défaut pendant le chargement', () => {
    render(
      <PageDataState isLoading={true} isError={false}>
        <div>Contenu chargé</div>
      </PageDataState>
    );

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons).toHaveLength(2);
    expect(screen.queryByText('Contenu chargé')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
  });

  it('affiche le loadingFallback personnalisé pendant le chargement', () => {
    render(
      <PageDataState
        isLoading={true}
        isError={false}
        loadingFallback={<div>Chargement personnalisé</div>}
      >
        <div>Contenu chargé</div>
      </PageDataState>
    );

    expect(screen.getByText('Chargement personnalisé')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Contenu chargé')).not.toBeInTheDocument();
  });

  it('affiche les enfants quand tout est OK', () => {
    render(
      <PageDataState isLoading={false} isError={false} isEmpty={false}>
        <section>
          <h1>Données prêtes</h1>
          <p>Liste de résultats</p>
        </section>
      </PageDataState>
    );

    expect(screen.getByText('Données prêtes')).toBeInTheDocument();
    expect(screen.getByText('Liste de résultats')).toBeInTheDocument();
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
  });

  it('affiche l’état vide avec les textes par défaut', () => {
    render(
      <PageDataState isLoading={false} isError={false} isEmpty={true}>
        <div>Contenu</div>
      </PageDataState>
    );

    expect(screen.getByTestId('icon-inbox')).toBeInTheDocument();
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument();
    expect(screen.getByText("Il n'y a rien à afficher pour le moment.")).toBeInTheDocument();
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });

  it('affiche l’état vide personnalisé avec action', () => {
    render(
      <PageDataState
        isLoading={false}
        isError={false}
        isEmpty={true}
        emptyTitle="Aucun projet"
        emptyDescription="Créez votre premier projet pour commencer."
        emptyAction={<button type="button">Créer un projet</button>}
      >
        <div>Contenu</div>
      </PageDataState>
    );

    expect(screen.getByText('Aucun projet')).toBeInTheDocument();
    expect(screen.getByText('Créez votre premier projet pour commencer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer un projet' })).toBeInTheDocument();
  });

  it('affiche une erreur unauthorized sans bouton réessayer', () => {
    classifyErrorMock.mockReturnValue('unauthorized');

    render(
      <PageDataState
        isLoading={false}
        isError={true}
        error={new Error('Interdit')}
        onRetry={vi.fn()}
      >
        <div>Contenu</div>
      </PageDataState>
    );

    expect(classifyErrorMock).toHaveBeenCalledWith(expect.any(Error));
    expect(screen.getByTestId('icon-shield')).toBeInTheDocument();
    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(
      screen.getByText("Votre rôle n'a pas accès à cette ressource. Contactez un administrateur si besoin.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Réessayer/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/');
  });

  it('affiche une erreur réseau avec bouton réessayer fonctionnel', () => {
    classifyErrorMock.mockReturnValue('network');
    const onRetry = vi.fn();

    render(
      <PageDataState
        isLoading={false}
        isError={true}
        error={new Error('Network down')}
        onRetry={onRetry}
      >
        <div>Contenu</div>
      </PageDataState>
    );

    expect(screen.getByTestId('icon-wifi-off')).toBeInTheDocument();
    expect(screen.getByText('Connexion indisponible')).toBeInTheDocument();
    expect(screen.getByText('Vérifiez votre connexion internet puis réessayez.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('affiche une erreur générique avec le message de Error et le lien de retour', () => {
    classifyErrorMock.mockReturnValue('unknown');

    render(
      <PageDataState
        isLoading={false}
        isError={true}
        error={new Error('Le serveur a renvoyé 500')}
      >
        <div>Contenu</div>
      </PageDataState>
    );

    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
    expect(screen.getByText('Erreur de chargement')).toBeInTheDocument();
    expect(screen.getByText('Le serveur a renvoyé 500')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/');
  });

  it('affiche le message générique si error n’est pas une instance de Error', () => {
    classifyErrorMock.mockReturnValue('other');

    render(
      <PageDataState
        isLoading={false}
        isError={true}
        error={{ message: 'x' }}
      >
        <div>Contenu</div>
      </PageDataState>
    );

    expect(screen.getByText('Erreur de chargement')).toBeInTheDocument();
    expect(screen.getByText('Une erreur inattendue est survenue.')).toBeInTheDocument();
  });
});