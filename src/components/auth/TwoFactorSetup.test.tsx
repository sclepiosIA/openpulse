// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TwoFactorSetup } from './TwoFactorSetup'

const {
  getSessionMock,
  listFactorsMock,
  unenrollMock,
  enrollMock,
  challengeAndVerifyMock,
  getAssuranceMock,
  getUserMock,
  profileEqMock,
  toDataURLMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  listFactorsMock: vi.fn(),
  unenrollMock: vi.fn(),
  enrollMock: vi.fn(),
  challengeAndVerifyMock: vi.fn(),
  getAssuranceMock: vi.fn(),
  getUserMock: vi.fn(),
  profileEqMock: vi.fn(),
  toDataURLMock: vi.fn(),
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      getUser: getUserMock,
      mfa: {
        listFactors: listFactorsMock,
        unenroll: unenrollMock,
        enroll: enrollMock,
        challengeAndVerify: challengeAndVerifyMock,
        getAuthenticatorAssuranceLevel: getAssuranceMock,
      },
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: profileEqMock })),
    })),
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('qrcode', () => ({
  default: { toDataURL: toDataURLMock },
}))

function renderSetup() {
  const onComplete = vi.fn()
  const onCancel = vi.fn()
  render(<TwoFactorSetup onComplete={onComplete} onCancel={onCancel} />)
  return { onComplete, onCancel }
}

describe('TwoFactorSetup — enrôlement TOTP natif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    // `listFactors` rend `all` (tous les facteurs, quel que soit leur statut)
    // ET `totp` (les seuls vérifiés). Le simulacre omettait `all`, si bien
    // qu'un code qui s'en sert plantait sans que le test le dise.
    listFactorsMock.mockResolvedValue({ data: { all: [], totp: [] }, error: null })
    unenrollMock.mockResolvedValue({ data: {}, error: null })
    enrollMock.mockResolvedValue({
      data: {
        id: 'factor-1',
        totp: { uri: 'otpauth://totp/Gestion:user?secret=ABCDEF', secret: 'ABCDEF' },
      },
      error: null,
    })
    challengeAndVerifyMock.mockResolvedValue({ data: {}, error: null })
    getAssuranceMock.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2' },
      error: null,
    })
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    profileEqMock.mockResolvedValue({ error: null })
    toDataURLMock.mockResolvedValue('data:image/png;base64,qr')
  })

  it('génère un QR code et une clé manuelle à partir du facteur Supabase', async () => {
    renderSetup()

    expect(await screen.findByText('Scannez ce QR code')).toBeInTheDocument()
    expect(screen.getByAltText('QR Code 2FA')).toHaveAttribute('src', 'data:image/png;base64,qr')
    expect(screen.getByDisplayValue('ABCDEF')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copier la clé secrète' })).toBeInTheDocument()
    expect(enrollMock).toHaveBeenCalledWith({
      factorType: 'totp',
      friendlyName: 'Gestion OpenPulse',
    })
  })

  it('n’active le 2FA qu’après vérification du code et passage réel en AAL2', async () => {
    const user = userEvent.setup()
    const { onComplete } = renderSetup()
    await screen.findByText('Scannez ce QR code')

    await user.type(screen.getByLabelText(/code de vérification/i), '123456')
    await user.click(screen.getByRole('button', { name: /activer le 2fa/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(challengeAndVerifyMock).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' })
    expect(getAssuranceMock).toHaveBeenCalledTimes(1)
    expect(profileEqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('refuse de créer un doublon lorsqu’un facteur vérifié existe déjà', async () => {
    listFactorsMock.mockResolvedValue({
      data: {
        all: [{ id: 'verified-1', status: 'verified', factor_type: 'totp' }],
        totp: [{ id: 'verified-1', status: 'verified' }],
      },
      error: null,
    })
    renderSetup()

    expect(
      await screen.findByText('Un authentificateur est déjà configuré pour ce compte.')
    ).toBeInTheDocument()
    expect(enrollMock).not.toHaveBeenCalled()
  })

  it('supprime le facteur non vérifié lorsqu’on annule l’enrôlement', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderSetup()
    await screen.findByText('Scannez ce QR code')

    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
    expect(unenrollMock).toHaveBeenCalledWith({ factorId: 'factor-1' })
  })
})
