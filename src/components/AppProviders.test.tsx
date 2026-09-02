/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProviders } from './AppProviders';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('AppProviders', () => {
  it('rend les providers dans le bon ordre du plus externe au plus interne', () => {
    const calls: string[] = [];

    function ProviderA({ children }: { children: React.ReactNode }) {
      calls.push('A');
      return <div data-testid="provider-a">{children}</div>;
    }

    function ProviderB({ children }: { children: React.ReactNode }) {
      calls.push('B');
      return <section data-testid="provider-b">{children}</section>;
    }

    function ProviderC({ children }: { children: React.ReactNode }) {
      calls.push('C');
      return <main data-testid="provider-c">{children}</main>;
    }

    render(
      <AppProviders providers={[ProviderA, ProviderB, ProviderC]}>
        <span data-testid="content">contenu</span>
      </AppProviders>,
      { wrapper: createWrapper() }
    );

    expect(calls).toEqual(['A', 'B', 'C']);
    expect(screen.getByTestId('provider-a')).toContainElement(screen.getByTestId('provider-b'));
    expect(screen.getByTestId('provider-b')).toContainElement(screen.getByTestId('provider-c'));
    expect(screen.getByTestId('provider-c')).toContainElement(screen.getByTestId('content'));
    expect(screen.getByTestId('content')).toHaveTextContent('contenu');
  });

  it('rend directement les enfants quand la liste de providers est vide', () => {
    render(
      <AppProviders providers={[]}>
        <div data-testid="content-vide">seul enfant</div>
      </AppProviders>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('content-vide')).toHaveTextContent('seul enfant');
  });

  it('propage bien le contexte à travers plusieurs providers', () => {
    const OrderContext = React.createContext<string[]>([]);

    function ProviderOuter({ children }: { children: React.ReactNode }) {
      return <OrderContext.Provider value={['outer']}>{children}</OrderContext.Provider>;
    }

    function ProviderInner({ children }: { children: React.ReactNode }) {
      return (
        <OrderContext.Consumer>
          {(value) => (
            <OrderContext.Provider value={[...value, 'inner']}>{children}</OrderContext.Provider>
          )}
        </OrderContext.Consumer>
      );
    }

    function Consumer() {
      const value = React.useContext(OrderContext);
      return <div data-testid="context-value">{value.join('>')}</div>;
    }

    render(
      <AppProviders providers={[ProviderOuter, ProviderInner]}>
        <Consumer />
      </AppProviders>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('context-value')).toHaveTextContent('outer>inner');
  });
});