import React from 'react'
import { render, screen } from '@testing-library/react'
import { AdminUsersListPreview, AdminSecurityPreview, AdminSettingsPreview } from './AdministrationPreviews'

vi.mock('framer-motion', () => {
  const Fake: React.FC<React.PropsWithChildren<{ [key: string]: unknown }>> = ({ children }) => <>{children}</>
  return {
    motion: {
      div: Fake,
    },
  }
})

vi.mock('lucide-react', () => {
  const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => <svg {...props} />
  return {
    Shield: Icon,
    Users: Icon,
    Settings: Icon,
    Key: Icon,
    Lock: Icon,
    Eye: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    AlertTriangle: Icon,
    Globe: Icon,
  }
})

vi.mock('@/components/ui/badge', () => {
  const Badge: React.FC<React.PropsWithChildren<{ className?: string; variant?: string }>> = ({ children }) => (
    <span>{children}</span>
  )
  return { Badge }
})

vi.mock('@/components/ui/switch', () => {
  const Switch: React.FC<{ checked?: boolean }> = () => <button type="button" aria-label="switch" />
  return { Switch }
})

vi.mock('@/components/ui/card', () => {
  const Card: React.FC<React.PropsWithChildren> = ({ children }) => <div>{children}</div>
  const CardContent: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children }) => <div>{children}</div>
  const CardHeader: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children }) => <div>{children}</div>
  const CardTitle: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children }) => <h3>{children}</h3>
  return { Card, CardContent, CardHeader, CardTitle }
})

vi.mock('@/components/ui/button', () => {
  const Button: React.FC<
    React.PropsWithChildren<{
      size?: string
      variant?: string
      className?: string
      'aria-label'?: string
      type?: 'button' | 'submit' | 'reset'
    }>
  > = ({ children, type = 'button', ...rest }) => (
    <button type={type} {...rest}>
      {children}
    </button>
  )
  return { Button }
})

vi.mock('@/components/ui/avatar', () => {
  const Avatar: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children }) => <div>{children}</div>
  const AvatarFallback: React.FC<React.PropsWithChildren> = ({ children }) => <span>{children}</span>
  const AvatarImage: React.FC<{ src?: string }> = () => null
  return { Avatar, AvatarFallback, AvatarImage }
})

describe('AdministrationPreviews components', () => {
  describe('AdminUsersListPreview', () => {
    it('affiche le titre et le bouton nouveau', () => {
      render(<AdminUsersListPreview />)
      expect(screen.getByText('Utilisateurs')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '+ Nouveau' })).toBeInTheDocument()
    })

    it('rend la liste complète des utilisateurs avec rôle et email', () => {
      render(<AdminUsersListPreview />)

      expect(screen.getByText('Marie Dupont')).toBeInTheDocument()
      expect(screen.getByText('marie@example.com')).toBeInTheDocument()
      expect(screen.getByText('Administrateur')).toBeInTheDocument()

      expect(screen.getByText('Thomas Laurent')).toBeInTheDocument()
      expect(screen.getByText('thomas@example.com')).toBeInTheDocument()
      expect(screen.getByText('Commercial')).toBeInTheDocument()

      expect(screen.getByText('Julie Martin')).toBeInTheDocument()
      expect(screen.getByText('julie@example.com')).toBeInTheDocument()
      expect(screen.getByText('CSM')).toBeInTheDocument()

      expect(screen.getByText('Pierre Vasseur')).toBeInTheDocument()
      expect(screen.getByText('pierre@example.com')).toBeInTheDocument()
      expect(screen.getByText('Chef de projet')).toBeInTheDocument()
    })

    it('affiche le badge inactif pour les utilisateurs inactifs', () => {
      render(<AdminUsersListPreview />)
      const inactifBadge = screen.getByText('Inactif')
      expect(inactifBadge).toBeInTheDocument()
    })
  })

  describe('AdminSecurityPreview', () => {
    it('affiche le panneau sécurité et la 2FA activée', () => {
      render(<AdminSecurityPreview />)
      expect(screen.getByText('Sécurité')).toBeInTheDocument()
      expect(screen.getByText('Authentification 2FA')).toBeInTheDocument()
      expect(screen.getByText('TOTP via Google Authenticator')).toBeInTheDocument()
      expect(screen.getByText('Activée')).toBeInTheDocument()
    })

    it('affiche les dernières connexions avec statut succès / échec', () => {
      render(<AdminSecurityPreview />)

      expect(screen.getByText("Aujourd'hui 14:32")).toBeInTheDocument()
      expect(screen.getByText("Aujourd'hui 09:15")).toBeInTheDocument()
      expect(screen.getByText('Hier 22:10')).toBeInTheDocument()

      expect(screen.getByText('Chrome / MacOS')).toBeInTheDocument()
      expect(screen.getByText('Safari / iOS')).toBeInTheDocument()
      expect(screen.getByText('Firefox / Windows')).toBeInTheDocument()

      expect(screen.getAllByText('192.168.1.45').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('82.120.45.123')).toBeInTheDocument()
    })

    it('affiche la section restriction IP avec bouton configurer', () => {
      render(<AdminSecurityPreview />)
      expect(screen.getByText('Restriction IP')).toBeInTheDocument()
      expect(screen.getByText('Restriction désactivée')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Configurer' })).toBeInTheDocument()
    })
  })

  describe('AdminSettingsPreview', () => {
    it('affiche le titre principal et les groupes de configuration', () => {
      render(<AdminSettingsPreview />)
      expect(screen.getByText('Configuration système')).toBeInTheDocument()
      expect(screen.getByText('Général')).toBeInTheDocument()
      expect(screen.getByText('Sécurité')).toBeInTheDocument()
    })

    it('affiche les paramètres généraux avec leurs valeurs', () => {
      render(<AdminSettingsPreview />)
      expect(screen.getByText("Nom de l'organisation")).toBeInTheDocument()
      expect(screen.getByText('OpenPulse')).toBeInTheDocument()
      expect(screen.getByText('Fuseau horaire')).toBeInTheDocument()
      expect(screen.getByText('Europe/Paris (UTC+1)')).toBeInTheDocument()
      expect(screen.getByText('Langue par défaut')).toBeInTheDocument()
      expect(screen.getByText('Français')).toBeInTheDocument()
    })

    it('affiche les paramètres de sécurité avec les libellés attendus', () => {
      render(<AdminSettingsPreview />)
      expect(screen.getByText('2FA obligatoire pour admins')).toBeInTheDocument()
      expect(screen.getByText('Session timeout (minutes)')).toBeInTheDocument()
      expect(screen.getByText('30')).toBeInTheDocument()
      expect(screen.getByText('Notifications de sécurité')).toBeInTheDocument()
    })

    it('affiche les secrets API masqués et le bouton voir', () => {
      render(<AdminSettingsPreview />)

      expect(screen.getByText('Secrets et clés API')).toBeInTheDocument()
      expect(screen.getByText('AZURE_OPENAI_API_KEY')).toBeInTheDocument()
      expect(screen.getByText('QONTO_API_KEY')).toBeInTheDocument()

      expect(screen.getByText('••••••••••••abc123')).toBeInTheDocument()
      expect(screen.getByText('••••••••••••xyz789')).toBeInTheDocument()

      const buttons = screen.getAllByRole('button', { name: 'Voir' })
      expect(buttons.length).toBe(2)
    })
  })
})