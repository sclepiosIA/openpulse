/* @vitest-environment jsdom */

import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlassmorphismUnderlineTabs } from './glassmorphism-underline-tabs'

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | false | null>) => classes.filter(Boolean).join(' '),
}))

const { TABS, SINGLE_TAB } = vi.hoisted(() => ({
  TABS: [
    { value: 'overview', label: 'Overview', shortLabel: 'Over' },
    { value: 'details', label: 'Details', shortLabel: 'Det' },
    { value: 'settings', label: 'Settings' },
  ],
  SINGLE_TAB: [{ value: 'settings', label: 'Settings' }],
}))

describe('GlassmorphismUnderlineTabs', () => {
  it('renders container classes, all tab buttons, and active/inactive underline styles correctly', () => {
    const onValueChange = vi.fn()

    const { container } = render(
      <GlassmorphismUnderlineTabs
        tabs={TABS}
        value="details"
        onValueChange={onValueChange}
        className="custom-class"
      />
    )

    const root = container.firstElementChild
    expect(root).not.toBeNull()
    expect(root?.className).toContain('flex items-center gap-1 p-1 rounded-xl')
    expect(root?.className).toContain('custom-class')

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)

    const [overviewButton, detailsButton, settingsButton] = buttons

    expect(overviewButton).toHaveTextContent('Overview')
    expect(overviewButton).toHaveTextContent('Over')
    expect(detailsButton).toHaveTextContent('Details')
    expect(detailsButton).toHaveTextContent('Det')
    expect(settingsButton).toHaveTextContent('Settings')

    expect(overviewButton.className).toContain('text-white/60 hover:text-white/80')
    expect(detailsButton.className).toContain('text-white')
    expect(settingsButton.className).toContain('text-white/60 hover:text-white/80')

    const overviewUnderline = overviewButton.querySelectorAll('span')[2]
    const detailsUnderline = detailsButton.querySelectorAll('span')[2]
    const settingsUnderline = settingsButton.querySelectorAll('span')[2]

    expect(overviewUnderline?.className).toContain('w-0 bg-transparent')
    expect(detailsUnderline?.className).toContain('w-3/4 bg-card')
    expect(detailsUnderline?.className).toContain('shadow-[0_0_8px_rgba(255,255,255,0.6)]')
    expect(settingsUnderline?.className).toContain('w-0 bg-transparent')
  })

  it('calls onValueChange with the clicked tab value', () => {
    const onValueChange = vi.fn()

    render(
      <GlassmorphismUnderlineTabs tabs={TABS} value="overview" onValueChange={onValueChange} />
    )

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    fireEvent.click(buttons[2])

    expect(onValueChange).toHaveBeenNthCalledWith(1, 'details')
    expect(onValueChange).toHaveBeenNthCalledWith(2, 'settings')
    expect(onValueChange).toHaveBeenCalledTimes(2)
  })

  it('falls back to the full label when shortLabel is not provided', () => {
    const onValueChange = vi.fn()

    render(
      <GlassmorphismUnderlineTabs
        tabs={SINGLE_TAB}
        value="settings"
        onValueChange={onValueChange}
      />
    )

    const button = screen.getByRole('button')
    const spans = button.querySelectorAll('span')

    expect(spans).toHaveLength(3)
    expect(spans[0].textContent).toBe('Settings')
    expect(spans[1].textContent).toBe('Settings')
    expect(button.className).toContain('text-white')
    expect(spans[2].className).toContain('w-3/4 bg-card')
  })
})
