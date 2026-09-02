import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormBuilder from './FormBuilder';

const {
  MOCK_FORM_DRAFT,
  MOCK_FORM_PUBLISHED,
  mockNavigate,
  mockUseFormDetail,
  mockUseForms,
  mockUseFormFields,
  mockUseToast,
  mockFrom,
} = vi.hoisted(() => {
  const mockNavigateFn = vi.fn();

  const draftForm = {
    id: 'form1',
    title: 'Formulaire brouillon',
    description: 'Description initiale',
    status: 'draft',
    slug: 'formulaire-brouillon',
    success_message: 'Merci pour votre réponse',
    form_fields: [
      {
        id: 'field1',
        form_id: 'form1',
        type: 'text',
        label: 'Nom',
        required: true,
        options: [],
        validation_rules: {},
        position: 0,
      },
    ],
  };

  const publishedForm = {
    ...draftForm,
    status: 'published',
    slug: 'formulaire-publie',
  };

  const mockUseFormDetailFn = vi.fn();
  const mockUseFormsFn = vi.fn();
  const mockUseFormFieldsFn = vi.fn();
  const mockUseToastFn = vi.fn();

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockImplementation((onFulfilled) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled)
    ),
    catch: vi.fn().mockImplementation((onRejected) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected)
    ),
  };

  const mockFromFn = vi.fn().mockReturnValue(builder);

  return {
    MOCK_FORM_DRAFT: draftForm,
    MOCK_FORM_PUBLISHED: publishedForm,
    mockNavigate: mockNavigateFn,
    mockUseFormDetail: mockUseFormDetailFn,
    mockUseForms: mockUseFormsFn,
    mockUseFormFields: mockUseFormFieldsFn,
    mockUseToast: mockUseToastFn,
    mockFrom: mockFromFn,
  };
});

