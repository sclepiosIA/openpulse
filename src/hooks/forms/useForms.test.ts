/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useForms,
  useFormDetail,
  useFormBySlug,
  useFormFields,
  useFormResponses,
  useSubmitFormResponse,
} from './useForms';

const {
  AUTH_STATE,
  FORMS_ROWS,
  FORM_DETAIL_ROW,
  FORM_BY_SLUG_ROW,
  FORM_RESPONSES_ROWS,
  CREATED_FORM_ROW,
  UPDATED_FORM_ROW,
  CREATED_FIELD_ROW,
  UPDATED_FIELD_ROW,
  CREATED_RESPONSE_ROW,
  toastFn,
  mockFrom,
  mockUseAuth,
  mockUseToast,
  selectMock,
  insertMock,
  updateMock,
  deleteMock,
  eqMock,
  orderMock,
  singleMock,
  maybeSingleMock,
  thenMock,
  catchMock,
  mockInvalidateQueries,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const FORMS_ROWS = [
    {
      id: 'f1',
      title: 'Form A',
      description: 'Desc A',
      created_by: 'u1',
      etablissement_id: 'e1',
      status: 'draft',
      settings: {},
      slug: 'form-a',
      theme_color: '#111111',
      cover_image_url: null,
      success_message: 'Merci',
      requires_auth: false,
      max_responses: 10,
      closes_at: null,
      created_at: '2024-01-01',
      updated_at: '2024-01-03',
    },
    {
      id: 'f2',
      title: 'Form B',
      description: 'Desc B',
      created_by: 'u1',
      etablissement_id: 'e1',
      status: 'published',
      settings: {},
      slug: 'form-b',
      theme_color: '#222222',
      cover_image_url: null,
      success_message: 'Envoyé',
      requires_auth: true,
      max_responses: 20,
      closes_at: null,
      created_at: '2024-01-02',
      updated_at: '2024-01-04',
    },
  ];

  const FORM_DETAIL_ROW = {
    id: 'f-detail',
    title: 'Detailed Form',
    description: 'Long desc',
    created_by: 'u1',
    etablissement_id: 'e1',
    status: 'draft',
    settings: {},
    slug: 'detailed-form',
    theme_color: '#333333',
    cover_image_url: null,
    success_message: 'Done',
    requires_auth: false,
    max_responses: 5,
    closes_at: null,
    created_at: '2024-02-01',
    updated_at: '2024-02-02',
    form_fields: [
      {
        id: 'field-2',
        form_id: 'f-detail',
        type: 'text',
        label: 'Second',
        description: '',
        placeholder: '',
        required: false,
        options: {},
        validation_rules: {},
        position: 2,
        created_at: '2024-02-01',
      },
      {
        id: 'field-1',
        form_id: 'f-detail',
        type: 'email',
        label: 'First',
        description: '',
        placeholder: '',
        required: true,
        options: {},
        validation_rules: {},
        position: 1,
        created_at: '2024-02-01',
      },
    ],
  };

  const FORM_BY_SLUG_ROW = {
    id: 'f-pub',
    title: 'Public Form',
    description: 'Public desc',
    created_by: 'u1',
    etablissement_id: 'e1',
    status: 'published',
    settings: {},
    slug: 'public-form',
    theme_color: '#444444',
    cover_image_url: null,
    success_message: 'Submitted',
    requires_auth: false,
    max_responses: 100,
    closes_at: null,
    created_at: '2024-03-01',
    updated_at: '2024-03-02',
    form_fields: [
      {
        id: 'field-b',
        form_id: 'f-pub',
        type: 'textarea',
        label: 'B',
        description: '',
        placeholder: '',
        required: false,
        options: {},
        validation_rules: {},
        position: 3,
        created_at: '2024-03-01',
      },
      {
        id: 'field-a',
        form_id: 'f-pub',
        type: 'text',
        label: 'A',
        description: '',
        placeholder: '',
        required: true,
        options: {},
        validation_rules: {},
        position: 1,
        created_at: '2024-03-01',
      },
    ],
  };

  const FORM_RESPONSES_ROWS = [
    {
      id: 'r2',
      form_id: 'f1',
      respondent_user_id: null,
      respondent_email: 'b@t.co',
      respondent_name: 'Bob',
      submitted_at: '2024-04-02',
      form_field_values: [{ id: 'v2', response_id: 'r2', field_id: 'field-1', value: 'B' }],
    },
    {
      id: 'r1',
      form_id: 'f1',
      respondent_user_id: null,
      respondent_email: 'a@t.co',
      respondent_name: 'Alice',
      submitted_at: '2024-04-01',
      form_field_values: [{ id: 'v1', response_id: 'r1', field_id: 'field-1', value: 'A' }],
    },
  ];

  const CREATED_FORM_ROW = {
    id: 'f-new',
    title: 'New Form',
    description: 'Created desc',
    created_by: 'u1',
    etablissement_id: 'e2',
    status: 'draft',
    settings: {},
    slug: 'new-form',
    theme_color: '#555555',
    cover_image_url: null,
    success_message: 'ok',
    requires_auth: false,
    max_responses: null,
    closes_at: null,
    created_at: '2024-05-01',
    updated_at: '2024-05-01',
  };

  const UPDATED_FORM_ROW = {
    id: 'f1',
    title: 'Updated Form',
    description: 'Updated desc',
    created_by: 'u1',
    etablissement_id: 'e1',
    status: 'published',
    settings: {},
    slug: 'form-a',
    theme_color: '#666666',
    cover_image_url: null,
    success_message: 'updated',
    requires_auth: true,
    max_responses: 30,
    closes_at: null,
    created_at: '2024-01-01',
    updated_at: '2024-06-01',
  };

  const CREATED_FIELD_ROW = {
    id: 'ff-new',
    form_id: 'f1',
    type: 'text',
    label: 'Question',
    description: 'Help',
    placeholder: 'Type here',
    required: true,
    options: {},
    validation_rules: {},
    position: 0,
    created_at: '2024-06-01',
  };

  const UPDATED_FIELD_ROW = {
    id: 'ff-1',
    form_id: 'f1',
    type: 'email',
    label: 'Updated question',
    description: 'New help',
    placeholder: 'mail',
    required: false,
    options: {},
    validation_rules: {},
    position: 1,
    created_at: '2024-06-01',
  };

  const CREATED_RESPONSE_ROW = {
    id: 'resp-new',
    form_id: 'f1',
    respondent_user_id: null,
    respondent_email: 'person@t.co',
    respondent_name: 'Person',
    submitted_at: '2024-07-01',
  };

  const toastFn = vi.fn();
  const mockUseAuth = vi.fn(() => AUTH_STATE);
  const mockUseToast = vi.fn(() => ({ toast: toastFn }));
  const mockFrom = vi.fn();

  const selectMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const deleteMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();
  const singleMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const thenMock = vi.fn();
  const catchMock = vi.fn();
  const mockInvalidateQueries = vi.fn();

  return {
    AUTH_STATE,
    FORMS_ROWS,
    FORM_DETAIL_ROW,
    FORM_BY_SLUG_ROW,
    FORM_RESPONSES_ROWS,
    CREATED_FORM_ROW,
    UPDATED_FORM_ROW,
    CREATED_FIELD_ROW,
    UPDATED_FIELD_ROW,
    CREATED_RESPONSE_ROW,
    toastFn,
    mockFrom,
    mockUseAuth,
    mockUseToast,
    selectMock,
    insertMock,
    updateMock,
    deleteMock,
    eqMock,
    orderMock,
    singleMock,
    maybeSingleMock,
    thenMock,
    catchMock,
    mockInvalidateQueries,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mockUseToast,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenable(result: { data: unknown; error: { message: string } | null }) {
  return {
    then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve(onFulfilled(result)),
    catch: () => Promise.resolve(result),
  };
}

function setupSupabaseSuccess() {
  mockFrom.mockImplementation((table: string) => {
    const state: {
      table: string;
      filters: Array<{ column: string; value: unknown }>;
      inserted?: unknown;
      updated?: unknown;
      deleted?: boolean;
      selected?: string;
      ordered?: { column: string; options?: unknown };
    } = {
      table,
      filters: [],
    };

    const builder = {
      select: selectMock.mockImplementation((selection?: string) => {
        state.selected = selection;
        return builder;
      }),
      insert: insertMock.mockImplementation((payload: unknown) => {
        state.inserted = payload;
        return builder;
      }),
      update: updateMock.mockImplementation((payload: unknown) => {
        state.updated = payload;
        return builder;
      }),
      delete: deleteMock.mockImplementation(() => {
        state.deleted = true;
        return builder;
      }),
      eq: eqMock.mockImplementation((column: string, value: unknown) => {
        state.filters.push({ column, value });
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      order: orderMock.mockImplementation((column: string, options?: unknown) => {
        state.ordered = { column, options };
        return builder;
      }),
      single: singleMock.mockImplementation(async () => {
        if (table === 'forms' && state.inserted) return { data: CREATED_FORM_ROW, error: null };
        if (table === 'forms' && state.updated) return { data: UPDATED_FORM_ROW, error: null };
        if (table === 'form_fields' && state.inserted) return { data: CREATED_FIELD_ROW, error: null };
        if (table === 'form_fields' && state.updated) return { data: UPDATED_FIELD_ROW, error: null };
        if (table === 'form_responses' && state.inserted) return { data: CREATED_RESPONSE_ROW, error: null };
        return { data: null, error: null };
      }),
      maybeSingle: maybeSingleMock.mockImplementation(async () => {
        if (table === 'forms') {
          const slugFilter = state.filters.find((f) => f.column === 'slug');
          const idFilter = state.filters.find((f) => f.column === 'id');
          if (slugFilter) return { data: FORM_BY_SLUG_ROW, error: null };
          if (idFilter) return { data: FORM_DETAIL_ROW, error: null };
        }
        return { data: null, error: null };
      }),
      then: thenMock.mockImplementation((onFulfilled: (value: { data: unknown; error: null }) => unknown) => {
        let result: { data: unknown; error: null } = { data: null, error: null };
        if (table === 'forms' && state.selected?.includes('id, title')) {
          result = { data: FORMS_ROWS, error: null };
        } else if (table === 'form_responses') {
          result = { data: FORM_RESPONSES_ROWS, error: null };
        } else if (table === 'form_field_values' && state.inserted) {
          result = { data: null, error: null };
        } else if (table === 'forms' && state.deleted) {
          result = { data: null, error: null };
        } else if (table === 'form_fields' && state.deleted) {
          result = { data: null, error: null };
        } else if (table === 'form_fields' && state.updated && !state.selected) {
          result = { data: null, error: null };
        }
        return Promise.resolve(onFulfilled(result));
      }),
      catch: catchMock.mockImplementation(() => Promise.resolve({ data: null, error: null })),
    };

    return builder;
  });
}

function setupSupabaseError(message: string) {
  mockFrom.mockImplementation((table: string) => {
    const state: {
      table: string;
      inserted?: unknown;
      updated?: unknown;
      deleted?: boolean;
    } = { table };

    const errorResult = { data: null, error: { message } };

    const builder = {
      select: selectMock.mockImplementation(() => builder),
      insert: insertMock.mockImplementation((payload: unknown) => {
        state.inserted = payload;
        return builder;
      }),
      update: updateMock.mockImplementation((payload: unknown) => {
        state.updated = payload;
        return builder;
      }),
      delete: deleteMock.mockImplementation(() => {
        state.deleted = true;
        return builder;
      }),
      eq: eqMock.mockImplementation(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      order: orderMock.mockImplementation(() => builder),
      single: singleMock.mockImplementation(async () => errorResult),
      maybeSingle: maybeSingleMock.mockImplementation(async () => errorResult),
      then: thenMock.mockImplementation((onFulfilled: (value: { data: null; error: { message: string } }) => unknown) =>
        Promise.resolve(onFulfilled(errorResult))
      ),
      catch: catchMock.mockImplementation(() => Promise.resolve(errorResult)),
    };

    return builder;
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries);

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSupabaseSuccess();
});

describe('useForms', () => {
  it('charge les formulaires de l’utilisateur puis expose les données métier', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useForms(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.forms).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFrom).toHaveBeenCalledWith('forms');
    expect(eqMock).toHaveBeenCalledWith('created_by', 'u1');
    expect(orderMock).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(result.current.isError).toBe(false);
    expect(result.current.forms).toHaveLength(2);
    expect(result.current.forms[0].title).toBe('Form A');
    expect(result.current.forms[1].status).toBe('published');
  });

  it('passe en erreur si la récupération échoue', async () => {
    setupSupabaseError('x');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useForms(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.forms).toEqual([]);
  });

  it('crée un formulaire, invalide le cache et affiche un toast', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useForms(), { wrapper });

    await act(async () => {
      await result.current.createForm.mutateAsync({
        title: 'New Form',
        description: 'Created desc',
        etablissement_id: 'e2',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('forms');
    expect(insertMock).toHaveBeenCalledWith({
      title: 'New Form',
      description: 'Created desc',
      etablissement_id: 'e2',
      created_by: 'u1',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['forms'] });
    expect(toastFn).toHaveBeenCalledWith({ title: 'Formulaire créé' });
  });

  it('gère l’erreur de création avec un toast destructif', async () => {
    setupSupabaseError('x');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useForms(), { wrapper });

    await expect(
      result.current.createForm.mutateAsync({
        title: 'Broken',
        description: 'Nope',
        etablissement_id: 'e2',
      })
    ).rejects.toEqual({ message: 'x' });

    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de créer le formulaire',
      variant: 'destructive',
    });
  });

  it('met à jour un formulaire et invalide le cache', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useForms(), { wrapper });

    await act(async () => {
      await result.current.updateForm.mutateAsync({
        id: 'f1',
        title: 'Updated Form',
        status: 'published',
      });
    });

    expect(updateMock).toHaveBeenCalledWith({
      title: 'Updated Form',
      status: 'published',
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'f1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['forms'] });
  });

  it('supprime un formulaire et affiche le toast de succès', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useForms(), { wrapper });

    await act(async () => {
      await result.current.deleteForm.mutateAsync('f1');
    });

    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith('id', 'f1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['forms'] });
    expect(toastFn).toHaveBeenCalledWith({ title: 'Formulaire supprimé' });
  });
});

describe('useFormDetail', () => {
  it('charge un formulaire détaillé et trie les champs par position', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormDetail('f-detail'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('forms');
    expect(result.current.data?.id).toBe('f-detail');
    expect(result.current.data?.form_fields.map((f) => f.id)).toEqual(['field-1', 'field-2']);
  });

  it('passe en erreur si la récupération détaillée échoue', async () => {
    setupSupabaseError('x');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormDetail('f-detail'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useFormBySlug', () => {
  it('charge un formulaire publié par slug et trie ses champs', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormBySlug('public-form'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eqMock).toHaveBeenCalledWith('slug', 'public-form');
    expect(eqMock).toHaveBeenCalledWith('status', 'published');
    expect(result.current.data?.title).toBe('Public Form');
    expect(result.current.data?.form_fields.map((f) => f.id)).toEqual(['field-a', 'field-b']);
  });

  it('passe en erreur si la récupération par slug échoue', async () => {
    setupSupabaseError('x');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormBySlug('public-form'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useFormFields', () => {
  it('ajoute un champ et invalide le détail du formulaire', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormFields('f1'), { wrapper });

    await act(async () => {
      await result.current.addField.mutateAsync({
        form_id: 'f1',
        type: 'text',
        label: 'Question',
        required: true,
        options: {},
        validation_rules: {},
        position: 0,
        description: 'Help',
        placeholder: 'Type here',
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('form_fields');
    expect(insertMock).toHaveBeenCalledWith({
      form_id: 'f1',
      type: 'text',
      label: 'Question',
      required: true,
      options: {},
      validation_rules: {},
      position: 0,
      description: 'Help',
      placeholder: 'Type here',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['form', 'f1'] });
  });

  it('met à jour un champ et invalide le détail du formulaire', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormFields('f1'), { wrapper });

    await act(async () => {
      await result.current.updateField.mutateAsync({
        id: 'ff-1',
        label: 'Updated question',
        required: false,
      });
    });

    expect(updateMock).toHaveBeenCalledWith({
      label: 'Updated question',
      required: false,
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'ff-1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['form', 'f1'] });
  });

  it('supprime un champ et invalide le détail du formulaire', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormFields('f1'), { wrapper });

    await act(async () => {
      await result.current.deleteField.mutateAsync('ff-1');
    });

    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith('id', 'ff-1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['form', 'f1'] });
  });

  it('réordonne les champs en envoyant les bonnes positions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormFields('f1'), { wrapper });

    await act(async () => {
      await result.current.reorderFields.mutateAsync(['ff-9', 'ff-3', 'ff-1']);
    });

    expect(updateMock).toHaveBeenCalledWith({ position: 0 });
    expect(updateMock).toHaveBeenCalledWith({ position: 1 });
    expect(updateMock).toHaveBeenCalledWith({ position: 2 });
    expect(eqMock).toHaveBeenCalledWith('id', 'ff-9');
    expect(eqMock).toHaveBeenCalledWith('id', 'ff-3');
    expect(eqMock).toHaveBeenCalledWith('id', 'ff-1');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['form', 'f1'] });
  });
});

describe('useFormResponses', () => {
  it('charge les réponses d’un formulaire dans l’ordre attendu', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormResponses('f1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('form_responses');
    expect(eqMock).toHaveBeenCalledWith('form_id', 'f1');
    expect(orderMock).toHaveBeenCalledWith('submitted_at', { ascending: false });
    expect(result.current.data?.[0].respondent_name).toBe('Bob');
    expect(result.current.data?.[1].form_field_values[0].value).toBe('A');
  });

  it('passe en erreur si la récupération des réponses échoue', async () => {
    setupSupabaseError('x');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFormResponses('f1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSubmitFormResponse', () => {
  it('soumet une réponse et insère les valeurs de champs associées', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitFormResponse(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        form_id: 'f1',
        respondent_email: 'person@t.co',
        respondent_name: 'Person',
        values: [
          { field_id: 'field-1', value: 'John' },
          { field_id: 'field-2', value: 'john@t.co' },
        ],
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('form_responses');
    expect(insertMock).toHaveBeenCalledWith({
      form_id: 'f1',
      respondent_email: 'person@t.co',
      respondent_name: 'Person',
    });
    expect(mockFrom).toHaveBeenCalledWith('form_field_values');
    expect(insertMock).toHaveBeenCalledWith([
      { response_id: 'resp-new', field_id: 'field-1', value: 'John' },
      { response_id: 'resp-new', field_id: 'field-2', value: 'john@t.co' },
    ]);
  });

  it('remonte une erreur si la soumission échoue', async () => {
    setupSupabaseError('x');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubmitFormResponse(), { wrapper });

    await expect(
      result.current.mutateAsync({
        form_id: 'f1',
        respondent_email: 'person@t.co',
        respondent_name: 'Person',
        values: [{ field_id: 'field-1', value: 'John' }],
      })
    ).rejects.toEqual({ message: 'x' });
  });
});