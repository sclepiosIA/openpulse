/* @vitest-environment jsdom */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicTransfer from './PublicTransfer'

const { META_OK, META_EXPIRED, fetchMock, anchorClickMock } = vi.hoisted(() => ({
  META_OK: {
    token: 'tok1',
    sender_email: 'alice@example.com',
    subject: 'Documents de projet',
    message: 'Voici les fichiers demandés',
    expires_at: '2099-12-31T23:59:59.000Z',
    file_count: 2,
    total_size_bytes: 3072,
    download_count: 0,
    password_required: false,
    files: [
      {
        id: 'f1',
        filename: 'rapport.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1024,
      },
      {
        id: 'f2',
        filename: 'image.png',
        mime_type: 'image/png',
        size_bytes: 2048,
      },
    ],
  },
  META_EXPIRED: {
    token: 'tok2',
    sender_email: 'bob@example.com',
    subject: 'Archive',
    message: 'Lien expiré',
    expires_at: '2000-01-01T00:00:00.000Z',
    file_count: 1,
    total_size_bytes: 512,
    download_count: 0,
    password_required: true,
    files: [
      {
        id: 'f9',
        filename: 'secret.txt',
        mime_type: 'text/plain',
        size_bytes: 512,
      },
    ],
  },
  fetchMock: vi.fn(),
  anchorClickMock: vi.fn(),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    size?: string
    variant?: string
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    type,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
    placeholder?: string
    type?: string
  }) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      type={type}
    />
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h1 className={className}>{children}</h1>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => ({
  Download: ({ className }: { className?: string }) => <svg data-testid="icon-download" className={className} />,
  Lock: ({ className }: { className?: string }) => <svg data-testid="icon-lock" className={className} />,
  Clock: ({ className }: { className?: string }) => <svg data-testid="icon-clock" className={className} />,
  FileText: ({ className }: { className?: string }) => <svg data-testid="icon-file" className={className} />,
  Loader2: ({ className }: { className?: string }) => <svg data-testid="icon-loader" className={className} />,
}))

function renderWithRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/transfer/:token" element={<PublicTransfer />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', {
          value: anchorClickMock,
          configurable: true,
        })
      }
      return element
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('affiche le chargement puis les métadonnées du transfert avec les tailles formatées', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => META_OK,
    })

    renderWithRoute('/transfer/tok1')

    expect(screen.getByTestId('icon-loader')).toBeInTheDocument()

    expect(await screen.findByText('Fichiers partagés')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Documents de projet')).toBeInTheDocument()
    expect(screen.getByText('Voici les fichiers demandés')).toBeInTheDocument()
    expect(screen.getByText('2 fichiers (3.0 Ko)')).toBeInTheDocument()
    expect(screen.getByText('rapport.pdf')).toBeInTheDocument()
    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(screen.getByText('1.0 Ko')).toBeInTheDocument()
    expect(screen.getByText('2.0 Ko')).toBeInTheDocument()
    expect(screen.getByText(/Disponible jusqu'au/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/download-email-transfer?token=tok1'),
    )
  })

  it("affiche l'erreur si la récupération initiale échoue", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Lien introuvable' }),
    })

    renderWithRoute('/transfer/bad-token')

    expect(await screen.findByText('Transfert indisponible')).toBeInTheDocument()
    expect(screen.getByText('Lien introuvable')).toBeInTheDocument()
  })

  it('affiche une erreur si l’API retourne 200 avec des métadonnées absentes', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    })

    renderWithRoute('/transfer/token-invalide')

    expect(await screen.findByText('Transfert indisponible')).toBeInTheDocument()
    expect(screen.getByText('Lien de transfert invalide ou expiré')).toBeInTheDocument()
  })

  it('valide le mot de passe, masque le bloc de protection et permet le téléchargement avec le paramètre p', async () => {
    const protectedMeta = {
      ...META_OK,
      password_required: true,
      file_count: 1,
      total_size_bytes: 1024,
      files: [META_OK.files[0]],
    }

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => protectedMeta,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

    renderWithRoute('/transfer/tok1')

    expect(await screen.findByText('Ce transfert est protégé par mot de passe')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Mot de passe')
    fireEvent.change(input, { target: { value: 'secret' } })

    const validateButton = screen.getByRole('button', { name: 'Valider' })
    expect(validateButton).not.toBeDisabled()

    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/functions/v1/download-email-transfer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'tok1', password: 'secret' }),
      })
    })

    await waitFor(() => {
      expect(screen.queryByText('Ce transfert est protégé par mot de passe')).not.toBeInTheDocument()
    })

    const downloadButton = screen.getByRole('button', { name: /Télécharger/ })
    expect(downloadButton).not.toBeDisabled()

    fireEvent.click(downloadButton)

    const anchor = document.createElement('a') as HTMLAnchorElement
    expect(anchorClickMock).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('affiche une erreur si le mot de passe est incorrect', async () => {
    const protectedMeta = {
      ...META_OK,
      password_required: true,
      file_count: 1,
      total_size_bytes: 1024,
      files: [META_OK.files[0]],
    }

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => protectedMeta,
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'nope' }),
      })

    renderWithRoute('/transfer/tok1')

    expect(await screen.findByText('Ce transfert est protégé par mot de passe')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))

    expect(await screen.findByText('Mot de passe incorrect')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Télécharger/ })).toBeDisabled()
  })

  it('désactive le téléchargement quand le transfert est expiré', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => META_EXPIRED,
    })

    renderWithRoute('/transfer/tok2')

    expect(await screen.findByText('Expiré')).toBeInTheDocument()
    expect(screen.getByText('1 fichier (512 o)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Télécharger/ })).toBeDisabled()
  })
})