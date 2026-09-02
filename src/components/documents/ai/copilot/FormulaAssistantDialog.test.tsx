import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  MouseEventHandler,
  ReactNode,
  SVGProps,
  TextareaHTMLAttributes,
} from 'react'

const {
  mockFrom,
  mockInvoke,
  mockToastSuccess,
  mockToastError,
  mockClipboardWriteText,
  SUCCESS_RESULT,
  EXPLAIN_RESULT,
  ERROR_RESPONSE,
} = vi.hoisted(() => {
  type QueryRow = { id: string; name: string }
  type QueryResponse = { data: QueryRow[]; error: null }
  type SingleResponse = { data: QueryRow; error: null }
  type MaybeSingleResponse = { data: QueryRow | null; error: null }

  interface SupabaseBuilder {
    select: (...args: unknown[]) => SupabaseBuilder
    eq: (...args: unknown[]) => SupabaseBuilder
    neq: (...args: unknown[]) => SupabaseBuilder
    gte: (...args: unknown[]) => SupabaseBuilder
    lte: (...args: unknown[]) => SupabaseBuilder
    gt: (...args: unknown[]) => SupabaseBuilder
    lt: (...args: unknown[]) => SupabaseBuilder
    in: (...args: unknown[]) => SupabaseBuilder
    order: (...args: unknown[]) => SupabaseBuilder
    limit: (...args: unknown[]) => SupabaseBuilder
    range: (...args: unknown[]) => SupabaseBuilder
    insert: (...args: unknown[]) => SupabaseBuilder
    update: (...args: unknown[]) => SupabaseBuilder
    upsert: (...args: unknown[]) => SupabaseBuilder
    delete: (...args: unknown[]) => SupabaseBuilder
    single: (...args: unknown[]) => Promise<SingleResponse>
    maybeSingle: (...args: unknown[]) => Promise<MaybeSingleResponse>
    then: <TResult1 = QueryResponse, TResult2 = never>(
      onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) => Promise<QueryResponse | TResult>
  }

  const ROWS: QueryRow[] = [{ id: '1', name: 'Ligne stable' }]
  const QUERY_RESPONSE: QueryResponse = { data: ROWS, error: null }

  const builder = {} as SupabaseBuilder
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.neq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.gt = vi.fn(() => builder)
  builder.lt = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.range = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.upsert = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }))
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }))
  builder.then = vi.fn((onfulfilled, onrejected) =>
    Promise.resolve(QUERY_RESPONSE).then(onfulfilled, onrejected)
  )
  builder.catch = vi.fn((onrejected) => Promise.resolve(QUERY_RESPONSE).catch(onrejected))

  return {
    mockFrom: vi.fn(() => builder),
    mockInvoke: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockClipboardWriteText: vi.fn(() => Promise.resolve()),
    SUCCESS_RESULT: {
      formula: '=SOMME.SI(A:A;"Payé";B:B)',
      explanation: 'Additionne les montants dont le statut est Payé.',
      examples: ['A2 = Payé et B2 = 25 → ajoute 25'],
    },
    EXPLAIN_RESULT: {
      explanation: 'La formule additionne les cellules de B2 à B10.',
      examples: ['B2=4 et B3=6 → résultat 10'],
    },
    ERROR_RESPONSE: {
      data: null,
      error: { message: 'panne IA' },
    },
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('lucide-react', async () => {
  const React = await import('react')

  const makeIcon =
    (testId: string) =>
    ({ children, ...props }: SVGProps<SVGSVGElement>) =>
      React.createElement('svg', { ...props, 'data-testid': testId }, children)

  return {
    Sparkles: makeIcon('icon-sparkles'),
    Loader2: makeIcon('icon-loader2'),
    Copy: makeIcon('icon-copy'),
    Check: makeIcon('icon-check'),
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')

  type DialogProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }

  type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode }

  const Dialog = ({ open, children }: DialogProps) =>
    open ? React.createElement('div', { 'data-testid': 'dialog' }, children) : null

  const DialogContent = ({ children, ...props }: DivProps) =>
    React.createElement('div', { ...props, role: 'dialog' }, children)

  const DialogHeader = ({ children, ...props }: DivProps) =>
    React.createElement('div', props, children)

  const DialogFooter = ({ children, ...props }: DivProps) =>
    React.createElement('div', props, children)

  const DialogTitle = ({ children, ...props }: DivProps) =>
    React.createElement('h2', props, children)

  const DialogDescription = ({ children, ...props }: DivProps) =>
    React.createElement('p', props, children)

  return {
    Dialog,
    DialogPortal: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    DialogOverlay: ({ children, ...props }: DivProps) =>
      React.createElement('div', props, children),
    DialogClose: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
      React.createElement('button', { type: 'button', ...props }, children),
    DialogTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
      React.createElement('button', { type: 'button', ...props }, children),
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    asChild?: boolean
    children?: ReactNode
  }

  const Button = ({
    variant: _variant,
    size: _size,
    asChild: _asChild,
    type,
    children,
    ...props
  }: ButtonProps) => React.createElement('button', { type: type ?? 'button', ...props }, children)

  return {
    Button,
    buttonVariants: vi.fn(() => ''),
  }
})

