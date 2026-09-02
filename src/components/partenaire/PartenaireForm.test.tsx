import React from 'react'
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { PartenaireForm } from './PartenaireForm'

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  PROFILES,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockFrom: vi.fn(() => {
    const builder: any = {
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }),
  PROFILES: [
    { id: 'c1', prenom: 'Claire', nom: 'Martin', role: 'commercial' },
    { id: 'm1', prenom: 'Marc', nom: 'Durand', role: 'manager' },
    { id: 'a1', prenom: 'Alice', nom: 'Bernard', role: 'admin' },
    { id: 'x1', prenom: 'Nina', nom: 'Petit', role: 'stagiaire' },
  ],
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/ui/form', () => {
  const ReactLocal = React
  return {
    Form: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => null,
    FormField: ({
      name,
      render,
      control,
    }: {
      name: string
      render: (props: {
        field: {
          name: string
          value: unknown
          onChange: (value: unknown) => void
          onBlur: () => void
          ref: React.Ref<HTMLElement>
        }
      }) => React.ReactNode
      control: any
    }) => {
      const { Controller } = require('react-hook-form') as typeof import('react-hook-form')
      return <Controller control={control} name={name} render={render} />
    },
  }
})

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input ref={ref} {...props} />
  )),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) => (
    <textarea ref={ref} {...props} />
  )),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/LogoUploadField', () => ({
  LogoUploadField: ({
    currentLogoUrl,
    onLogoUploaded,
  }: {
    currentLogoUrl?: string
    entityType: string
    onLogoUploaded: (url?: string) => void
    size?: string
  }) => (
    <div>
      <span data-testid="logo-current">{currentLogoUrl || ''}</span>
      <button type="button" onClick={() => onLogoUploaded('https://cdn.test/logo.png')}>
        Upload logo
      </button>
    </div>
  ),
}))

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
  }: {
    min?: number
    max?: number
    step?: number
    value?: number[]
    onValueChange?: (vals: number[]) => void
    className?: string
  }) => (
    <input
      aria-label="slider-engagement"
      type="range"
      min={0}
      max={100}
      step={5}
      value={value?.[0] ?? 0}
      onChange={(e) => onValueChange?.([Number((e.target as HTMLInputElement).value)])}
    />
  ),
}))

vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
  }>({})

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    required?: boolean
  }) => <SelectContext.Provider value={{ value, onValueChange }}>{children}</SelectContext.Provider>

  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const ctx = React.useContext(SelectContext)
    return (
      <button type="button" onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
    )
  }

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

type CreatePartenaireData = {
  logo_url?: string
  nom: string
  type_partenaire: string
  sous_type?: string
  adresse?: string
  code_postal?: string
  ville?: string
  region?: string
  telephone?: string
  email?: string
  site_web?: string
  statut_relation?: string
  responsable_marque_id?: string
  date_debut_partenariat?: string
  date_fin_partenariat?: string
  dernier_contact?: string
  prochaine_action?: string
  valeur_partenariat?: number
  engagement_score?: number
  notes?: string
}

function setupForm(defaultValues?: Partial<CreatePartenaireData>) {
  const wrapper = createWrapper()
  const { result } = renderHook(
    () =>
      useForm<CreatePartenaireData>({
        defaultValues: {
          logo_url: '',
          nom: '',
          type_partenaire: '',
          sous_type: '',
          adresse: '',
          code_postal: '',
          ville: '',
          region: '',
          telephone: '',
          email: '',
          site_web: '',
          statut_relation: 'prospect',
          responsable_marque_id: '',
          date_debut_partenariat: '',
          date_fin_partenariat: '',
          dernier_contact: '',
          prochaine_action: '',
          valeur_partenariat: undefined,
          engagement_score: 0,
          notes: '',
          ...defaultValues,
        },
      }),
    { wrapper }
  )

  return { form: result.current, wrapper }
}

