import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Linkify, linkify } from './linkify'

describe('linkify', () => {
  it('returns an empty array for null, undefined and empty strings', () => {
    expect(linkify(null)).toEqual([])
    expect(linkify(undefined)).toEqual([])
    expect(linkify('')).toEqual([])
  })

  it('returns the original plain text when no link is detected', () => {
    expect(linkify('Texte simple sans lien')).toEqual(['Texte simple sans lien'])
  })

  it('renders http, https and www URLs as external links with the expected attributes', () => {
    const text = 'Avant www.example.com puis https://site.test/path?q=1, fin'

    render(<div data-testid="root">{linkify(text)}</div>)

    const root = screen.getByTestId('root')
    const links = root.querySelectorAll('a')

    expect(root.textContent).toBe(text)
    expect(links.length).toBe(2)

    const firstLink = links.item(0)
    expect(firstLink.textContent).toBe('www.example.com')
    expect(firstLink.getAttribute('href')).toBe('https://www.example.com')
    expect(firstLink.getAttribute('target')).toBe('_blank')
    expect(firstLink.getAttribute('rel')).toBe('noopener noreferrer')
    expect(firstLink.className).toBe('text-blue-600 hover:underline break-all')

    const secondLink = links.item(1)
    expect(secondLink.textContent).toBe('https://site.test/path?q=1')
    expect(secondLink.getAttribute('href')).toBe('https://site.test/path?q=1')
    expect(secondLink.getAttribute('target')).toBe('_blank')
    expect(secondLink.getAttribute('rel')).toBe('noopener noreferrer')
    expect(secondLink.className).toBe('text-blue-600 hover:underline break-all')
  })

  it('renders email addresses as mailto links without external-link attributes', () => {
    const text = 'Contact support@example.com ou admin.test+tag@sub-domain.example'

    render(<div data-testid="root">{linkify(text)}</div>)

    const root = screen.getByTestId('root')
    const links = root.querySelectorAll('a')

    expect(root.textContent).toBe(text)
    expect(links.length).toBe(2)

    const firstLink = links.item(0)
    expect(firstLink.textContent).toBe('support@example.com')
    expect(firstLink.getAttribute('href')).toBe('mailto:support@example.com')
    expect(firstLink.getAttribute('target')).toBeNull()
    expect(firstLink.getAttribute('rel')).toBeNull()

    const secondLink = links.item(1)
    expect(secondLink.textContent).toBe('admin.test+tag@sub-domain.example')
    expect(secondLink.getAttribute('href')).toBe('mailto:admin.test+tag@sub-domain.example')
    expect(secondLink.getAttribute('target')).toBeNull()
    expect(secondLink.getAttribute('rel')).toBeNull()
  })

  it('keeps trailing punctuation outside URL links', () => {
    const text = 'Voir https://example.com/path), puis www.example.org/test!'

    render(<div data-testid="root">{linkify(text)}</div>)

    const root = screen.getByTestId('root')
    const links = root.querySelectorAll('a')

    expect(root.textContent).toBe(text)
    expect(links.length).toBe(2)
    expect(links.item(0).textContent).toBe('https://example.com/path')
    expect(links.item(0).getAttribute('href')).toBe('https://example.com/path')
    expect(links.item(1).textContent).toBe('www.example.org/test')
    expect(links.item(1).getAttribute('href')).toBe('https://www.example.org/test')
  })

  it('stops click propagation on generated links', () => {
    const handleParentClick = vi.fn()

    render(
      <div onClick={handleParentClick}>
        <Linkify>Ouvrir https://example.com</Linkify>
      </div>
    )

    fireEvent.click(screen.getByRole('link', { name: 'https://example.com' }))

    expect(handleParentClick).not.toHaveBeenCalled()
  })
})

describe('Linkify', () => {
  it('renders the text children with detected links', () => {
    render(
      <p data-testid="paragraph">
        <Linkify>Envoyer à hello@example.com et visiter www.example.com</Linkify>
      </p>
    )

    const paragraph = screen.getByTestId('paragraph')
    const links = paragraph.querySelectorAll('a')

    expect(paragraph.textContent).toBe('Envoyer à hello@example.com et visiter www.example.com')
    expect(links.length).toBe(2)
    expect(links.item(0).getAttribute('href')).toBe('mailto:hello@example.com')
    expect(links.item(1).getAttribute('href')).toBe('https://www.example.com')
  })

  it('renders nothing for nullish children', () => {
    const { rerender } = render(
      <div data-testid="root">
        <Linkify>{null}</Linkify>
      </div>
    )

    expect(screen.getByTestId('root').textContent).toBe('')

    rerender(
      <div data-testid="root">
        <Linkify>{undefined}</Linkify>
      </div>
    )

    expect(screen.getByTestId('root').textContent).toBe('')
  })
})
