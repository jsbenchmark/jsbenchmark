import { describe, expect, it } from 'vitest'
import { formatReplMarkdown } from './export'
import { deserialize } from '..'
import type { ReplConfig, ReplCompletedState } from './types'

const config: ReplConfig = {
  name: 'DOM investigation',
  runtime: 'dom',
  setupHtml: '<button id="target">Run</button>',
  test: {
    id: 'repl',
    code: "console.log('```')\nreturn document.querySelector('#target')",
    dependencies: [{ url: '/library.js', name: 'LIB', esm: true }],
  },
}

describe('formatReplMarkdown', () => {
  it('creates a reproducible report with code, output, console, and timings', () => {
    const state: ReplCompletedState = {
      status: 'success',
      config,
      output: {
        duration: 4.25,
        value: '<button id="target">Run</button>',
        logs: [{ level: 'log', time: 1.5, values: ['```', '{ ok: true }'] }],
        markers: [{ name: 'render', time: 0.5, duration: 2 }],
      },
    }

    const markdown = formatReplMarkdown(state, 'https://example.com/repl#state')
    const reproduction = new URL(markdown.match(/Reproduction: <([^>]+)>/)![1]!)

    expect(markdown).toContain('# DOM investigation')
    expect(markdown).toContain('Runtime: DOM')
    expect(reproduction.origin + reproduction.pathname).toBe('https://example.com/repl')
    expect(deserialize(reproduction.hash.slice(1))).toEqual({ config })

    expect(markdown).toContain('- `LIB` (ESM): /library.js')
    expect(markdown).toContain('````js\n' + config.test.code + '\n````')
    expect(markdown).toContain('```html\n' + config.setupHtml + '\n```')
    expect(markdown).toContain('Result')
    expect(markdown).toContain('1.500 ms [log] ``` { ok: true }')
    expect(markdown).toContain('render: 2.000 ms')
    expect(markdown).toContain('Total: 4.250 ms')
  })

  it('reports execution errors without requiring successful output', () => {
    const markdown = formatReplMarkdown(
      {
        config: { ...config, runtime: 'worker', setupHtml: '' },
        status: 'error',
        error: new TypeError('Nope'),
        output: { logs: [], markers: [] },
      },
      'https://example.com/repl'
    )

    expect(markdown).toContain('Runtime: Worker')
    expect(markdown).toContain('## Error')
    expect(markdown).toContain('TypeError: Nope')
    expect(markdown).not.toContain('## HTML fixture')
  })
})