vi.mock('react-router-dom', () => ({
  useParams: () => ({ formId: 'form1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@/components/ui/tabs', () => {
  const Tabs = ({ value, onValueChange, children }: any) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  );
  const TabsList = ({ children, ...rest }: any) => (
    <div {...rest}>{children}</div>
  );
  const TabsTrigger = ({ value, children, ...rest }: any) => (
    <button onClick={() => rest.onClick?.()} data-value={value} {...rest}>
      {children}
    </button>
  );
  const TabsContent = ({ value, children }: any) => (
    <div data-testid={`tabs-content-${value}`}>{children}</div>
  );
  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: any) => <div {...props} />,
}));

vi.mock('@/components/forms/FormFieldEditor', () => ({
  FormFieldEditor: ({ field, onUpdate, onDelete }: any) => (
    <div>
      <span>{field.label}</span>
      <button onClick={() => onUpdate({ label: 'Updated label' })}>
        update-field
      </button>
      <button onClick={onDelete}>delete-field</button>
    </div>
  ),
}));

vi.mock('@/components/forms/FormPreview', () => ({
  FormPreview: ({ form }: any) => (
    <div>
      <p>Preview: {form.title}</p>
    </div>
  ),
}));

vi.mock('@/hooks/forms/useForms', () => ({
  useFormDetail: (...args: any[]) => mockUseFormDetail(...args),
  useFormFields: (...args: any[]) => mockUseFormFields(...args),
  useForms: (...args: any[]) => mockUseForms(...args),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => mockUseToast(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: (props: any) => <svg {...props} />,
  Plus: (props: any) => <svg {...props} />,
  Eye: (props: any) => <svg {...props} />,
  ExternalLink: (props: any) => <svg {...props} />,
  Copy: (props: any) => <svg {...props} />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>
  );
}

describe('FormBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseFormDetail.mockReturnValue({
      data: MOCK_FORM_DRAFT,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseForms.mockReturnValue({
      updateForm: {
        mutateAsync: vi.fn().mockResolvedValue(undefined),
      },
    });

    mockUseFormFields.mockReturnValue({
      addField: {
        mutateAsync: vi.fn().mockResolvedValue(undefined),
      },
      updateField: {
        mutateAsync: vi.fn().mockResolvedValue(undefined),
      },
      deleteField: {
        mutateAsync: vi.fn().mockResolvedValue(undefined),
      },
    });

    mockUseToast.mockReturnValue({
      toast: vi.fn(),
    });

    (global as any).navigator = {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    };
    (global as any).window = Object.assign(global.window || {}, {
      location: { origin: 'http://localhost' },
    });
  });

  it('affiche le skeleton pendant le chargement', () => {
    mockUseFormDetail.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithClient(<FormBuilder />);

    expect(screen.getAllByRole('generic').length).toBeGreaterThan(0);
  });

  it('affiche un message quand le formulaire est introuvable et permet de revenir', () => {
    mockUseFormDetail.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithClient(<FormBuilder />);

    expect(screen.getByText('Formulaire introuvable')).toBeInTheDocument();
    const retourButton = screen.getByRole('button', { name: /Retour aux formulaires/i });
    fireEvent.click(retourButton);
    expect(mockNavigate).toHaveBeenCalledWith('/formulaires');
  });

  it('affiche les données du formulaire brouillon et permet de changer le titre', async () => {
    const updateFormMock = mockUseForms().updateForm.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    expect(screen.getByDisplayValue(MOCK_FORM_DRAFT.title)).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue(MOCK_FORM_DRAFT.title);
    fireEvent.change(titleInput, { target: { value: 'Nouveau titre' } });

    await waitFor(() => {
      expect(updateFormMock).toHaveBeenCalledWith({
        id: MOCK_FORM_DRAFT.id,
        title: 'Nouveau titre',
      });
    });
  });

  it('permet de changer la description', async () => {
    const updateFormMock = mockUseForms().updateForm.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    const descriptionTextarea = screen.getByDisplayValue(MOCK_FORM_DRAFT.description);
    fireEvent.change(descriptionTextarea, { target: { value: 'Nouvelle description' } });

    await waitFor(() => {
      expect(updateFormMock).toHaveBeenCalledWith({
        id: MOCK_FORM_DRAFT.id,
        description: 'Nouvelle description',
      });
    });
  });

  it('permet d’ajouter un champ texte via handleAddField', async () => {
    const formWithFields = {
      ...MOCK_FORM_DRAFT,
      form_fields: [...MOCK_FORM_DRAFT.form_fields],
    };

    mockUseFormDetail.mockReturnValueOnce({
      data: formWithFields,
      isLoading: false,
      isError: false,
      error: null,
    });

    const addFieldMock = mockUseFormFields().addField.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    const addTextButton = screen.getByRole('button', { name: /Texte$/i });
    await act(async () => {
      fireEvent.click(addTextButton);
    });

    expect(addFieldMock).toHaveBeenCalledWith({
      form_id: 'form1',
      type: 'text',
      label: 'Nouveau champ',
      required: false,
      options: [],
      validation_rules: {},
      position: formWithFields.form_fields.length,
    });
  });

  it('permet de mettre à jour un champ via FormFieldEditor', async () => {
    const updateFieldMock = mockUseFormFields().updateField.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    const updateButton = screen.getByText('update-field');
    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(updateFieldMock).toHaveBeenCalledWith({
      id: 'field1',
      label: 'Updated label',
    });
  });

  it('permet de supprimer un champ via FormFieldEditor', async () => {
    const deleteFieldMock = mockUseFormFields().deleteField.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    const deleteButton = screen.getByText('delete-field');
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(deleteFieldMock).toHaveBeenCalledWith('field1');
  });

  it('permet de naviguer vers les réponses', () => {
    renderWithClient(<FormBuilder />);

    const responsesButton = screen.getByRole('button', { name: /Réponses/i });
    fireEvent.click(responsesButton);

    expect(mockNavigate).toHaveBeenCalledWith('/formulaires/form1/responses');
  });

  it('publie un formulaire brouillon', async () => {
    const toastMock = mockUseToast().toast as unknown as vi.Mock;
    const updateFormMock = mockUseForms().updateForm.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    const publishButton = screen.getByRole('button', { name: /Publier/i });

    await act(async () => {
      fireEvent.click(publishButton);
    });

    expect(updateFormMock).toHaveBeenCalledWith({
      id: 'form1',
      status: 'published',
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Formulaire publié !',
    });
  });

  it('dépublie un formulaire publié et affiche le bouton de copie de lien', async () => {
    mockUseFormDetail.mockReturnValueOnce({
      data: MOCK_FORM_PUBLISHED,
      isLoading: false,
      isError: false,
      error: null,
    });

    const toastMock = mockUseToast().toast as unknown as vi.Mock;
    const updateFormMock = mockUseForms().updateForm.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    expect(screen.getByRole('button', { name: /Lien/i })).toBeInTheDocument();

    const togglePublishButton = screen.getByRole('button', { name: /Dépublier/i });

    await act(async () => {
      fireEvent.click(togglePublishButton);
    });

    expect(updateFormMock).toHaveBeenCalledWith({
      id: 'form1',
      status: 'draft',
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Formulaire dépublié',
    });
  });

  it('copie le lien de formulaire et affiche un toast', async () => {
    mockUseFormDetail.mockReturnValueOnce({
      data: MOCK_FORM_PUBLISHED,
      isLoading: false,
      isError: false,
      error: null,
    });

    const toastMock = mockUseToast().toast as unknown as vi.Mock;
    const writeTextMock = (navigator as any).clipboard.writeText as vi.Mock;

    renderWithClient(<FormBuilder />);

    const copyButton = screen.getByRole('button', { name: /Lien/i });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      'http://localhost/f/formulaire-publie'
    );

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Lien copié !',
    });
  });

  it('affiche le contenu de prévisualisation', () => {
    renderWithClient(<FormBuilder />);

    expect(screen.getByText('Preview: Formulaire brouillon')).toBeInTheDocument();
  });

  it('permet de modifier le message de succès dans les paramètres', async () => {
    const updateFormMock = mockUseForms().updateForm.mutateAsync as unknown as vi.Mock;

    renderWithClient(<FormBuilder />);

    const successTextarea = screen.getByDisplayValue(MOCK_FORM_DRAFT.success_message);
    fireEvent.change(successTextarea, { target: { value: 'Message personnalisé' } });

    await waitFor(() => {
      expect(updateFormMock).toHaveBeenCalledWith({
        id: MOCK_FORM_DRAFT.id,
        success_message: 'Message personnalisé',
      });
    });
  });

  it('gère un état d’erreur de chargement de formulaire', () => {
    mockUseFormDetail.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'Erreur de chargement' },
    });

    renderWithClient(<FormBuilder />);

    expect(screen.getByText('Formulaire introuvable')).toBeInTheDocument();
  });
});