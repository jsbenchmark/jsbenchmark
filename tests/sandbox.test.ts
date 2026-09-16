import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  prepareSandbox,
  serializeSandboxError,
  deserializeSandboxError,
} from '../app/utils/sandbox'

afterEach(() => vi.unstubAllGlobals())

describe('prepareSandbox', () => {
  it('installs the fixture before loading classic and ESM dependencies in order', async () => {
    const events: string[] = []
    vi.stubGlobal('LIB', undefined)
    vi.stubGlobal('document', {
      body: {
        set innerHTML(value: string) {
          events.push(`fixture:${value}`)
        },
      },
      createElement: () => ({ src: '', onload: () => {} }),
      head: {
        append: (script: { src: string; onload: () => void }) => {
          events.push(`classic:${script.src}`)
          script.onload()
        },
      },
    })

    await prepareSandbox(
      {
        setupHtml: '<p>fixture</p>',
        dependencies: [{ url: '/first.js' }, { url: '/second.js', name: 'LIB', esm: true }],
      },
      async (url) => {
        events.push(`esm:${url}`)
        return { default: { version: 1 } }
      }
    )

    expect(events).toEqual(['fixture:<p>fixture</p>', 'classic:/first.js', 'esm:/second.js'])
    expect(Reflect.get(globalThis, 'LIB')).toEqual({ version: 1 })
  })

  it('assigns a deterministic fallback name and preserves named exports', async () => {
    vi.stubGlobal('DEP_0', undefined)
    vi.stubGlobal('document', { body: { innerHTML: '' } })
    const namespace = { named: true }

    await prepareSandbox(
      { setupHtml: '', dependencies: [{ url: '/module.js', esm: true }] },
      async () => namespace
    )

    expect(Reflect.get(globalThis, 'DEP_0')).toBe(namespace)
  })

  it.each([
    { kind: 'classic', esm: false },
    { kind: 'ESM', esm: true },
  ])('includes the URL when a $kind dependency fails', async ({ esm }) => {
    vi.stubGlobal('document', {
      body: { innerHTML: '' },
      createElement: () => ({ src: '', onerror: () => {} }),
      head: { append: (script: { onerror: () => void }) => script.onerror() },
    })

    await expect(
      prepareSandbox({ setupHtml: '', dependencies: [{ url: '/bad.js', esm }] }, async () => {
        throw new Error('network error')
      })
    ).rejects.toThrow('/bad.js')
  })
})

describe('sandbox errors', () => {
  it('round-trips error details without cloning Error objects', () => {
    const original = new TypeError('bad input')
    const serialized = serializeSandboxError(original)

    expect(serialized).toMatchObject({ name: 'TypeError', message: 'bad input' })
    expect(deserializeSandboxError(serialized)).toMatchObject({
      name: original.name,
      message: original.message,
      stack: original.stack,
    })
    expect(serializeSandboxError('nope')).toEqual({ name: 'Error', message: 'nope' })
  })
})
