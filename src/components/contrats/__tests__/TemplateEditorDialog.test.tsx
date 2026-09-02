import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('dompurify', () => ({
  default: { sanitize: (html: string) => html },
}));

vi.mock('@/hooks/contracts/useContratTemplates', () => ({
  useUpdateTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('./ClauseRichEditor', () => ({
  ClauseRichEditor: ({ value }: { value: string }) => <div data-testid="editor">{value}</div>,
}));

vi.mock('./ClauseAIToolbar', () => ({
  ClauseAIToolbar: () => <div data-testid="ai-toolbar" />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { TemplateEditorDialog } from '../TemplateEditorDialog';
import { supabase } from '@/integrations/supabase/client';

describe('TemplateEditorDialog', () => {
  it('renders new template dialog', () => {
    render(<TemplateEditorDialog template={null} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders edit template dialog', () => {
    const template = {
      id: 't1',
      nom: 'Template Test',
      type: 'licence' as const,
      description: 'Desc',
      contenu_html: '<p>Content</p>',
      variables: [],
      clauses_ids: [],
      est_actif: true,
      created_by: 'u1',
      created_at: '',
      updated_at: '',
    };
    render(<TemplateEditorDialog template={template} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Template Test')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<TemplateEditorDialog template={null} open={false} onOpenChange={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
