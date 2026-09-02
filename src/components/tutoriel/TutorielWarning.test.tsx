import { render, screen } from '@testing-library/react'
import { TutorielWarning } from './TutorielWarning'

const { MockIcon } = vi.hoisted(() => ({
  MockIcon: () => <svg data-testid="alert-triangle-icon" />
}))

vi.mock('lucide-react', () => ({
  AlertTriangle: MockIcon
}))

describe('TutorielWarning', () => {
  it('affiche le titre "Attention" et le contenu fourni', () => {
    render(<TutorielWarning content="Veuillez vérifier vos informations." />)
    const title = screen.getByText('Attention')
    expect(title.textContent).toBe('Attention')

    const content = screen.getByText('Veuillez vérifier vos informations.')
    expect(content.textContent).toBe('Veuillez vérifier vos informations.')

    const icon = screen.getByTestId('alert-triangle-icon')
    expect(icon).toBeTruthy()
  })

  it('met à jour l’affichage lorsque la prop content change', () => {
    const { rerender } = render(<TutorielWarning content="Première info" />)
    expect(screen.getByText('Première info').textContent).toBe('Première info')

    rerender(<TutorielWarning content="Nouvelle information" />)
    expect(screen.getByText('Nouvelle information').textContent).toBe('Nouvelle information')
  })
})