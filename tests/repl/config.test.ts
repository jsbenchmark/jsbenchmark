import { describe, expect, it } from 'vitest'
import {
  createDefaultReplConfig,
  createEmptyReplConfig,
  normalizeReplConfig,
} from '../../app/utils/repl/config'

describe('REPL configuration', () => {
  it('uses Worker mode and an empty HTML fixture by default', () => {
    const config = createDefaultReplConfig()

    expect(config.runtime).toBe('worker')
    expect(config.setupHtml).toBe('')
  })

  it('normalizes existing shared links without runtime fields', () => {
    const config = normalizeReplConfig({
      name: 'Shared investigation',
      test: {
        code: 'return LIB.answer',
        dependencies: [{ url: '/lib.js', name: 'LIB', esm: true }],
      },
    })

    expect(config).toEqual({
      name: 'Shared investigation',
      runtime: 'worker',
      setupHtml: '',
      test: {
        id: 'repl',
        code: 'return LIB.answer',
        dependencies: [{ url: '/lib.js', name: 'LIB', esm: true }],
      },
    })
  })

  it('falls back safely for malformed fields while preserving valid DOM state', () => {
    expect(
      normalizeReplConfig({
        name: 42,
        runtime: 'window',
        setupHtml: null,
        test: { code: false, dependencies: [{ url: 42 }, { url: '/valid.js' }] },
      })
    ).toMatchObject({
      runtime: 'worker',
      setupHtml: '',
      test: { dependencies: [{ url: '/valid.js', name: undefined, esm: false }] },
    })

    expect(normalizeReplConfig({ runtime: 'dom', setupHtml: '<main></main>' })).toMatchObject({
      runtime: 'dom',
      setupHtml: '<main></main>',
    })
  })

  it('creates a blank configuration for Clear', () => {
    expect(createEmptyReplConfig()).toMatchObject({
      name: '',
      runtime: 'worker',
      setupHtml: '',
      test: { code: '', dependencies: [] },
    })
  })
})
