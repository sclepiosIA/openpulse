import React from 'react'
import { render, screen, within, cleanup, act } from '@testing-library/react'

vi.mock('framer-motion', () => {
  const motion = new Proxy({}, {
    get: (_, tag) => {
      return ({ children, ...props }: any) => React.createElement(tag as string, props, children)
    },
  })
  const AnimatePresence = ({ children }: any) => React.createElement(React.Fragment, null, children)
  return { motion, AnimatePresence }
})

vi.mock('lucide-react', () => {
  const createIcon = (name: string) => (props: any) =>
    React.createElement('svg', { ...props, 'data-testid': `icon-${name}`, 'data-icon': name })
  return {
    Building2: createIcon('Building2'),
    User: createIcon('User'),
    Mail: createIcon('Mail'),
    MapPin: createIcon('MapPin'),
    Calendar: createIcon('Calendar'),
    Heart: createIcon('Heart'),
    CheckCircle2: createIcon('CheckCircle2'),
    Plus: createIcon('Plus'),
    MessageSquare: createIcon('MessageSquare'),
    FileText: createIcon('FileText'),
    Clock: createIcon('Clock'),
    Euro: createIcon('Euro'),
    Star: createIcon('Star'),
    MoreHorizontal: createIcon('MoreHorizontal'),
    Edit: createIcon('Edit'),
    ExternalLink: createIcon('ExternalLink'),
  }
})

vi.mock('@/components/ui/badge', () => {
  const Badge = (props: any) => React.createElement('span', props, props.children)
  return { Badge }
})

vi.mock('@/components/ui/avatar', () => {
  const Avatar = (props: any) => React.createElement('div', { ...props, 'data-testid': 'avatar' }, props.children)
  const AvatarFallback = (props: any) => React.createElement('div', { ...props, 'data-testid': 'avatar-fallback' }, props.children)
  return { Avatar, AvatarFallback }
})

vi.mock('@/components/ui/card', () => {
  const Card = (props: any) => React.createElement('div', { ...props, 'data-testid': 'card' }, props.children)
  const CardContent = (props: any) => React.createElement('div', { ...props, 'data-testid': 'card-content' }, props.children)
  const CardHeader = (props: any) => React.createElement('div', { ...props, 'data-testid': 'card-header' }, props.children)
  const CardTitle = (props: any) => React.createElement('div', { ...props, 'data-testid': 'card-title' }, props.children)
  return { Card, CardContent, CardHeader, CardTitle }
})

vi.mock('@/components/ui/button', () => {
  const Button = (props: any) => React.createElement('button', props, props.children)
  return { Button }
})

vi.mock('../TutorielCountUpAnimation', () => {
  const TutorielCountUpAnimation = ({ value, suffix = '', decimals = 0 }: any) => {
    const formatted = decimals ? Number(value).toFixed(decimals) : String(value)
    return React.createElement('span', null, `${formatted}${suffix || ''}`)
  }
  return { TutorielCountUpAnimation }
})

import { CRMEtablissementPreview, CRMContactsPreview, CRMNotesPreview, CRMHealthScorePreview } from './CRMPreviews'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CRMEtablissementPreview', () => {
  it('affiche les informations, le score santé évolue de 0% à 87%', async () => {
    vi.useFakeTimers()

    render(<CRMEtablissementPreview />)

    expect(screen.getByText('Groupe Vallois')).toBeInTheDocument()
    expect(screen.getByText('Grand compte')).toBeInTheDocument()
    expect(screen.getByText('Production')).toBeInTheDocument()
    expect(screen.getByText('Lyon')).toBeInTheDocument()
    expect(screen.getByText('Prochain RDV')).toBeInTheDocument()
    expect(screen.getByText('15 Jan 2026')).toBeInTheDocument()

    expect(screen.getByText('0%')).toBeInTheDocument()

    expect(screen.getByText('CA Annuel')).toBeInTheDocument()
    expect(screen.getByText('Contacts')).toBeInTheDocument()
    expect(screen.getByText('Tâches')).toBeInTheDocument()
    expect(screen.getByText('125000 €')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Voir détails/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    expect(screen.getByText('87%')).toBeInTheDocument()
  })
})

