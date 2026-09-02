/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const { richTextEditorMock, gate } = vi.hoisted(() => {
  let resolveImport: (() => void) | null = null;

  return {
    richTextEditorMock: vi.fn(
      ({
        value,
        placeholder,
        onChange,
      }: {
        value?: string;
        placeholder?: string;
        onChange?: (value: string) => void;
      }) => (
        <div data-testid="rich-text-editor-mock">
          <span data-testid="editor-value">{value ?? ''}</span>
          <span data-testid="editor-placeholder">{placeholder ?? ''}</span>
          <span data-testid="editor-has-onchange">{String(typeof onChange === 'function')}</span>
        </div>
      )
    ),
    gate: {
      wait: () =>
        new Promise<void>((resolve) => {
          resolveImport = resolve;
        }),
      release: () => {
        if (resolveImport) {
          const fn = resolveImport;
          resolveImport = null;
          fn();
        }
      },
      reset: () => {
        resolveImport = null;
      },
    },
  };
});

vi.mock('./RichTextEditor', async () => {
  await gate.wait();
  return { RichTextEditor: richTextEditorMock };
});

import { RichTextEditor } from './LazyRichTextEditor';

describe('LazyRichTextEditor', () => {
  afterEach(() => {
    cleanup();
    richTextEditorMock.mockClear();
  });

  it("affiche le fallback de chargement avec son texte et ses classes avant résolution du lazy import", () => {
    render(<RichTextEditor value="Bonjour" placeholder="Écrire ici" />);

    const fallback = screen.getByText("Chargement de l'éditeur…");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveClass('min-h-[120px]');
    expect(fallback).toHaveClass('flex');
    expect(fallback).toHaveClass('items-center');
    expect(fallback).toHaveClass('justify-center');
    expect(fallback).toHaveClass('text-xs');
    expect(fallback).toHaveClass('text-muted-foreground');
    expect(fallback).toHaveClass('border');
    expect(fallback).toHaveClass('rounded-md');
    expect(screen.queryByTestId('rich-text-editor-mock')).not.toBeInTheDocument();
    expect(richTextEditorMock).not.toHaveBeenCalled();

    gate.release();
  });

  it('rend ensuite le RichTextEditor chargé avec les props transmises', async () => {
    render(<RichTextEditor value="<p>Contenu</p>" placeholder="Mon placeholder" />);

    expect(screen.getByText("Chargement de l'éditeur…")).toBeInTheDocument();

    gate.release();

    expect(await screen.findByTestId('rich-text-editor-mock')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Chargement de l'éditeur…")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('editor-value')).toHaveTextContent('<p>Contenu</p>');
    expect(screen.getByTestId('editor-placeholder')).toHaveTextContent('Mon placeholder');

    expect(richTextEditorMock).toHaveBeenCalledTimes(1);
    const firstCall = richTextEditorMock.mock.calls[0];
    expect(firstCall?.[0]).toMatchObject({
      value: '<p>Contenu</p>',
      placeholder: 'Mon placeholder',
    });
  });

  it('transmet aussi les props optionnelles supplémentaires au composant lazy chargé', async () => {
    const onChange = vi.fn();

    render(
      <RichTextEditor
        value="<p>A</p>"
        placeholder="Texte"
        onChange={onChange}
      />
    );

    gate.release();

    expect(await screen.findByTestId('rich-text-editor-mock')).toBeInTheDocument();

    expect(screen.getByTestId('editor-value')).toHaveTextContent('<p>A</p>');
    expect(screen.getByTestId('editor-placeholder')).toHaveTextContent('Texte');
    expect(screen.getByTestId('editor-has-onchange')).toHaveTextContent('true');

    const firstCall = richTextEditorMock.mock.calls[0];
    expect(firstCall?.[0]).toMatchObject({
      value: '<p>A</p>',
      placeholder: 'Texte',
      onChange,
    });
  });
});