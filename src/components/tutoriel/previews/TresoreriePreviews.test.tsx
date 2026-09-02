import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const {
  MockWrapper,
  MockCountUpAnimation,
  MockProgressBar,
  MockCard,
  MockCardContent,
  MockCardHeader,
  MockCardTitle,
  MockBadge,
  mockCn,
  Icons,
} = vi.hoisted(() => {
  const MockWrapper = ({ children }: { children: React.ReactNode }) => <div data-testid="preview-wrapper">{children}</div>
  const MockCountUpAnimation = ({ value, suffix = '' }: { value: number | string; suffix?: string }) => (
    <span data-testid="countup">{String(value)}{suffix}</span>
  )
  const MockProgressBar = ({ value, maxValue, color }: { value: number; maxValue: number; color?: string }) => (
    <div role="progressbar" data-value={value} data-max={maxValue} data-color={color || ''} />
  )
  const MockCard = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <div data-testid="card" className={className} style={style}>{children}</div>
  )
  const MockCardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  )
  const MockCardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  )
  const MockCardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>{children}</div>
  )
  const MockBadge = ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" data-variant={variant || 'default'} className={className}>{children}</span>
  )
  const mockCn = (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' ')
  const icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => <svg data-icon={name} {...props} />
  const Icons = {
    Wallet: icon('Wallet'),
    TrendingUp: icon('TrendingUp'),
    TrendingDown: icon('TrendingDown'),
    CreditCard: icon('CreditCard'),
    ArrowUpRight: icon('ArrowUpRight'),
    ArrowDownRight: icon('ArrowDownRight'),
    Building2: icon('Building2'),
    CheckCircle2: icon('CheckCircle2'),
    Clock: icon('Clock'),
  }
  return { MockWrapper, MockCountUpAnimation, MockProgressBar, MockCard, MockCardContent, MockCardHeader, MockCardTitle, MockBadge, mockCn, Icons }
})

vi.mock('../TutorielMockProviders', () => ({
  TutorielPreviewWrapper: MockWrapper,
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: MockCountUpAnimation,
  TutorielProgressBar: MockProgressBar,
}))

vi.mock('@/components/ui/card', () => ({
  Card: MockCard,
  CardContent: MockCardContent,
  CardHeader: MockCardHeader,
  CardTitle: MockCardTitle,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: MockBadge,
}))

