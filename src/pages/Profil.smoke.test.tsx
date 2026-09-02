import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profil from './Profil'

// Mock hooks/services dépendants
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))
vi.mock('@/hooks/auth/use2FA', () => ({
  use2FA: () => ({ check2FAEnabled: vi.fn().mockResolvedValue(false) }),
}))
vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  },
}))
vi.mock('@/components/profile/ProfileHero', () => ({ ProfileHero: () => null }))
vi.mock('@/components/profile/ProfileSettings', () => ({ ProfileSettings: () => null }))
vi.mock('@/components/profile/EmailSettings', () => ({ EmailSettings: () => null }))
vi.mock('@/components/settings/NotificationPreferences', () => ({ NotificationPreferences: () => null }))
vi.mock('@/components/profile/McpIntegrationGuide', () => ({ McpIntegrationGuide: () => null }))

describe('Profil smoke', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rend un h1 identifiable même sans utilisateur (pas de spinner infini)', async () => {
    render(
      <MemoryRouter>
        <Profil />
      </MemoryRouter>,
    )
    // h1 "Mon profil" doit être présent immédiatement
    const heading = await screen.findByRole('heading', { level: 1, name: /mon profil/i })
    expect(heading).toBeInTheDocument()

    // Un état d'erreur/vide doit apparaître rapidement (pas de spinner infini)
    await waitFor(() => {
      expect(
        screen.queryByText(/erreur de chargement|connecté|indisponible|impossible/i),
      ).toBeTruthy()
    })
  })
})
