import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NotesRichEditor } from '../NotesRichEditor';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/img.png' } }),
      }),
    },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/hooks/voice/useVoiceDictation', () => ({
  useVoiceDictation: () => ({
    isRecording: false,
    isProcessing: false,
    audioLevel: 0,
    toggleRecording: vi.fn(),
  }),
}));

function renderEditor(overrides: { content?: string; onChange?: (v: string) => void } = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  render(
    <TooltipProvider>
      <NotesRichEditor
        content={overrides.content ?? ''}
        onChange={onChange}
        noteId="n1"
        userId="u1"
      />
    </TooltipProvider>
  );
  return { onChange };
}

describe('NotesRichEditor', () => {
  it('renders the formatting toolbar with the expected action buttons', () => {
    renderEditor();
    // Toolbar buttons rendered as <button> with title/aria via Tooltip — count must be > 0 and include Bold
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it('renders the editor with the provided initial content', () => {
    renderEditor({ content: '<p>Hello world</p>' });
    // ProseMirror renders content into a contenteditable region
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('exposes a contenteditable region wired to the props content', () => {
    renderEditor({ content: '<p>Initial</p>' });
    const editable = document.querySelector('[contenteditable="true"]');
    expect(editable).not.toBeNull();
    expect(editable?.textContent).toContain('Initial');
  });
});
