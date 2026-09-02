// @vitest-environment jsdom
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TutorielStep } from './TutorielStep'

const { tipSpy, warningSpy, screenshotSpy } = vi.hoisted(() => ({
  tipSpy: vi.fn(),
  warningSpy: vi.fn(),
  screenshotSpy: vi.fn(),
}))

vi.mock('./TutorielTip', () => ({
  TutorielTip: ({ content }: { content: string }) => {
    tipSpy(content)
    return <div data-testid="tutoriel-tip">{content}</div>
  },
}))

vi.mock('./TutorielWarning', () => ({
  TutorielWarning: ({ content }: { content: string }) => {
    warningSpy(content)
    return <div data-testid="tutoriel-warning">{content}</div>
  },
}))

vi.mock('./TutorielScreenshot', () => ({
  TutorielScreenshot: ({ src, alt, size }: { src: string; alt: string; size: string }) => {
    screenshotSpy({ src, alt, size })
    return <img data-testid="tutoriel-screenshot" src={src} alt={alt} data-size={size} />
  },
}))

vi.mock('lucide-react', () => ({
  ExternalLink: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="external-link-icon" {...props} />,
  Lightbulb: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="lightbulb-icon" {...props} />,
}))

describe('TutorielStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche les informations de base de l’étape et le numéro indexé à partir de 1', () => {
    const step = {
      title: 'Créer un devis',
      content: 'Renseignez les informations principales du devis.',
    }

    render(
      <TutorielStep
        step={step}
        index={1}
        moduleId="quotes"
        moduleIcon="file"
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Créer un devis' })).toBeInTheDocument()
    expect(screen.getByText('Renseignez les informations principales du devis.')).toBeInTheDocument()
    expect(screen.queryByTestId('tutoriel-tip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tutoriel-warning')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tutoriel-screenshot')).not.toBeInTheDocument()
    expect(screen.queryByTestId('lightbulb-icon')).not.toBeInTheDocument()
    expect(screen.queryByTestId('external-link-icon')).not.toBeInTheDocument()
  })

  it('affiche tout le contenu enrichi quand les données optionnelles sont fournies', () => {
    const step = {
      title: 'Configurer les montants',
      content: 'Ajoutez les postes puis vérifiez les totaux.',
      detailedContent: 'Étape 1 : ajoutez les lignes.\nÉtape 2 : validez les taxes.',
      example: 'Par exemple, ajoutez une ligne “Installation” puis une ligne “Maintenance”.',
      relatedLinks: [
        { href: 'https://example.test/aide-devis', label: 'Guide devis' },
        { href: 'https://example.test/taxes', label: 'Aide taxes' },
      ],
      screenshot: '/images/devis-step.png',
      screenshotAlt: 'Capture de configuration du devis',
      tip: 'Pensez à enregistrer un brouillon avant validation.',
      warning: 'Ne validez pas sans vérifier la TVA.',
    }

    render(
      <TutorielStep
        step={step}
        index={0}
        moduleId="quotes"
        moduleIcon="file"
      />
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Configurer les montants' })).toBeInTheDocument()
    expect(screen.getByText('Ajoutez les postes puis vérifiez les totaux.')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('Étape 1 : ajoutez les lignes.') && content.includes('Étape 2 : validez les taxes.'))).toBeInTheDocument()

    const exampleBlock = screen.getByText(/Exemple\s*:/i).closest('p')
    expect(exampleBlock).toBeInTheDocument()
    expect(exampleBlock).toHaveTextContent('Exemple : Par exemple, ajoutez une ligne “Installation” puis une ligne “Maintenance”.')
    expect(screen.getByTestId('lightbulb-icon')).toBeInTheDocument()

    const guideLink = screen.getByRole('link', { name: /Guide devis/i })
    const taxesLink = screen.getByRole('link', { name: /Aide taxes/i })

    expect(guideLink).toHaveAttribute('href', 'https://example.test/aide-devis')
    expect(guideLink).toHaveAttribute('target', '_blank')
    expect(guideLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(guideLink).getByTestId('external-link-icon')).toBeInTheDocument()

    expect(taxesLink).toHaveAttribute('href', 'https://example.test/taxes')
    expect(taxesLink).toHaveAttribute('target', '_blank')
    expect(taxesLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(taxesLink).getByTestId('external-link-icon')).toBeInTheDocument()

    expect(screen.getAllByTestId('external-link-icon')).toHaveLength(2)

    expect(screen.getByTestId('tutoriel-screenshot')).toHaveAttribute('src', '/images/devis-step.png')
    expect(screen.getByTestId('tutoriel-screenshot')).toHaveAttribute('alt', 'Capture de configuration du devis')
    expect(screen.getByTestId('tutoriel-screenshot')).toHaveAttribute('data-size', 'medium')
    expect(screenshotSpy).toHaveBeenCalledWith({
      src: '/images/devis-step.png',
      alt: 'Capture de configuration du devis',
      size: 'medium',
    })

    expect(screen.getByTestId('tutoriel-tip')).toHaveTextContent('Pensez à enregistrer un brouillon avant validation.')
    expect(screen.getByTestId('tutoriel-warning')).toHaveTextContent('Ne validez pas sans vérifier la TVA.')
    expect(tipSpy).toHaveBeenCalledWith('Pensez à enregistrer un brouillon avant validation.')
    expect(warningSpy).toHaveBeenCalledWith('Ne validez pas sans vérifier la TVA.')
  })

  it('utilise le titre comme alt du screenshot si screenshotAlt est absent', () => {
    const step = {
      title: 'Envoyer le document',
      content: 'Utilisez le bouton d’envoi.',
      screenshot: '/images/send-doc.png',
    }

    render(
      <TutorielStep
        step={step}
        index={2}
        moduleId="documents"
        moduleIcon="send"
      />
    )

    const screenshot = screen.getByTestId('tutoriel-screenshot')
    expect(screenshot).toHaveAttribute('src', '/images/send-doc.png')
    expect(screenshot).toHaveAttribute('alt', 'Envoyer le document')
    expect(screenshotSpy).toHaveBeenCalledWith({
      src: '/images/send-doc.png',
      alt: 'Envoyer le document',
      size: 'medium',
    })
  })

  it('n’affiche pas la section des liens connexes si relatedLinks est vide', () => {
    const step = {
      title: 'Finaliser',
      content: 'Relisez puis confirmez.',
      relatedLinks: [],
    }

    render(
      <TutorielStep
        step={step}
        index={0}
        moduleId="finalize"
        moduleIcon="check"
      />
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('external-link-icon')).not.toBeInTheDocument()
  })
})