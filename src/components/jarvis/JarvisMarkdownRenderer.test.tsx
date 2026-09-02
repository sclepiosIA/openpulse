import React from 'react'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

const { cnStable, MockJarvisEntityReference } = vi.hoisted(() => {
  const cnStableImpl = (...classNames: unknown[]) =>
    classNames.filter(Boolean).join(' ')
  const MockComp = (props: { type: string; entityId: string; title: string }): ReactElement =>
    React.createElement(
      'span',
      { 'data-testid': 'entity-ref', 'data-type': props.type, 'data-id': props.entityId },
      props.title
    )
  return {
    cnStable: cnStableImpl,
    MockJarvisEntityReference: MockComp,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: cnStable,
}))

vi.mock('./JarvisEntityReference', () => ({
  JarvisEntityReference: MockJarvisEntityReference,
}))

import { JarvisMarkdownRenderer } from './JarvisMarkdownRenderer'

describe('JarvisMarkdownRenderer', () => {
  it('rend les paragraphes avec les classes de base et la classe personnalisée', () => {
    const { container } = render(
      <JarvisMarkdownRenderer content="Bonjour le monde" className="custom-class" />
    )
    const wrapper = container.querySelector('div')
    expect(wrapper).toBeTruthy()
    expect(wrapper?.className).toContain('prose')
    expect(wrapper?.className).toContain('custom-class')

    const p = container.querySelector('p')
    expect(p).toBeTruthy()
    expect(p?.textContent).toBe('Bonjour le monde')
  })

  it('remplace les références d’entité par le composant JarvisEntityReference mocké', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000'
    const content = `Voir [[task:${uuid}|Ma tâche]] s'il vous plaît.`
    const { container } = render(<JarvisMarkdownRenderer content={content} />)

    const ref = screen.getByTestId('entity-ref')
    expect(ref).toBeTruthy()
    expect(ref.getAttribute('data-type')).toBe('task')
    expect(ref.getAttribute('data-id')).toBe(uuid)
    expect(ref.textContent).toBe('Ma tâche')

    const paragraph = container.querySelector('p')
    expect(paragraph).toBeTruthy()
    // Le texte doit être correctement reconstruit autour de la référence
    expect(paragraph?.textContent).toBe(`Voir Ma tâche s'il vous plaît.`)
  })

  it('gère plusieurs références dans des éléments de liste', () => {
    const emailId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const contactId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const content = `- Élément [[email:${emailId}|Email]]
- Suivant [[contact:${contactId}|Contact]]`

    const { container } = render(<JarvisMarkdownRenderer content={content} />)

    const refs = screen.getAllByTestId('entity-ref')
    expect(refs.length).toBe(2)

    const ref1 = refs[0]
    expect(ref1.getAttribute('data-type')).toBe('email')
    expect(ref1.getAttribute('data-id')).toBe(emailId)
    expect(ref1.textContent).toBe('Email')

    const ref2 = refs[1]
    expect(ref2.getAttribute('data-type')).toBe('contact')
    expect(ref2.getAttribute('data-id')).toBe(contactId)
    expect(ref2.textContent).toBe('Contact')

    const items = Array.from(container.querySelectorAll('li')).map((li) =>
      li.textContent?.trim()
    )
    expect(items).toEqual(['Élément Email', 'Suivant Contact'])
  })

  it('laisse les placeholders bruts intacts s’il n’y a aucune référence extraite', () => {
    const content = 'Texte avec un placeholder %%ENTITYREF_0%% non résolu.'
    const { container } = render(<JarvisMarkdownRenderer content={content} />)
    const p = container.querySelector('p')
    expect(p).toBeTruthy()
    expect(p?.textContent).toBe('Texte avec un placeholder %%ENTITYREF_0%% non résolu.')
  })

  it('rend les liens avec les attributs externes attendus', () => {
    const content = 'Consultez [ce lien](https://example.com).'
    const { container } = render(<JarvisMarkdownRenderer content={content} />)
    const a = container.querySelector('a')
    expect(a).toBeTruthy()
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.getAttribute('target')).toBe('_blank')
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('rend les éléments code inline', () => {
    const content = 'Utilisez `monCode` dans votre script.'
    const { container } = render(<JarvisMarkdownRenderer content={content} />)
    const code = container.querySelector('code')
    expect(code).toBeTruthy()
    expect(code?.textContent).toBe('monCode')
    // Vérifie qu’une classe stylée est appliquée (indicatif de stylage)
    expect(code?.className).toContain('font-mono')
  })
})