vi.mock('lucide-react', () => ({
  Wallet: Icons.Wallet,
  TrendingUp: Icons.TrendingUp,
  TrendingDown: Icons.TrendingDown,
  CreditCard: Icons.CreditCard,
  ArrowUpRight: Icons.ArrowUpRight,
  ArrowDownRight: Icons.ArrowDownRight,
  Building2: Icons.Building2,
  CheckCircle2: Icons.CheckCircle2,
  Clock: Icons.Clock,
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

import {
  TresorerieDashboardPreview,
  TresorerieRevenusPreview,
  TresorerieDepensesPreview,
  mockTresorerieKPIs,
  mockRevenus,
  mockDepenses,
} from './TresoreriePreviews'

describe('TresoreriePreviews - Dashboard', () => {
  it('affiche les 4 KPIs avec valeurs et tendances correctes, et s’anime en visible', async () => {
    const { container } = render(<TresorerieDashboardPreview />)

    expect(screen.getByText('Solde bancaire')).toBeTruthy()
    expect(screen.getByText('Revenus du mois')).toBeTruthy()
    expect(screen.getByText('Dépenses du mois')).toBeTruthy()
    expect(screen.getByText('À encaisser')).toBeTruthy()

    expect(screen.getByText(`${mockTresorerieKPIs.soldeBancaire} €`)).toBeTruthy()
    expect(screen.getByText(`${mockTresorerieKPIs.revenusMensuels} €`)).toBeTruthy()
    expect(screen.getByText(`${mockTresorerieKPIs.depensesMensuelles} €`)).toBeTruthy()
    expect(screen.getByText(`${mockTresorerieKPIs.aEncaisser} €`)).toBeTruthy()

    expect(screen.getByText(`${Math.abs(mockTresorerieKPIs.trendRevenus)}%`)).toBeTruthy()
    expect(screen.getByText(`${Math.abs(mockTresorerieKPIs.trendDepenses)}%`)).toBeTruthy()

    await waitFor(() => {
      const visibleCards = container.querySelectorAll('.opacity-100.translate-y-0')
      expect(visibleCards.length).toBe(4)
    })

    const upIcons = container.querySelectorAll('[data-icon="ArrowUpRight"]')
    const downIcons = container.querySelectorAll('[data-icon="ArrowDownRight"]')
    expect(upIcons.length).toBe(1)
    expect(downIcons.length).toBe(1)

    const badges = screen.getAllByTestId('badge')
    const revenuBadge = badges.find(b => b.textContent?.includes(`${Math.abs(mockTresorerieKPIs.trendRevenus)}%`))
    const depenseBadge = badges.find(b => b.textContent?.includes(`${Math.abs(mockTresorerieKPIs.trendDepenses)}%`))
    expect(revenuBadge?.getAttribute('data-variant')).toBe('default')
    expect(depenseBadge?.getAttribute('data-variant')).toBe('destructive')
  })
})

describe('TresoreriePreviews - Revenus', () => {
  it('affiche la liste des revenus avec montants, dates et statuts, et s’anime en visible', async () => {
    const { container } = render(<TresorerieRevenusPreview />)

    expect(screen.getByText('Revenus')).toBeTruthy()

    for (const r of mockRevenus) {
      expect(screen.getByText(r.etablissement)).toBeTruthy()
      expect(screen.getByText(`${r.montant} €`)).toBeTruthy()
      expect(screen.getByText(r.date)).toBeTruthy()
    }

    expect(screen.getByText('Encaissé')).toBeTruthy()
    expect(screen.getByText('Facturé')).toBeTruthy()
    expect(screen.getByText('Prévu')).toBeTruthy()

    await waitFor(() => {
      const visibleRows = container.querySelectorAll('.opacity-100.translate-x-0')
      expect(visibleRows.length).toBe(mockRevenus.length)
    })

    const buildingIcons = container.querySelectorAll('[data-icon="Building2"]')
    expect(buildingIcons.length).toBe(mockRevenus.length)
  })
})

describe('TresoreriePreviews - Dépenses', () => {
  it('affiche la liste des dépenses avec catégories, montants négatifs et barres de progression', async () => {
    const { container } = render(<TresorerieDepensesPreview />)

    expect(screen.getByText('Dépenses')).toBeTruthy()

    for (const d of mockDepenses) {
      expect(screen.getByText(d.categorie)).toBeTruthy()
      expect(screen.getByText(d.nom)).toBeTruthy()
    }

    // Vérifie les montants négatifs avec robustesse vis-à-vis du DOM imbriqué
    const negativeAmountSpans = container.querySelectorAll('.text-sm.font-bold.text-destructive')
    expect(negativeAmountSpans.length).toBe(mockDepenses.length)
    negativeAmountSpans.forEach((el, idx) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
      expect(text).toContain('-')
      expect(text).toContain(`${mockDepenses[idx].montant} €`)
    })

    const total = mockDepenses.reduce((s, d) => s + d.montant, 0)
    expect(total).toBe(48300)

    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBe(mockDepenses.length)

    const [firstBar] = bars
    expect(firstBar.getAttribute('data-value')).toBe(String(mockDepenses[0].montant))
    expect(firstBar.getAttribute('data-max')).toBe(String(total))
    expect(firstBar.getAttribute('data-color')).toBe('destructive')

    await waitFor(() => {
      const visibleRows = container.querySelectorAll('.opacity-100.translate-x-0')
      expect(visibleRows.length).toBe(mockDepenses.length)
    })
  })
})