import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  FORM,
  mockUseParams,
  mockUseFormBySlug,
  mockUseSubmitFormResponse,
  mutateAsync,
} = vi.hoisted(() => {
  const FORM = {
    id: 'form_1',
    title: 'Formulaire public',
    description: 'Description du formulaire',
    success_message: 'Merci pour votre réponse',
    form_fields: [
      { id: 'f1', type: 'text', required: true, label: 'Champ requis' },
      { id: 'f2', type: 'text', required: false, label: 'Champ optionnel' },
      { id: 'h1', type: 'heading', required: true, label: 'Titre' },
    ],
  };

  return {
    FORM,
    mockUseParams: vi.fn(() => ({ slug: 'slug-1' })),
    mockUseFormBySlug: vi.fn(),
    mutateAsync: vi.fn(),
    mockUseSubmitFormResponse: vi.fn(),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: mockUseParams,
  };
});

vi.mock('@/hooks/forms/useForms', () => ({
  useFormBySlug: mockUseFormBySlug,
  useSubmitFormResponse: mockUseSubmitFormResponse,
}));

vi.mock('lucide-react', () => ({
  CheckCircle: (props: { className?: string }) => <svg data-testid="icon-check" className={props.className} />,
  Loader2: (props: { className?: string }) => <svg data-testid="icon-loader" className={props.className} />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: (props: React.PropsWithChildren<{ className?: string }>) => <div data-testid="card" className={props.className}>{props.children}</div>,
  CardHeader: (props: React.PropsWithChildren) => <div data-testid="card-header">{props.children}</div>,
  CardTitle: (props: React.PropsWithChildren<{ className?: string }>) => <h1 data-testid="card-title" className={props.className}>{props.children}</h1>,
  CardDescription: (props: React.PropsWithChildren) => <p data-testid="card-description">{props.children}</p>,
  CardContent: (props: React.PropsWithChildren<{ className?: string }>) => <div data-testid="card-content" className={props.className}>{props.children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) => (
    <button {...props} />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: { className?: string }) => <div data-testid="skeleton" className={props.className} />,
}));

vi.mock('@/components/forms/FormFieldRenderer', () => ({
  FormFieldRenderer: (props: {
    field: { id: string; label?: string; required?: boolean; type?: string };
    value: string;
    onChange: (v: string) => void;
  }) => {
    const label = props.field.label || props.field.id;
    return (
      <div data-testid={`field-${props.field.id}`}>
        <label htmlFor={`input-${props.field.id}`}>{label}</label>
        <input
          id={`input-${props.field.id}`}
          aria-label={label}
          value={props.value}
          onChange={(e) => props.onChange((e.target as HTMLInputElement).value)}
        />
      </div>
    );
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  const methods = [
    'select',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'contains',
    'ilike',
    'like',
    'order',
    'limit',
    'range',
    'insert',
    'update',
    'upsert',
    'delete',
    'rpc',
    'maybeSingle',
    'single',
  ] as const;

  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = vi.fn((onFulfilled?: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled));
  builder.catch = vi.fn((onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected));

  const mockFrom = vi.fn(() => builder);

  return { supabase: { from: mockFrom } };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('FormPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseFormBySlug.mockReturnValue({ data: FORM, isLoading: false });
    mutateAsync.mockResolvedValue(undefined);
    mockUseSubmitFormResponse.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('affiche le skeleton pendant le chargement', async () => {
    mockUseFormBySlug.mockReturnValue({ data: undefined, isLoading: true });

    const { default: FormPublic } = await import('./FormPublic');
    renderWithClient(<FormPublic />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByText(FORM.title)).not.toBeInTheDocument();
  });

  it("soumet une réponse valide et affiche l'écran de succès", async () => {
    const { default: FormPublic } = await import('./FormPublic');
    renderWithClient(<FormPublic />);

    expect(screen.getByText(FORM.title)).toBeInTheDocument();
    expect(screen.getByText(FORM.description)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('Nom (optionnel)');
    const emailInput = screen.getByPlaceholderText('Email (optionnel)');

    fireEvent.change(nameInput, { target: { value: 'Alex' } });
    fireEvent.change(emailInput, { target: { value: 'alex@example.test' } });

    const requiredField = screen.getByTestId('field-f1');
    const requiredInput = within(requiredField).getByLabelText('Champ requis');
    fireEvent.change(requiredInput, { target: { value: 'Bonjour' } });

    const optionalField = screen.getByTestId('field-f2');
    const optionalInput = within(optionalField).getByLabelText('Champ optionnel');
    fireEvent.change(optionalInput, { target: { value: '   ' } });

    const submitBtn = screen.getByRole('button', { name: 'Envoyer' });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      form_id: FORM.id,
      respondent_name: 'Alex',
      respondent_email: 'alex@example.test',
      values: [{ field_id: 'f1', value: 'Bonjour' }],
    });

    expect(await screen.findByText('Réponse envoyée !')).toBeInTheDocument();
    expect(screen.getByText(FORM.success_message)).toBeInTheDocument();
    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
  });

  it("n'envoie pas si un champ requis est manquant", async () => {
    const { default: FormPublic } = await import('./FormPublic');
    renderWithClient(<FormPublic />);

    const submitBtn = screen.getByRole('button', { name: 'Envoyer' });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('Réponse envoyée !')).not.toBeInTheDocument();
  });

  it("ne passe pas en succès si la mutation échoue (erreur gérée par la mutation)", async () => {
    mutateAsync.mockRejectedValueOnce(new Error('x'));

    const { default: FormPublic } = await import('./FormPublic');
    renderWithClient(<FormPublic />);

    const requiredField = screen.getByTestId('field-f1');
    const requiredInput = within(requiredField).getByLabelText('Champ requis');
    fireEvent.change(requiredInput, { target: { value: 'OK' } });

    const submitBtn = screen.getByRole('button', { name: 'Envoyer' });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Réponse envoyée !')).not.toBeInTheDocument();
    expect(screen.getByText(FORM.title)).toBeInTheDocument();
  });
});