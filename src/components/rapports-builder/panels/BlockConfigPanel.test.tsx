import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockConfigPanel } from './BlockConfigPanel';

const { REPORT_SOURCES_STABLE, authState, mockFrom, navigateMock, toastSuccess, toastError } = vi.hoisted(() => ({
  REPORT_SOURCES_STABLE: [
    {
      key: 'sales',
      label: 'Ventes',
      description: 'Données de ventes',
      dimensions: ['day', 'region'],
      measures: ['revenue', 'orders'],
    },
    {
      key: 'customers',
      label: 'Clients',
      description: 'Données clients',
      dimensions: ['country', 'segment'],
      measures: ['count', 'active'],
    },
  ],
  authState: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/types/report', () => ({
  REPORT_SOURCES: REPORT_SOURCES_STABLE,
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('lucide-react', () => ({
  Trash2: () => <svg data-testid="trash-icon" />,
  Copy: () => <svg data-testid="copy-icon" />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
  }) => <input data-testid="input" value={value} onChange={onChange} className={className} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    rows,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    rows?: number;
    className?: string;
  }) => <textarea data-testid="textarea" value={value} onChange={onChange} rows={rows} className={className} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    title,
    'aria-label': ariaLabel,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    title?: string;
    'aria-label'?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} title={title} aria-label={ariaLabel} className={className}>
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
    >
      switch
    </button>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/select', () => {
  const ReactModule = React;

  type SelectContextValue = {
    value?: string;
    onValueChange?: (value: string) => void;
  };

  const SelectContext = ReactModule.createContext<SelectContextValue>({});

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </SelectContext.Provider>
  );

  const SelectTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );

  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;

  const SelectContent = ({ children }: { children: React.ReactNode }) => {
    const ctx = ReactModule.useContext(SelectContext);
    const options: Array<{ value: string; label: string }> = [];

    ReactModule.Children.forEach(children, (child) => {
      if (ReactModule.isValidElement(child)) {
        const props = child.props as { value?: string; children?: React.ReactNode };
        const rawChildren = props.children;
        const extractText = (node: React.ReactNode): string => {
          if (typeof node === 'string' || typeof node === 'number') return String(node);
          if (Array.isArray(node)) return node.map(extractText).join(' ');
          if (ReactModule.isValidElement(node)) return extractText((node.props as { children?: React.ReactNode }).children);
          return '';
        };
        options.push({
          value: props.value ?? '',
          label: extractText(rawChildren).replace(/\s+/g, ' ').trim(),
        });
      }
    });

    return (
      <select
        data-testid="select"
        value={ctx.value ?? ''}
        onChange={(e) => ctx.onValueChange?.(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectItem = ({ children }: { value: string; children: React.ReactNode; className?: string }) => <>{children}</>;

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

describe('BlockConfigPanel', () => {
  it('affiche le message vide quand aucun bloc n’est sélectionné', () => {
    render(<BlockConfigPanel widget={null} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Sélectionnez un bloc pour le configurer')).toBeInTheDocument();
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
  });

  it('rend la configuration markdown et met à jour le titre et le contenu', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();

    render(
      <BlockConfigPanel
        widget={{
          id: 'w1',
          type: 'markdown',
          title: 'Bloc intro',
          markdown: 'Texte initial',
        }}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />,
    );

    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bloc intro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Texte initial')).toBeInTheDocument();
    expect(screen.queryByText('Source de données')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Bloc intro'), {
      target: { value: 'Nouveau titre' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ title: 'Nouveau titre' });

    fireEvent.change(screen.getByDisplayValue('Texte initial'), {
      target: { value: 'Contenu modifié' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ markdown: 'Contenu modifié' });

    fireEvent.click(screen.getByLabelText('Supprimer'));
    expect(onDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Copier'));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('met à jour source, dimension et mesure pour un bloc non-kpi', () => {
    const onUpdate = vi.fn();

    render(
      <BlockConfigPanel
        widget={{
          id: 'w2',
          type: 'bar',
          title: 'Graph ventes',
          source: 'sales',
          dimension: 'day',
          measure: 'revenue',
        }}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Source de données')).toBeInTheDocument();
    expect(screen.getByText('Dimension (axe)')).toBeInTheDocument();
    expect(screen.getByText('Mesure (valeur)')).toBeInTheDocument();

    const selects = screen.getAllByTestId('select');
    expect(selects).toHaveLength(3);

    fireEvent.change(selects[0], { target: { value: 'customers' } });
    expect(onUpdate).toHaveBeenCalledWith({
      source: 'customers',
      dimension: 'country',
      measure: 'count',
    });

    fireEvent.change(selects[1], { target: { value: 'region' } });
    expect(onUpdate).toHaveBeenCalledWith({ dimension: 'region' });

    fireEvent.change(selects[2], { target: { value: 'orders' } });
    expect(onUpdate).toHaveBeenCalledWith({ measure: 'orders' });
  });

  it('rend les options spécifiques KPI et met à jour format et comparaison', () => {
    const onUpdate = vi.fn();

    render(
      <BlockConfigPanel
        widget={{
          id: 'w3',
          type: 'kpi',
          title: 'CA total',
          source: 'sales',
          measure: 'revenue',
          format: 'number',
          compareWithPrevious: false,
        }}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText('Dimension (axe)')).not.toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Comparaison période précédente')).toBeInTheDocument();
    expect(screen.getByTestId('separator')).toBeInTheDocument();

    const selects = screen.getAllByTestId('select');
    expect(selects).toHaveLength(3);

    fireEvent.change(selects[2], { target: { value: 'currency' } });
    expect(onUpdate).toHaveBeenCalledWith({ format: 'currency' });

    const switchButton = screen.getByRole('switch');
    expect(switchButton).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(switchButton);
    expect(onUpdate).toHaveBeenCalledWith({ compareWithPrevious: true });
  });
});