describe('CRMContactsPreview', () => {
  it('affiche la liste des contacts et les actions', () => {
    render(<CRMContactsPreview />)

    expect(screen.getByText(/Contacts \(3\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ajouter/i })).toBeInTheDocument()

    expect(screen.getByText('Dr. Marie Lambert')).toBeInTheDocument()
    expect(screen.getByText('Directrice des soins')).toBeInTheDocument()
    expect(screen.getByText('marie.lambert@groupe-vallois.example.org')).toBeInTheDocument()

    expect(screen.getByText('Jean-Pierre Duval')).toBeInTheDocument()
    expect(screen.getByText('DSI')).toBeInTheDocument()
    expect(screen.getByText('jp.duval@groupe-vallois.example.org')).toBeInTheDocument()

    expect(screen.getByText('Sophie Durand')).toBeInTheDocument()
    expect(screen.getByText('Cadre de santé')).toBeInTheDocument()
    expect(screen.getByText('s.moreau@groupe-vallois.example.org')).toBeInTheDocument()

    const optionButtons = screen.getAllByRole('button', { name: "Plus d'options" })
    expect(optionButtons.length).toBe(3)

    const stars = screen.queryAllByTestId('icon-Star')
    expect(stars.length).toBe(1)
  })
})

describe('CRMNotesPreview', () => {
  it('affiche l’historique des activités et le bouton Note', () => {
    render(<CRMNotesPreview />)

    expect(screen.getByText('Historique')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Note/i })).toBeInTheDocument()

    expect(screen.getByText('Appel de suivi effectué, satisfaction confirmée')).toBeInTheDocument()
    expect(screen.getByText('Email automatique envoyé : Rappel renouvellement')).toBeInTheDocument()
    expect(screen.getByText('Formation planifiée pour le 20 janvier')).toBeInTheDocument()
    expect(screen.getByText('Contrat annuel ajouté aux documents')).toBeInTheDocument()

    expect(screen.getByText('Il y a 2h')).toBeInTheDocument()
    expect(screen.getByText('Hier')).toBeInTheDocument()
    expect(screen.getByText('Il y a 2 jours')).toBeInTheDocument()
    expect(screen.getByText('Il y a 1 semaine')).toBeInTheDocument()
  })
})

describe('CRMHealthScorePreview', () => {
  it('affiche le détail du score de santé avec valeurs formatées', () => {
    render(<CRMHealthScorePreview />)

    expect(screen.getByText('Détail du score de santé')).toBeInTheDocument()

    const adoptionLabel = screen.getByText('Adoption')
    expect(adoptionLabel).toBeInTheDocument()
    const adoptionRow = adoptionLabel.parentElement as HTMLElement
    expect(within(adoptionRow).getByText(/^92$/)).toBeInTheDocument()
    expect(within(adoptionRow).getByText(/\/\s*100/)).toBeInTheDocument()

    const npsLabel = screen.getByText('NPS')
    expect(npsLabel).toBeInTheDocument()
    const npsRow = npsLabel.parentElement as HTMLElement
    expect(within(npsRow).getByText(/^8\.5$/)).toBeInTheDocument()
    expect(within(npsRow).getByText(/\/\s*10/)).toBeInTheDocument()

    const supportLabel = screen.getByText('Support')
    expect(supportLabel).toBeInTheDocument()
    const supportRow = supportLabel.parentElement as HTMLElement
    expect(within(supportRow).getByText(/^75$/)).toBeInTheDocument()
    expect(within(supportRow).getByText(/\/\s*100/)).toBeInTheDocument()

    const engagementLabel = screen.getByText('Engagement')
    expect(engagementLabel).toBeInTheDocument()
    const engagementRow = engagementLabel.parentElement as HTMLElement
    expect(within(engagementRow).getByText(/^88$/)).toBeInTheDocument()
    expect(within(engagementRow).getByText(/\/\s*100/)).toBeInTheDocument()
  })
})