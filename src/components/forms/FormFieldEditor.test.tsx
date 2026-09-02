import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormFieldEditor } from './FormFieldEditor';

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;

  return {
    GripVertical: Icon,
    Trash2: Icon,
    Plus: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
  };
});

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} value={String(value ?? '')} onChange={onChange} placeholder={placeholder} className={className} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props} className={className}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    asChild: _asChild,
    type,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
  }) => (
    <button {...props} type={type ?? 'button'}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, rows, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      {...props}
      value={String(value ?? '')}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/select', () => {
  const selectOptions = [
    { value: 'text', label: 'Texte court' },
    { value: 'textarea', label: 'Texte long' },
    { value: 'select', label: 'Liste déroulante' },
    { value: 'heading', label: 'Titre (séparateur)' },
  ];

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children?: React.ReactNode;
    }) => (
      <div data-testid="select-root" data-value={value}>
        {children}
        <select aria-label="Type" value={value ?? ''} onChange={(event) => onValueChange?.(event.target.value)}>
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    ),
    SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => <span data-testid="select-value" />,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props} className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { asChild?: boolean; children?: React.ReactNode }) => <>{children}</>,
}));

type Props = ComponentProps<typeof FormFieldEditor>;

function createField(overrides: Record<string, unknown> = {}): Props['field'] {
  return {
    id: 'field-1',
    form_id: 'form-1',
    label: 'Nom complet',
    type: 'text',
    required: true,
    placeholder: 'Votre nom',
    description: "Texte d'aide affiché sous le champ",
    options: [],
    order_index: 0,
    validation: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
    ...overrides,
  } as Props['field'];
}

function renderEditor(props: Props) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FormFieldEditor {...props} />
    </QueryClientProvider>,
  );
}

describe('FormFieldEditor', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('affiche un champ texte avec ses valeurs et déclenche les mises à jour principales', () => {
    const onUpdate = vi.fn<(updates: Partial<Props['field']>) => void>();
    const onDelete = vi.fn<() => void>();

    const { container } = renderEditor({
      field: createField(),
      onUpdate,
      onDelete,
      isDragging: true,
    });

    expect(screen.getByText('Nom complet')).toBeInTheDocument();
    expect(screen.getAllByText('Texte court').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Nom complet')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Votre nom')).toBeInTheDocument();
    expect(screen.getByDisplayValue("Texte d'aide affiché sous le champ")).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(container.firstElementChild?.className).toContain('opacity-50');
    expect(container.firstElementChild?.className).toContain('ring-2');

    fireEvent.change(screen.getByDisplayValue('Nom complet'), { target: { value: 'Prénom et nom' } });
    expect(onUpdate).toHaveBeenCalledWith({ label: 'Prénom et nom' });

    fireEvent.change(screen.getByDisplayValue('Votre nom'), { target: { value: 'Exemple : Marie' } });
    expect(onUpdate).toHaveBeenCalledWith({ placeholder: 'Exemple : Marie' });

    fireEvent.change(screen.getByDisplayValue("Texte d'aide affiché sous le champ"), {
      target: { value: 'Saisissez votre identité complète' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ description: 'Saisissez votre identité complète' });

    fireEvent.click(screen.getByRole('switch'));
    expect(onUpdate).toHaveBeenCalledWith({ required: false });

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'textarea' } });
    expect(onUpdate).toHaveBeenCalledWith({ type: 'textarea' });

    const deleteButtons = screen.getAllByLabelText('Supprimer');
    expect(deleteButtons).toHaveLength(1);
    const deleteButton = deleteButtons.at(0);
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('gère les options pour une liste déroulante sans recréer les données métier attendues', () => {
    const onUpdate = vi.fn<(updates: Partial<Props['field']>) => void>();
    const onDelete = vi.fn<() => void>();

    renderEditor({
      field: createField({
        label: 'Couleur préférée',
        type: 'select',
        required: false,
        options: ['Rouge', 'Bleu'],
      }),
      onUpdate,
      onDelete,
    });

    expect(screen.getByText('Couleur préférée')).toBeInTheDocument();
    expect(screen.getAllByText('Liste déroulante').length).toBeGreaterThan(0);
    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rouge')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bleu')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByText('Ajouter une option'));
    expect(onUpdate).toHaveBeenCalledWith({ options: ['Rouge', 'Bleu', 'Option 3'] });

    onUpdate.mockClear();
    fireEvent.change(screen.getByDisplayValue('Rouge'), { target: { value: 'Vert' } });
    expect(onUpdate).toHaveBeenCalledWith({ options: ['Vert', 'Bleu'] });

    onUpdate.mockClear();
    const deleteButtons = screen.getAllByLabelText('Supprimer');
    expect(deleteButtons).toHaveLength(3);
    const secondOptionDeleteButton = deleteButtons.at(2);
    if (secondOptionDeleteButton) {
      fireEvent.click(secondOptionDeleteButton);
    }
    expect(onUpdate).toHaveBeenCalledWith({ options: ['Rouge'] });
  });

  it('masque les réglages de saisie pour un champ décoratif de type titre', () => {
    const onUpdate = vi.fn<(updates: Partial<Props['field']>) => void>();
    const onDelete = vi.fn<() => void>();

    renderEditor({
      field: createField({
        label: 'Informations personnelles',
        type: 'heading',
        required: false,
        placeholder: 'Ne doit pas être affiché',
        description: 'Ne doit pas être affichée',
        options: ['Option ignorée'],
      }),
      onUpdate,
      onDelete,
    });

    expect(screen.getByText('Informations personnelles')).toBeInTheDocument();
    expect(screen.getAllByText('Titre (séparateur)').length).toBeGreaterThan(0);
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.queryByText('Description (optionnel)')).not.toBeInTheDocument();
    expect(screen.queryByText('Placeholder')).not.toBeInTheDocument();
    expect(screen.queryByText('Obligatoire')).not.toBeInTheDocument();
    expect(screen.queryByText('Options')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ne doit pas être affiché')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ne doit pas être affichée')).not.toBeInTheDocument();
  });
});