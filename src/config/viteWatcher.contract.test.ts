// @vitest-environment node
import { describe, expect, it } from 'vitest'

type ViteConfig = {
  server?: {
    watch?: {
      ignored?: string | string[]
    }
  }
}

describe('Vite watcher contract', () => {
  it('ignores browser-use archives without changing test discovery', async () => {
    const configFactory = (await import('../../vite.config.ts')).default
    const config = (
      typeof configFactory === 'function'
        ? configFactory({
            command: 'serve',
            mode: 'development',
            isPreview: false,
            isSsrBuild: false,
          })
        : configFactory
    ) as ViteConfig
    const ignored = config.server?.watch?.ignored

    expect(Array.isArray(ignored) ? ignored : [ignored]).toContain(
      '**/tests/browser-use/archive/**'
    )
  })
})
