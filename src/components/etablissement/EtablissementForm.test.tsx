import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm, type FieldValues, type UseFormReturn, Controller } from 'react-hook-form'
import { EtablissementForm } from './EtablissementForm'

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockLogoUploadField,
  mockPalliersSection,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockLogoUploadField: vi.fn(),
  mockPalliersSection: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: { checked?: boolean; onCheckedChange?: (v: boolean) => void }) => (
    <input
      type="checkbox"
      aria-label={String(props['aria-label'] ?? 'checkbox')}
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormField: ({
    control,
    name,
    render,
  }: {
    control: UseFormReturn<FieldValues>['control']
    name: string
    render: (props: { field: { name: string; value: unknown; onChange: (v: unknown) => void; onBlur: () => void } }) => React.ReactNode
  }) => <Controller control={control} name={name} render={({ field }) => <>{render({ field })}</>} />,
  FormItem: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  FormLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
  FormMessage: () => null,
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input ref={ref} {...props} />),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) => <textarea ref={ref} {...props} />),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    type = 'button',
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    type?: 'button' | 'submit' | 'reset'
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => {
    const items: Array<{ value: string; label: string }> = []
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return
      if ((child.type as { displayName?: string }).displayName === 'SelectContent') {
        React.Children.forEach(child.props.children as React.ReactNode, (itemChild) => {
          if (!React.isValidElement(itemChild)) return
          if ((itemChild.type as { displayName?: string }).displayName === 'SelectItem') {
            items.push({ value: String(itemChild.props.value), label: String(itemChild.props.children) })
          }
        })
      }
    })

    return (
      <select
        data-testid="select"
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">--</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    )
  },
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <>{children}</>,
}))

;(Object.assign((await import('@/components/ui/select')).SelectContent, { displayName: 'SelectContent' }))
;(Object.assign((await import('@/components/ui/select')).SelectItem, { displayName: 'SelectItem' }))

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
}))

vi.mock('@/components/ui/LogoUploadField', () => ({
  LogoUploadField: ({
    currentLogoUrl,
    onLogoUploaded,
  }: {
    currentLogoUrl?: string
    entityType: string
    onLogoUploaded: (url?: string) => void
    size: string
  }) => {
    mockLogoUploadField(currentLogoUrl)
    return (
      <div>
        <div data-testid="logo-current">{currentLogoUrl ?? ''}</div>
        <button type="button" onClick={() => onLogoUploaded('https://img.local/logo.png')}>
          Upload logo
        </button>
      </div>
    )
  },
}))

