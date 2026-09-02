import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { supabase } from '@/integrations/supabase/client'

const mockSignIn = vi.fn().mockResolvedValue({ error: null })
const mockConfigureAuthSessionPersistence = vi.fn()

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    user: null,
    loading: false,
  }),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/hooks/auth/use2FA', () => ({
  use2FA: () => ({
    validate2FAToken: vi.fn().mockResolvedValue(false),
    check2FAEnabled: vi.fn().mockResolvedValue(false),
  }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

vi.mock('@/lib/authPersistenceStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/authPersistenceStorage')>()
  return {
    ...actual,
    configureAuthSessionPersistence: mockConfigureAuthSessionPersistence,
  }
})

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: any) => e?.message || 'Error',
}))

vi.mock('@/assets/marque/logo.png', () => ({
  default: '/test-logo.png',
}))

vi.mock('@/components/auth/WaveBackground', () => ({
  WaveBackground: () => React.createElement('div', null, 'WaveBg'),
}))
vi.mock('@/components/auth/FloatingElements', () => ({
  FloatingElements: () => React.createElement('div', null, 'Floating'),
}))
vi.mock('@/components/auth/AuthBrandingPanel', () => ({
  AuthBrandingPanel: () => React.createElement('div', null, 'Branding'),
}))
vi.mock('@/components/auth/AnimatedFormCard', () => ({
  AnimatedFormCard: ({ children, className }: any) =>
    React.createElement('div', { className }, children),
  AnimatedFormItem: ({ children, className }: any) =>
    React.createElement('div', { className }, children),
}))
vi.mock('@/components/auth/MobileAuthHeader', () => ({
  MobileAuthHeader: () => React.createElement('div', null, 'MobileHeader'),
}))
vi.mock('@/components/auth/EmailValidationIndicator', () => ({
  EmailValidationIndicator: () => null,
  validateEmail: () => ({ isValid: true, domain: 'test.com' }),
}))
vi.mock('@/components/auth/PasswordStrengthIndicator', () => ({
  PasswordStrengthIndicator: () => null,
}))
vi.mock('@/components/TwoFactorSetup', () => ({
  TwoFactorSetup: () => React.createElement('div', null, '2FA Setup'),
}))

describe('Auth Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_AUTHENTIK_SSO_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const renderAuth = async () => {
    const Auth = (await import('@/pages/Auth')).default
    return render(
      React.createElement(MemoryRouter, { initialEntries: ['/auth'] }, React.createElement(Auth))
    )
  }

  it('applique la grille 40/60 de la charte sur bureau', async () => {
    await renderAuth()

    expect(screen.getByTestId('auth-brand-panel')).toHaveClass('lg:w-[40%]')
    expect(screen.getByTestId('auth-form-panel')).toHaveClass('lg:w-[60%]')
  })

  it('should render email input', async () => {
    await renderAuth()
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
  })

  it('should render password input', async () => {
    await renderAuth()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('should render sign in button', async () => {
    await renderAuth()
    expect(screen.getByText('Se connecter')).toBeInTheDocument()
  })

  it('compose les contrôles de connexion à 46 px sans dégradé ni ombre', async () => {
    await renderAuth()

    const email = screen.getByLabelText('Adresse e-mail')
    const password = screen.getByLabelText('Mot de passe')
    const submit = screen.getByRole('button', { name: 'Se connecter' })
    const authentik = screen.getByRole('button', { name: 'Continuer avec Authentik' })

    expect(email).toHaveClass('h-champ')
    expect(password).toHaveClass('h-champ')
    expect(submit).toHaveClass('h-champ', 'shadow-none')
    expect(submit).not.toHaveClass('h-controle')
    expect(authentik).toHaveClass('h-champ', 'shadow-none')
    expect(authentik).not.toHaveClass('h-controle')
    expect(submit.className).not.toMatch(/bg-gradient|shadow-(?:sm|md|lg|xl|2xl)/)
  })

  it('permet d’afficher puis de masquer le mot de passe', async () => {
    await renderAuth()

    const password = screen.getByLabelText('Mot de passe')
    expect(password).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Masquer le mot de passe' })).toBeInTheDocument()
  })

  it('compose la persistance 30 jours et la limite de sécurité de la maquette', async () => {
    await renderAuth()

    const persistence = screen.getByRole('checkbox', { name: 'Rester connecté 30 jours' })
    expect(persistence).toBeChecked()
    fireEvent.click(persistence)
    expect(persistence).not.toBeChecked()
    expect(screen.getByText(/5 tentatives puis verrouillage 15 min/)).toBeInTheDocument()
  })

  it('garde le pied légal mobile lisible sur le papier de marque', async () => {
    await renderAuth()

    const footer = screen.getByText(/© 2026 OpenPulse/).parentElement
    expect(footer).toHaveClass('text-foreground/80')
    expect(footer).not.toHaveClass('text-muted-foreground')
  })

  it('offre des cibles tactiles d’au moins 44 px sur les actions secondaires mobiles', async () => {
    await renderAuth()

    expect(screen.getByRole('button', { name: 'Mot de passe oublié ?' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toHaveClass(
      'min-h-11',
      'min-w-11'
    )
    expect(
      screen.getByRole('checkbox', { name: 'Rester connecté 30 jours' }).parentElement
    ).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveClass('min-h-11')
    expect(screen.getByRole('link', { name: 'Politique de confidentialité' })).toHaveClass(
      'min-h-11'
    )
  })

  it('place Authentik après la connexion par mot de passe', async () => {
    await renderAuth()

    const submit = screen.getByRole('button', { name: 'Se connecter' })
    const authentik = screen.getByRole('button', { name: 'Continuer avec Authentik' })

    expect(
      submit.compareDocumentPosition(authentik) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('applique le mode de persistance choisi avant la redirection Authentik', async () => {
    await renderAuth()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Rester connecté 30 jours' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuer avec Authentik' }))

    await waitFor(() => {
      expect(mockConfigureAuthSessionPersistence).toHaveBeenCalledWith(false)
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledTimes(1)
    })

    expect(mockConfigureAuthSessionPersistence.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(supabase.auth.signInWithOAuth).mock.invocationCallOrder[0]
    )
  })

  it('should render forgot password text', async () => {
    await renderAuth()
    expect(screen.getByText(/Mot de passe oublié/)).toBeInTheDocument()
  })

  it('should show forgot password form on click', async () => {
    await renderAuth()
    fireEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }))
    expect(screen.getByText('Envoyer le lien')).toBeInTheDocument()
    expect(screen.getByText('Retour à la connexion')).toBeInTheDocument()
  })

  it('transmet la persistance 30 jours lors de la connexion', async () => {
    await renderAuth()

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'test@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    })
    const submit = screen.getByRole('button', { name: 'Se connecter' })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@test.com', 'password123', true)
      expect(submit).not.toBeDisabled()
    })
  })

  it('transmet le mode session navigateur quand la persistance est décochée', async () => {
    await renderAuth()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Rester connecté 30 jours' }))
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'session@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('session@test.com', 'password123', false)
    })
  })
})
