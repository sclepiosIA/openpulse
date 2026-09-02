/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmailTransferDialog } from './EmailTransferDialog'

const {
  authState,
  toastFn,
  uploadMock,
  invokeEdgeMock,
  onCloseMock,
  onCreatedMock,
  storageFromMock,
  fixedUuid,
} = vi.hoisted(() => ({
  authState: { user: { id: 'user-1', email: 'user@test.local' } },
  toastFn: vi.fn(),
  uploadMock: vi.fn(),
  invokeEdgeMock: vi.fn(),
  onCloseMock: vi.fn(),
  onCreatedMock: vi.fn(),
  storageFromMock: vi.fn(),
  fixedUuid: 'c71b7b0b-zz',
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastFn }),
}))

vi.mock('@/services/edgeFunctions', () => ({
  invokeEdge: invokeEdgeMock,
}))

vi.mock('@/integrations/supabase/client', () => {
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
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  }

  storageFromMock.mockReturnValue({
    upload: uploadMock,
  })

  return {
    supabase: {
      from: vi.fn(() => builder),
      storage: {
        from: storageFromMock,
      },
    },
  }
})

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
    size,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: string
    size?: string
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    disabled,
    className,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
    type?: string
    disabled?: boolean
    className?: string
  }) => (
    <input
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
    />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
  }) => (
    <button
      type="button"
      aria-pressed={checked}
      aria-label="switch"
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    Loader2: Icon,
    Upload: Icon,
    X: Icon,
    Link2: Icon,
    Shield: Icon,
    Bell: Icon,
    Clock: Icon,
  }
})

