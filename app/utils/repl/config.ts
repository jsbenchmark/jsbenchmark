import type { Dependency } from '../../types'
import { DEFAULT_TEST_NAME } from '../constants'
import type { ReplConfig, ReplRuntime } from './types'

const DEFAULT_CODE = `console.log('Hello World!', { foo: 'bar' })

const value = await TIME('Wait', async () => {
  await new Promise((resolve) => setTimeout(resolve, 100))
  return 42
})

return { value }`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeRuntime = (value: unknown): ReplRuntime => (value === 'dom' ? 'dom' : 'worker')

const normalizeDependencies = (value: unknown): Dependency[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((dependency): Dependency[] => {
    if (!isRecord(dependency) || typeof dependency.url !== 'string') return []
    return [
      {
        url: dependency.url,
        name: typeof dependency.name === 'string' ? dependency.name : undefined,
        esm: dependency.esm === true,
      },
    ]
  })
}

export const createEmptyReplConfig = (): ReplConfig => ({
  name: '',
  runtime: 'worker',
  setupHtml: '',
  test: {
    id: 'repl',
    code: '',
    dependencies: [],
  },
})

export const createDefaultReplConfig = (): ReplConfig => {
  const config = createEmptyReplConfig()
  config.name = DEFAULT_TEST_NAME
  config.test.code = DEFAULT_CODE
  return config
}

export const normalizeReplConfig = (value: unknown): ReplConfig => {
  const defaults = createDefaultReplConfig()
  if (!isRecord(value)) return defaults

  const test = isRecord(value.test) ? value.test : {}
  return {
    name: typeof value.name === 'string' ? value.name : defaults.name,
    runtime: normalizeRuntime(value.runtime),
    setupHtml: typeof value.setupHtml === 'string' ? value.setupHtml : '',
    test: {
      id: 'repl',
      code: typeof test.code === 'string' ? test.code : defaults.test.code,
      dependencies: normalizeDependencies(test.dependencies),
    },
  }
}
