import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/jarvis/JarvisPremiumPanel', () => ({
  JarvisPremiumPanel: () => <div data-testid="jarvis-panel" />,
}))
vi.mock('@/components/pwa/AppInstallPrompt', () => ({
  AppInstallPrompt: () => null,
}))

import MobileJarvisApp from '../MobileJarvisApp'

describe('MobileJarvisApp', () => {
  it('renders Jarvis panel', () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <MobileJarvisApp />
      </MemoryRouter>
    )
    expect(getByTestId('jarvis-panel')).toBeInTheDocument()
  })
})
