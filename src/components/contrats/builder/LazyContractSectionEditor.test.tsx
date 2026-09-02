import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';

const { childRenderSpy } = vi.hoisted(() => ({
  childRenderSpy: vi.fn(),
}));

vi.mock('./ContractSectionEditor', async () => {
  const React = await import('react');

  return {
    ContractSectionEditor: (props: Record<string, unknown>) => {
      childRenderSpy(props);

      return React.createElement(
        'div',
        { 'data-testid': 'contract-section-editor-inner' },
        'Éditeur chargé',
      );
    },
  };
});

import { ContractSectionEditor } from './LazyContractSectionEditor';

type LazyEditorProps = ComponentProps<typeof ContractSectionEditor>;

function renderEditor(props: Record<string, unknown> = {}) {
  const editorProps = {
    marker: 'default-marker',
    ...props,
  } as unknown as LazyEditorProps;

  return render(<ContractSectionEditor {...editorProps} />);
}

describe('LazyContractSectionEditor', () => {
  beforeEach(() => {
    childRenderSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le fallback de chargement puis rend l'éditeur chargé", async () => {
    renderEditor({ marker: 'loading-case' });

    const fallback = screen.getByText("Chargement de l'éditeur…");

    expect(fallback.tagName.toLowerCase()).toBe('div');
    expect(fallback.className).toContain('min-h-[200px]');
    expect(fallback.className).toContain('text-muted-foreground');
    expect(fallback.textContent).toBe("Chargement de l'éditeur…");

    const editor = await screen.findByTestId('contract-section-editor-inner');

    expect(editor.textContent).toBe('Éditeur chargé');

    await waitFor(() => {
      expect(screen.queryByText("Chargement de l'éditeur…")).toBeNull();
    });
  });

  it("transmet les props reçues à l'éditeur interne lazy-loadé", async () => {
    const onSectionChange = vi.fn();

    renderEditor({
      marker: 'prop-forwarding-case',
      isReadOnly: true,
      onSectionChange,
    });

    await screen.findByTestId('contract-section-editor-inner');

    expect(childRenderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        marker: 'prop-forwarding-case',
        isReadOnly: true,
        onSectionChange,
      }),
    );
  });
});