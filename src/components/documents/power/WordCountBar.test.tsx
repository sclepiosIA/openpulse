import { render, screen, act, cleanup } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { WordCountBar } from './WordCountBar'

type UpdateHandler = () => void

function makeFakeEditor(initialText: string) {
  let currentText = initialText
  const handlers: UpdateHandler[] = []
  const on = vi.fn((event: string, cb: UpdateHandler) => {
    if (event === 'update') handlers.push(cb)
  })
  const off = vi.fn((event: string, cb: UpdateHandler) => {
    if (event === 'update') {
      const idx = handlers.indexOf(cb)
      if (idx >= 0) handlers.splice(idx, 1)
    }
  })
  const editor = {
    state: {
      doc: {
        content: { size: 9999 },
        textBetween: (_from: number, _to: number, _sep: string) => currentText,
      },
    },
    on,
    off,
  }
  return {
    editor: editor as unknown as Editor,
    on,
    off,
    setText(next: string) {
      currentText = next
    },
    emitUpdate() {
      handlers.forEach((h) => h())
    },
  }
}

describe('WordCountBar', () => {
  afterEach(() => {
    cleanup()
  })

  it('affiche les valeurs par défaut quand editor est null', () => {
    render(<WordCountBar editor={null} />)
    expect(screen.getByText(/0 mots · 0 car\. \(0 sans esp\.\)/)).toBeTruthy()
    expect(screen.getByText('~ 1 page')).toBeTruthy()
    expect(screen.getByText(/1 min de lecture/)).toBeTruthy()
  })

  it('calcule les stats initiales à partir du texte de l’éditeur', () => {
    const fake = makeFakeEditor('hello world foo')
    render(<WordCountBar editor={fake.editor} />)
    // 3 mots, 15 caractères, 13 sans espaces
    expect(screen.getByText(/3 mots · 15 car\. \(13 sans esp\.\)/)).toBeTruthy()
    expect(screen.getByText('~ 1 page')).toBeTruthy()
    expect(screen.getByText(/1 min de lecture/)).toBeTruthy()
    expect(fake.on).toHaveBeenCalledWith('update', expect.any(Function))
  })

  it('met les stats à jour lors d’un événement update de l’éditeur', async () => {
    const fake = makeFakeEditor('un deux')
    render(<WordCountBar editor={fake.editor} />)
    expect(screen.getByText(/2 mots · 7 car\. \(6 sans esp\.\)/)).toBeTruthy()

    // 300 mots → 2 pages (300/250 arrondi sup.) et 2 min (300/220 arrondi sup.)
    const longText = Array.from({ length: 300 }, () => 'mot').join(' ')
    await act(async () => {
      fake.setText(longText)
      fake.emitUpdate()
    })

    expect(screen.getByText(/300 mots/)).toBeTruthy()
    expect(screen.getByText('~ 2 pages')).toBeTruthy()
    expect(screen.getByText(/2 min de lecture/)).toBeTruthy()
  })

  it('gère un texte vide ou composé uniquement d’espaces (0 mots, 1 page min)', async () => {
    const fake = makeFakeEditor('   ')
    render(<WordCountBar editor={fake.editor} />)
    // 0 mots car trim vide, 3 caractères, 0 sans espaces
    expect(screen.getByText(/0 mots · 3 car\. \(0 sans esp\.\)/)).toBeTruthy()
    expect(screen.getByText('~ 1 page')).toBeTruthy()
    expect(screen.getByText(/1 min de lecture/)).toBeTruthy()
  })

  it('désabonne le handler update au démontage', () => {
    const fake = makeFakeEditor('abc')
    const { unmount } = render(<WordCountBar editor={fake.editor} />)
    expect(fake.on).toHaveBeenCalledTimes(1)
    unmount()
    expect(fake.off).toHaveBeenCalledWith('update', expect.any(Function))
    const registered = fake.on.mock.calls[0][1]
    const removed = fake.off.mock.calls[0][1]
    expect(removed).toBe(registered)
  })

  it('n’écoute plus l’ancien éditeur après changement de prop', async () => {
    const first = makeFakeEditor('a b c')
    const second = makeFakeEditor('x y z w')
    const { rerender } = render(<WordCountBar editor={first.editor} />)
    expect(screen.getByText(/3 mots/)).toBeTruthy()

    rerender(<WordCountBar editor={second.editor} />)
    expect(first.off).toHaveBeenCalledWith('update', expect.any(Function))
    expect(screen.getByText(/4 mots/)).toBeTruthy()

    // Un update de l'ancien éditeur ne doit plus modifier l'affichage
    await act(async () => {
      first.setText('un seul texte tres long ici encore')
      first.emitUpdate()
    })
    expect(screen.getByText(/4 mots/)).toBeTruthy()
  })
})