vi.mock('./EtablissementFormPalliersSection', () => ({
  EtablissementFormPalliersSection: () => {
    mockPalliersSection()
    return <div data-testid="palliers-section">Palliers</div>
  },
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
}

function TestHarness({
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
  allProfiles,
  defaultValues,
  validator,
}: {
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  submitLabel: string
  isLoading: boolean
  allProfiles?: Array<{ id: string; prenom: string; nom: string; role: string }>
  defaultValues?: Record<string, unknown>
  validator?: (values: Record<string, unknown>) => Record<string, { type: string; message: string }>
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: {
      nom: '',
      type: '',
      ville: '',
      region: '',
      pays: '',
      adresse: '',
      code_postal: '',
      telephone: '',
      email: '',
      nombre_passages_urgences_annuel: undefined,
      dpi: '',
      dpi_portail: 'hm',
      directeur_general_prenom: '',
      directeur_general_nom: '',
      directeur_general_email: '',
      siren_client: '',
      logo_url: '',
      date_prise_contact: '',
      ...defaultValues,
    },
    mode: 'onSubmit',
    resolver: validator
      ? async (values) => ({
          values,
          errors: validator(values),
        })
      : undefined,
  })

  return (
    <EtablissementForm
      form={form}
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitLabel={submitLabel}
      isLoading={isLoading}
      allProfiles={allProfiles}
    />
  )
}

describe('EtablissementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche les champs principaux, les valeurs par défaut et permet de modifier les valeurs métier', async () => {
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()

    render(
      <Wrapper>
        <TestHarness
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitLabel="Créer"
          isLoading={false}
          defaultValues={{
            nom: 'Clinique Saint Pierre',
            ville: 'Lyon',
            region: 'Auvergne-Rhône-Alpes',
            dpi_portail: 'hm',
            logo_url: '',
          }}
        />
      </Wrapper>,
    )

    expect(screen.getByText(/Les champs marqués d'un/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Clinique Saint Pierre')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lyon')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Auvergne-Rhône-Alpes')).toBeInTheDocument()
    expect(screen.getByText(/Détermine la plateforme de formation/i)).toBeInTheDocument()
    expect(screen.getByTestId('logo-current')).toHaveTextContent('')

    const textInputs = screen.getAllByRole('textbox')
    fireEvent.change(textInputs[0], { target: { value: 'CHU de Nice' } })
    fireEvent.change(textInputs[1], { target: { value: 'Nice' } })
    fireEvent.change(textInputs[2], { target: { value: "Provence-Alpes-Côte d'Azur" } })

    const selects = screen.getAllByTestId('select')
    fireEvent.change(selects[0], { target: { value: 'CHU' } })
    fireEvent.change(selects[1], { target: { value: 'ORBIS' } })
    fireEvent.change(selects[2], { target: { value: 'resurgences' } })

    const numberInput = screen.getByPlaceholderText('Nombre de passages')
    fireEvent.change(numberInput, { target: { value: '42000' } })

    fireEvent.click(screen.getByRole('button', { name: /Upload logo/i }))
    expect(screen.getByTestId('logo-current')).toHaveTextContent('https://img.local/logo.png')

    const formEl = document.querySelector('form')
    if (!formEl) throw new Error('form not found')
    fireEvent.submit(formEl)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0][0] as Record<string, unknown>
    expect(submitted.nom).toBe('CHU de Nice')
    expect(submitted.ville).toBe('Nice')
    expect(submitted.region).toBe("Provence-Alpes-Côte d'Azur")
    expect(submitted.type).toBe('CHU')
    expect(submitted.dpi).toBe('ORBIS')
    expect(submitted.dpi_portail).toBe('resurgences')
    expect(submitted.nombre_passages_urgences_annuel).toBe(42000)
    expect(submitted.logo_url).toBe('https://img.local/logo.png')
  })

  it('affiche un état de chargement via le bouton de soumission désactivé', () => {
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()

    render(
      <Wrapper>
        <TestHarness onSubmit={onSubmit} onCancel={onCancel} submitLabel="Enregistrer" isLoading={true} />
      </Wrapper>,
    )

    const submitButton = screen.getByRole('button', { name: /Enregistrer/i })
    expect(submitButton).toBeDisabled()
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
  })

  it('affiche le résumé des erreurs et les messages métier en cas de validation en erreur', async () => {
    const onSubmit = vi.fn(async () => {})
    const onCancel = vi.fn()

    render(
      <Wrapper>
        <TestHarness
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitLabel="Créer"
          isLoading={false}
          validator={() => ({
            nom: { type: 'required', message: "Le nom de l'établissement est obligatoire" },
            ville: { type: 'required', message: 'La ville est obligatoire' },
            region: { type: 'required', message: 'La région est obligatoire' },
            type: { type: 'required', message: 'Le type est obligatoire' },
            date_prise_contact: { type: 'required', message: 'La date de prise de contact est obligatoire' },
            email: { type: 'pattern', message: 'Email invalide' },
            directeur_general_email: { type: 'pattern', message: 'Email du directeur invalide' },
          })}
        />
      </Wrapper>,
    )

    const formEl = document.querySelector('form')
    if (!formEl) throw new Error('form not found')
    fireEvent.submit(formEl)

    expect(await screen.findByText(/Veuillez corriger les erreurs suivantes/i)).toBeInTheDocument()
    expect(screen.getByText("Le nom de l'établissement est obligatoire")).toBeInTheDocument()
    expect(screen.getByText('La ville est obligatoire')).toBeInTheDocument()
    expect(screen.getByText('La région est obligatoire')).toBeInTheDocument()
    expect(screen.getByText('Le type est obligatoire')).toBeInTheDocument()
    expect(screen.getByText('La date de prise de contact est obligatoire')).toBeInTheDocument()
    expect(screen.getByText('Email invalide')).toBeInTheDocument()
    expect(screen.getByText('Email du directeur invalide')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})