// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MarkdownBlock } from './MarkdownBlock';

const { cardProps } = vi.hoisted(() => ({
  cardProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    cardProps.push(props);
    return <div data-testid="card">{children}</div>;
  },
  CardHeader: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <h2 data-testid="card-title" {...props}>
      {children}
    </h2>
  ),
  CardContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}));

describe('MarkdownBlock', () => {
  beforeEach(() => {
    cardProps.length = 0;
  });

  it('affiche le titre et le contenu markdown fournis', () => {
    render(
      <MarkdownBlock
        widget={
          {
            id: 'w1',
            type: 'markdown',
            title: 'Notes équipe',
            markdown: 'Ligne 1\nLigne 2',
          } as unknown as import('@/types/report').WidgetConfig
        }
      />
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Notes équipe');

    const content = screen.getByTestId('card-content');
    expect(content).toHaveTextContent('Ligne 1');
    expect(content).toHaveTextContent('Ligne 2');
    expect(content.textContent).toContain('Ligne 1\nLigne 2');

    expect(screen.getByTestId('card-content')).toHaveClass(
      'flex-1',
      'overflow-auto',
      'prose',
      'prose-sm',
      'dark:prose-invert',
      'max-w-none'
    );
    expect(cardProps[0]).toMatchObject({ className: 'h-full flex flex-col' });
  });

  it('n’affiche pas de header si le titre est absent', () => {
    render(
      <MarkdownBlock
        widget={
          {
            id: 'w2',
            type: 'markdown',
            markdown: 'Contenu seul',
          } as unknown as import('@/types/report').WidgetConfig
        }
      />
    );

    expect(screen.queryByTestId('card-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-title')).not.toBeInTheDocument();
    expect(screen.getByTestId('card-content')).toHaveTextContent('Contenu seul');
  });

  it('affiche le message par défaut quand markdown est vide', () => {
    render(
      <MarkdownBlock
        widget={
          {
            id: 'w3',
            type: 'markdown',
            title: 'Bloc vide',
            markdown: '',
          } as unknown as import('@/types/report').WidgetConfig
        }
      />
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Bloc vide');
    expect(screen.getByTestId('card-content')).toHaveTextContent('Bloc texte vide. Cliquez pour éditer.');
  });

  it('préserve les retours à la ligne via la classe whitespace-pre-wrap sur le conteneur interne', () => {
    const { container } = render(
      <MarkdownBlock
        widget={
          {
            id: 'w4',
            type: 'markdown',
            title: 'Format',
            markdown: 'A\nB',
          } as unknown as import('@/types/report').WidgetConfig
        }
      />
    );

    const textContainer = container.querySelector('.whitespace-pre-wrap.text-sm');
    expect(textContainer).not.toBeNull();
    expect(textContainer?.textContent).toBe('A\nB');
  });
});