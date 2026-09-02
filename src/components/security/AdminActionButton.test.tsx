// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminActionButton } from './AdminActionButton'

const {
  toastSpy,
  sanitizeSupabaseErrorSpy,
  debugErrorSpy,
  rpcSpy,
} = vi.hoisted(() => {
  return {
    toastSpy: vi.fn(),
    sanitizeSupabaseErrorSpy: vi.fn(),
    debugErrorSpy: vi.fn(),
    rpcSpy: vi.fn(),
  }
})

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorSpy,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorSpy,
}))

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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }

  return {
    supabase: {
      from: vi.fn(() => createBuilder()),
      rpc: rpcSpy,
    },
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: string
      size?: string
      asChild?: boolean
    }
  >(({ children, ...props }, ref) => (
    <button ref={ref} {...props}>
      {children}
    </button>
  )),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-triangle-icon" {...props} />,
  Shield: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="shield-icon" {...props} />,
}))

vi.mock('@/components/ui/alert-dialog', () => {
  const DialogContext = React.createContext<{
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
  } | null>(null)

  function AlertDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>
  }

  function AlertDialogTrigger({
    children,
    asChild,
  }: {
    children: React.ReactElement
    asChild?: boolean
  }) {
    const ctx = React.useContext(DialogContext)
    if (!ctx) return children
    if (asChild && React.isValidElement(children)) {
      const originalOnClick = children.props.onClick as ((event: React.MouseEvent) => void) | undefined
      return React.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          originalOnClick?.(event)
          ctx.setOpen(true)
        },
      })
    }
    return <button onClick={() => ctx.setOpen(true)}>{children}</button>
  }

  function AlertDialogContent({ children }: { children: React.ReactNode }) {
    const ctx = React.useContext(DialogContext)
    if (!ctx?.open) return null
    return <div>{children}</div>
  }

  function AlertDialogAction(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode },
  ) {
    return <button {...props}>{props.children}</button>
  }

  function AlertDialogCancel(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode },
  ) {
    const ctx = React.useContext(DialogContext)
    return (
      <button
        {...props}
        onClick={(event) => {
          props.onClick?.(event)
          ctx?.setOpen(false)
        }}
      >
        {props.children}
      </button>
    )
  }

  return {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogAction,
    AlertDialogCancel,
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('AdminActionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sanitizeSupabaseErrorSpy.mockReturnValue('Erreur nettoyée')
  })

  it('affiche le dialogue de confirmation et exécute l’action après validation quand l’admin 2FA est autorisé', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(async () => {})
    rpcSpy.mockResolvedValue({ data: true, error: null })

    render(
      <AdminActionButton
        operationName="delete-user"
        description="Suppression définitive de l’utilisateur"
        onConfirm={onConfirm}
      >
        Supprimer
      </AdminActionButton>,
      { wrapper: createWrapper() },
    )

    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(screen.getByText("Confirmer l'opération d'administration")).toBeInTheDocument()
    expect(screen.getByText('Suppression définitive de l’utilisateur')).toBeInTheDocument()
    expect(
      screen.getByText(/Cette opération sera auditée et nécessite des privilèges d'administrateur avec 2FA activé/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith('require_admin_2fa', {
        operation_name: 'delete-user',
      })
    })

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    expect(toastSpy).not.toHaveBeenCalled()
    expect(debugErrorSpy).not.toHaveBeenCalled()
  })

  it('exécute directement sans confirmation quand requireConfirmation=false et montre l’état de chargement', async () => {
    const user = userEvent.setup()
    let resolveConfirm: (() => void) | undefined
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve
        }),
    )

    rpcSpy.mockResolvedValue({ data: true, error: null })

    render(
      <AdminActionButton
        operationName="sync-data"
        description="Synchronisation"
        onConfirm={onConfirm}
        requireConfirmation={false}
      >
        Lancer
      </AdminActionButton>,
      { wrapper: createWrapper() },
    )

    await user.click(screen.getByRole('button', { name: 'Lancer' }))

    expect(await screen.findByText('Exécution...')).toBeInTheDocument()

    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith('require_admin_2fa', {
        operation_name: 'sync-data',
      })
    })

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    if (resolveConfirm) {
      resolveConfirm()
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument()
    })
  })

  it("refuse l'action et affiche un toast destructif si l'utilisateur n'a pas les privilèges admin 2FA", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    rpcSpy.mockResolvedValue({ data: false, error: null })

    render(
      <AdminActionButton
        operationName="danger-op"
        description="Action sensible"
        onConfirm={onConfirm}
        requireConfirmation={false}
      >
        Exécuter
      </AdminActionButton>,
      { wrapper: createWrapper() },
    )

    await user.click(screen.getByRole('button', { name: 'Exécuter' }))

    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith('require_admin_2fa', {
        operation_name: 'danger-op',
      })
    })

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        title: 'Accès refusé',
        description: "Cette opération nécessite des privilèges d'administrateur avec 2FA",
        variant: 'destructive',
      })
    })

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("gère l'erreur 2FA avec un toast dédié", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const error = new Error('2FA manquant pour cette opération')

    rpcSpy.mockRejectedValue(error)

    render(
      <AdminActionButton
        operationName="export"
        description="Exporter les données"
        onConfirm={onConfirm}
        requireConfirmation={false}
      >
        Exporter
      </AdminActionButton>,
      { wrapper: createWrapper() },
    )

    await user.click(screen.getByRole('button', { name: 'Exporter' }))

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith('Admin operation error:', error)
    })

    expect(toastSpy).toHaveBeenCalledWith({
      title: '2FA requis',
      description: "Vous devez activer l'authentification à deux facteurs pour effectuer cette action",
      variant: 'destructive',
    })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(sanitizeSupabaseErrorSpy).not.toHaveBeenCalled()
  })

  it("gère l'erreur Supabase renvoyée par rpc avec message sanitizé", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const errorObject = { message: 'rpc failed' }

    rpcSpy.mockResolvedValue({ data: null, error: errorObject })

    render(
      <AdminActionButton
        operationName="archive"
        description="Archiver"
        onConfirm={onConfirm}
        requireConfirmation={false}
      >
        Archiver
      </AdminActionButton>,
      { wrapper: createWrapper() },
    )

    await user.click(screen.getByRole('button', { name: 'Archiver' }))

    await waitFor(() => {
      expect(debugErrorSpy).toHaveBeenCalledWith('Admin operation error:', errorObject)
    })

    expect(sanitizeSupabaseErrorSpy).toHaveBeenCalledWith(errorObject)
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur nettoyée',
      variant: 'destructive',
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})