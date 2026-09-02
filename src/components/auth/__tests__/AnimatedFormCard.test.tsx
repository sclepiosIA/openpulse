import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimatedFormCard, AnimatedFormItem } from '../AnimatedFormCard'

describe('AnimatedFormCard', () => {
  it('renders children', () => {
    render(
      <AnimatedFormCard>
        <span>Hello</span>
      </AnimatedFormCard>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <AnimatedFormCard className="custom-class">
        <span>Test</span>
      </AnimatedFormCard>
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('reste une surface plate sans carte vitrée ni ombre', () => {
    const { container } = render(
      <AnimatedFormCard>
        <span>Content</span>
      </AnimatedFormCard>
    )
    expect(container.innerHTML).not.toMatch(/bg-gradient|backdrop-blur|shadow-(?:sm|md|lg|xl|2xl)/)
  })
})

describe('AnimatedFormItem', () => {
  it('renders children', () => {
    render(
      <AnimatedFormItem>
        <span>Item</span>
      </AnimatedFormItem>
    )
    expect(screen.getByText('Item')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <AnimatedFormItem className="my-class">
        <span>X</span>
      </AnimatedFormItem>
    )
    expect(container.firstChild).toHaveClass('my-class')
  })
})