describe('EmailTransferDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadMock.mockResolvedValue({ error: null })
    invokeEdgeMock.mockResolvedValue({
      success: true,
      public_url: 'https://app.local/transfer/public',
      token: 'tok-1234',
      expires_at: '2026-03-10T00:00:00.000Z',
      total_size_bytes: 3072,
    })
    storageFromMock.mockReturnValue({ upload: uploadMock })
    vi.spyOn(Date, 'now').mockReturnValue(1781051673868)
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: vi.fn(() => fixedUuid),
      },
      configurable: true,
    })
  })

  it('affiche les fichiers ajoutés, le total et permet de supprimer un fichier', async () => {
    render(
      <EmailTransferDialog
        open
        onClose={onCloseMock}
        onCreated={onCreatedMock}
        defaultRecipients={['dest@test.local']}
      />,
    )

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)

    const file1 = new File(['abc'], 'doc-1.pdf', { type: 'application/pdf' })
    const file2 = new File(['hello world'], 'doc-2.txt', { type: 'text/plain' })

    await userEvent.upload(fileInput as HTMLInputElement, [file1, file2])

    expect(screen.getByText('doc-1.pdf')).toBeInTheDocument()
    expect(screen.getByText('doc-2.txt')).toBeInTheDocument()
    expect(screen.getByText('3 o')).toBeInTheDocument()
    expect(screen.getByText('11 o')).toBeInTheDocument()
    expect(screen.getByText('Total : 14 o')).toBeInTheDocument()

    const removeButtons = screen.getAllByRole('button').filter((button) => button.className.includes('text-destructive'))
    expect(removeButtons).toHaveLength(2)

    await userEvent.click(removeButtons[0])

    expect(screen.queryByText('doc-1.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('doc-2.txt')).toBeInTheDocument()
    expect(screen.getByText('Total : 11 o')).toBeInTheDocument()
  })

  it('crée un transfert avec upload, options métier et callback onCreated', async () => {
    render(
      <EmailTransferDialog
        open
        onClose={onCloseMock}
        onCreated={onCreatedMock}
        defaultRecipients={['a@test.local', 'b@test.local']}
      />,
    )

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)

    const file1 = new File(['abc'], 'contrat signé.pdf', { type: 'application/pdf' })
    const file2 = new File(['defghi'], 'image.png', { type: 'image/png' })

    await userEvent.upload(fileInput as HTMLInputElement, [file1, file2])

    await userEvent.click(screen.getByRole('button', { name: /30 jours/i }))

    const switches = screen.getAllByRole('button', { name: 'switch' })
    await userEvent.click(switches[0])
    await userEvent.type(screen.getByPlaceholderText('Mot de passe (min 4 caractères)'), 'pass')
    await userEvent.click(switches[1])

    await userEvent.click(screen.getByRole('button', { name: /créer le lien/i }))

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(2)
    })

    expect(storageFromMock).toHaveBeenCalledWith('email-transfers')

    const firstUploadArgs = uploadMock.mock.calls[0]
    expect(firstUploadArgs[0]).toBe('user-1/1781051673868-c71b7b0b/0-contrat_sign_.pdf')
    expect(firstUploadArgs[1]).toBe(file1)
    expect(firstUploadArgs[2]).toEqual({
      contentType: 'application/pdf',
      upsert: false,
    })

    const secondUploadArgs = uploadMock.mock.calls[1]
    expect(secondUploadArgs[0]).toBe('user-1/1781051673868-c71b7b0b/1-image.png')
    expect(secondUploadArgs[1]).toBe(file2)
    expect(secondUploadArgs[2]).toEqual({
      contentType: 'image/png',
      upsert: false,
    })

    await waitFor(() => {
      expect(invokeEdgeMock).toHaveBeenCalledWith('create-email-transfer', {
        sender_email: 'user@test.local',
        recipient_emails: ['a@test.local', 'b@test.local'],
        retention_days: 30,
        password: 'pass',
        notify_on_download: true,
        files: [
          {
            filename: 'contrat signé.pdf',
            mime_type: 'application/pdf',
            size_bytes: 3,
            storage_path: 'user-1/1781051673868-c71b7b0b/0-contrat_sign_.pdf',
          },
          {
            filename: 'image.png',
            mime_type: 'image/png',
            size_bytes: 6,
            storage_path: 'user-1/1781051673868-c71b7b0b/1-image.png',
          },
        ],
      })
    })

    expect(onCreatedMock).toHaveBeenCalledWith({
      publicUrl: 'https://app.local/transfer/public',
      token: 'tok-1234',
      expiresAt: '2026-03-10T00:00:00.000Z',
      totalSize: 3072,
      files: [
        { filename: 'contrat signé.pdf', size: 3 },
        { filename: 'image.png', size: 6 },
      ],
    })
    expect(onCloseMock).toHaveBeenCalledTimes(1)
    expect(toastFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Transfert prêt',
        description: expect.stringContaining('10/03/2026'),
      }),
    )
    expect(screen.queryByText('contrat signé.pdf')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Mot de passe (min 4 caractères)')).not.toBeInTheDocument()
  })

  it('affiche une erreur si le mot de passe est trop court et bloque l’envoi', async () => {
    render(
      <EmailTransferDialog
        open
        onClose={onCloseMock}
        onCreated={onCreatedMock}
        defaultRecipients={['dest@test.local']}
      />,
    )

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)

    const file = new File(['abc'], 'secure.pdf', { type: 'application/pdf' })
    await userEvent.upload(fileInput as HTMLInputElement, file)

    const switches = screen.getAllByRole('button', { name: 'switch' })
    await userEvent.click(switches[0])
    await userEvent.type(screen.getByPlaceholderText('Mot de passe (min 4 caractères)'), '123')

    await userEvent.click(screen.getByRole('button', { name: /créer le lien/i }))

    expect(toastFn).toHaveBeenCalledWith({
      title: 'Mot de passe trop court (4 caractères min)',
      variant: 'destructive',
    })
    expect(uploadMock).not.toHaveBeenCalled()
    expect(invokeEdgeMock).not.toHaveBeenCalled()
    expect(onCreatedMock).not.toHaveBeenCalled()
  })

  it('affiche une erreur si la création du transfert échoue après upload', async () => {
    invokeEdgeMock.mockResolvedValue({
      success: false,
      error: 'x',
    })

    render(
      <EmailTransferDialog
        open
        onClose={onCloseMock}
        onCreated={onCreatedMock}
        defaultRecipients={['dest@test.local']}
      />,
    )

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)

    const file = new File(['payload'], 'error.txt', { type: 'text/plain' })
    await userEvent.upload(fileInput as HTMLInputElement, file)

    await userEvent.click(screen.getByRole('button', { name: /créer le lien/i }))

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'x',
        variant: 'destructive',
      })
    })

    expect(onCreatedMock).not.toHaveBeenCalled()
    expect(onCloseMock).not.toHaveBeenCalled()
    expect(screen.getByText('error.txt')).toBeInTheDocument()
  })

  it('empêche l’ajout de plus de 20 fichiers', async () => {
    render(
      <EmailTransferDialog
        open
        onClose={onCloseMock}
        onCreated={onCreatedMock}
      />,
    )

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)

    const files = Array.from({ length: 21 }, (_, i) => new File(['a'], `f-${i}.txt`, { type: 'text/plain' }))

    await userEvent.upload(fileInput as HTMLInputElement, files)

    expect(toastFn).toHaveBeenCalledWith({
      title: 'Trop de fichiers',
      description: 'Max 20',
      variant: 'destructive',
    })
    expect(screen.queryByText('f-0.txt')).not.toBeInTheDocument()
  })
})