describe('PartenaireForm', () => {
  it('affiche les champs métier, filtre les responsables et soumet les valeurs réelles du formulaire', async () => {
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()
    const { form } = setupForm()

    render(
      <PartenaireForm
        form={form}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel="Créer le partenaire"
        isLoading={false}
        allProfiles={PROFILES}
      />
    )

    expect(screen.getByText('Informations générales')).toBeInTheDocument()
    expect(screen.getByText('Coordonnées')).toBeInTheDocument()
    expect(screen.getByText('Relation partenariale')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Upload logo' }))
    expect(screen.getByTestId('logo-current')).toHaveTextContent('https://cdn.test/logo.png')

    fireEvent.change(screen.getByPlaceholderText('Nom du partenaire'), { target: { value: 'Hopital Central' } })
    fireEvent.click(screen.getByRole('button', { name: 'Institutionnel' }))

    fireEvent.change(screen.getByPlaceholderText('Ex: ARS, Fournisseur logiciel, Consultant...'), {
      target: { value: 'ARS' },
    })
    fireEvent.change(screen.getByPlaceholderText('Adresse complète'), {
      target: { value: '10 rue de Paris' },
    })
    fireEvent.change(screen.getByPlaceholderText('Code postal'), {
      target: { value: '75001' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ville'), {
      target: { value: 'Paris' },
    })
    fireEvent.change(screen.getByPlaceholderText('Région'), {
      target: { value: 'Île-de-France' },
    })
    fireEvent.change(screen.getByPlaceholderText('Téléphone'), {
      target: { value: '0102030405' },
    })
    fireEvent.change(screen.getByPlaceholderText('Email principal'), {
      target: { value: 'contact@hopital.test' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://...'), {
      target: { value: 'https://hopital.test' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Actif' }))
    expect(screen.getByRole('button', { name: /Claire Martin \(commercial\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marc Durand \(manager\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Alice Bernard \(admin\)/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nina Petit \(stagiaire\)/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Marc Durand \(manager\)/ }))
    fireEvent.change(screen.getByLabelText('slider-engagement'), { target: { value: '75' } })

    const dateInputs = screen.getAllByDisplayValue('')
      .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'date')
    // ensure we have four date inputs as in the form
    expect(dateInputs.length).toBeGreaterThanOrEqual(4)
    fireEvent.change(dateInputs[0], { target: { value: '2024-01-15' } })
    fireEvent.change(dateInputs[1], { target: { value: '2024-12-31' } })
    fireEvent.change(dateInputs[2], { target: { value: '2024-02-01' } })
    fireEvent.change(dateInputs[3], { target: { value: '2024-03-01' } })

    fireEvent.change(screen.getByPlaceholderText('Valeur estimée en euros'), {
      target: { value: '12000' },
    })
    fireEvent.change(screen.getByPlaceholderText('Notes internes sur le partenaire...'), {
      target: { value: 'Partenaire prioritaire pour la région nord.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Créer le partenaire' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_url: 'https://cdn.test/logo.png',
        nom: 'Hopital Central',
        type_partenaire: 'institutionnel',
        sous_type: 'ARS',
        adresse: '10 rue de Paris',
        code_postal: '75001',
        ville: 'Paris',
        region: 'Île-de-France',
        telephone: '0102030405',
        email: 'contact@hopital.test',
        site_web: 'https://hopital.test',
        statut_relation: 'actif',
        responsable_marque_id: 'm1',
        date_debut_partenariat: '2024-01-15',
        date_fin_partenariat: '2024-12-31',
        dernier_contact: '2024-02-01',
        prochaine_action: '2024-03-01',
        valeur_partenariat: 12000,
        engagement_score: 75,
        notes: 'Partenaire prioritaire pour la région nord.',
      }),
      expect.anything()
    )
  })

  it('désactive les actions et affiche l’état de chargement', () => {
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()
    const { form } = setupForm()

    render(
      <PartenaireForm
        form={form}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel="Enregistrer"
        isLoading={true}
        allProfiles={PROFILES}
      />
    )

    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('appelle onCancel quand on clique sur Annuler', () => {
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()
    const { form } = setupForm()

    render(
      <PartenaireForm
        form={form}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel="Créer"
        isLoading={false}
        allProfiles={PROFILES}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('propage une erreur de soumission du callback asynchrone', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn(async () => {
      throw new Error('x')
    })
    const { form } = setupForm({
      nom: 'Clinique Sud',
      type_partenaire: 'prestataire',
    })

    render(
      <PartenaireForm
        form={form}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel="Créer"
        isLoading={false}
        allProfiles={PROFILES}
      />
    )

    // Trigger the submission via react-hook-form's handleSubmit inside act and await the rejection
    await act(async () => {
      await expect(form.handleSubmit(onSubmit)()).rejects.toThrow('x')
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})