vi.mock('@/components/ui/label', async () => {
  const React = await import('react')

  const Label = ({
    children,
    ...props
  }: LabelHTMLAttributes<HTMLLabelElement> & { children?: ReactNode }) =>
    React.createElement('label', props, children)

  return { Label }
})

vi.mock('@/components/ui/textarea', async () => {
  const React = await import('react')

  const Textarea = ({ children, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    React.createElement('textarea', props, children)

  return { Textarea }
})

vi.mock('@/components/ui/input', async () => {
  const React = await import('react')

  const Input = (props: InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement('input', props)

  return { Input }
})

vi.mock('@/components/ui/tabs', async () => {
  const React = await import('react')

  type TabsContextValue = {
    value: string
    setValue: (value: string) => void
  }

  type TabsProps = {
    value: string
    onValueChange?: (value: string) => void
    children?: ReactNode
  }

  type TabsTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> & {
    value: string
    children?: ReactNode
  }

  type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
    value: string
    children?: ReactNode
  }

  const TabsContext = React.createContext<TabsContextValue | null>(null)

  const Tabs = ({ value, onValueChange, children }: TabsProps) =>
    React.createElement(
      TabsContext.Provider,
      { value: { value, setValue: onValueChange ?? (() => undefined) } },
      React.createElement('div', { 'data-testid': 'tabs' }, children)
    )

  const TabsList = ({
    children,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
    React.createElement('div', { role: 'tablist', ...props }, children)

  const TabsTrigger = ({ value, children, onClick, ...props }: TabsTriggerProps) => {
    const contextValue = React.useContext(TabsContext)
    const selected = contextValue?.value === value
    const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event)
      if (!event.defaultPrevented) {
        contextValue?.setValue(value)
      }
    }

    return React.createElement(
      'button',
      {
        type: 'button',
        role: 'tab',
        'aria-selected': selected,
        ...props,
        onClick: handleClick,
      },
      children
    )
  }

  const TabsContent = ({ value, children, ...props }: TabsContentProps) => {
    const contextValue = React.useContext(TabsContext)
    if (contextValue?.value !== value) return null
    return React.createElement('div', props, children)
  }

  return {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
  }
})

import { FormulaAssistantDialog } from './FormulaAssistantDialog'

function createDeferred<T>() {
  let resolveDeferred: ((value: T | PromiseLike<T>) => void) | undefined
  let rejectDeferred: ((reason?: unknown) => void) | undefined

  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return {
    promise,
    resolve(value: T) {
      if (resolveDeferred) resolveDeferred(value)
    },
    reject(reason: unknown) {
      if (rejectDeferred) rejectDeferred(reason)
    },
  }
}

describe('FormulaAssistantDialog', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockClipboardWriteText.mockClear()

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mockClipboardWriteText,
      },
    })
  })

  it('affiche le mode génération initial et ferme la boîte de dialogue', () => {
    const onOpenChange = vi.fn()

    render(<FormulaAssistantDialog open={true} onOpenChange={onOpenChange} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Assistant formules IA')).toBeInTheDocument()
    expect(
      screen.getByText('Générez, expliquez ou corrigez une formule tableur en langage naturel.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Décrivez ce que la formule doit faire')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("passe par l'état de chargement, affiche le résultat, copie puis insère la formule générée", async () => {
    const deferred = createDeferred<{ data: typeof SUCCESS_RESULT; error: null }>()
    mockInvoke.mockReturnValueOnce(deferred.promise)

    const onOpenChange = vi.fn()
    const onApplyFormula = vi.fn()

    render(
      <FormulaAssistantDialog
        open={true}
        onOpenChange={onOpenChange}
        onApplyFormula={onApplyFormula}
        headers={['Statut', 'Montant']}
        sampleRows={[['Payé', 25]]}
        documentId="doc-1"
      />
    )

    fireEvent.change(screen.getByLabelText('Décrivez ce que la formule doit faire'), {
      target: { value: 'additionner les montants payés' },
    })

    const launchButton = screen.getByRole('button', { name: 'Lancer' })
    expect(launchButton).toBeEnabled()

    fireEvent.click(launchButton)

    expect(mockInvoke).toHaveBeenCalledWith('spreadsheet-ai-formula', {
      body: {
        mode: 'from_nl',
        headers: ['Statut', 'Montant'],
        sampleRows: [['Payé', 25]],
        documentId: 'doc-1',
        locale: 'fr',
        prompt: 'additionner les montants payés',
      },
    })

    await waitFor(() => expect(launchButton).toBeDisabled())
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument()

    await act(async () => {
      deferred.resolve({ data: SUCCESS_RESULT, error: null })
      await deferred.promise
    })

    expect(await screen.findByText(SUCCESS_RESULT.formula)).toBeInTheDocument()
    expect(screen.getByText(SUCCESS_RESULT.explanation)).toBeInTheDocument()
    expect(screen.getByText(SUCCESS_RESULT.examples[0])).toBeInTheDocument()
    expect(launchButton).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Copier' }))

    await waitFor(() => expect(mockClipboardWriteText).toHaveBeenCalledWith(SUCCESS_RESULT.formula))
    expect(mockToastSuccess).toHaveBeenCalledWith('Copié')

    fireEvent.click(screen.getByRole('button', { name: 'Insérer' }))

    expect(onApplyFormula).toHaveBeenCalledWith(SUCCESS_RESULT.formula)
    expect(mockToastSuccess).toHaveBeenCalledWith('Formule insérée')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("envoie la formule courante en mode explication et affiche l'explication retournée", async () => {
    mockInvoke.mockResolvedValueOnce({ data: EXPLAIN_RESULT, error: null })

    render(
      <FormulaAssistantDialog
        open={true}
        onOpenChange={vi.fn()}
        currentFormula="=SOMME(B2:B10)"
        headers={['Montant']}
        sampleRows={[[4], [6]]}
      />
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Expliquer' }))

    const formulaInput = screen.getByLabelText('Formule à expliquer')
    expect(formulaInput).toHaveValue('=SOMME(B2:B10)')

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('spreadsheet-ai-formula', {
        body: {
          mode: 'explain',
          headers: ['Montant'],
          sampleRows: [[4], [6]],
          documentId: null,
          locale: 'fr',
          formula: '=SOMME(B2:B10)',
        },
      })
    )

    expect(await screen.findByText(EXPLAIN_RESULT.explanation)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Insérer' })).not.toBeInTheDocument()
  })

  it("affiche une erreur toast et ne rend pas de résultat lorsque l'appel IA échoue", async () => {
    mockInvoke.mockResolvedValueOnce(ERROR_RESPONSE)

    render(<FormulaAssistantDialog open={true} onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Décrivez ce que la formule doit faire'), {
      target: { value: 'créer une formule invalide' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Erreur IA'))

    expect(mockInvoke).toHaveBeenCalledWith('spreadsheet-ai-formula', {
      body: {
        mode: 'from_nl',
        headers: undefined,
        sampleRows: undefined,
        documentId: null,
        locale: 'fr',
        prompt: 'créer une formule invalide',
      },
    })
    expect(screen.queryByText('Formule')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled()
  })
})
