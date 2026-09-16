import type { Dependency } from '../types'

// These functions are serialized into sandbox frames; keep their runtime dependencies local.
export async function prepareSandbox(
  payload: { setupHtml: string; dependencies: Dependency[] },
  importModule: (url: string) => Promise<Record<string, unknown>> = (url) =>
    Function('url', 'return import(url)')(url)
) {
  const globals: Record<string, unknown> = globalThis
  document.body.innerHTML = payload.setupHtml

  for (const [index, dependency] of payload.dependencies.entries()) {
    if (dependency.esm) {
      try {
        const namespace = await importModule(dependency.url)
        const name = dependency.name || `DEP_${index}`
        globals[name] =
          Object.keys(namespace).length === 1 && namespace.default ? namespace.default : namespace
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error'
        throw new Error(`Failed to load ESM dependency "${dependency.url}": ${message}`)
      }
      continue
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = dependency.url
      script.onload = () => resolve()
      script.onerror = () =>
        reject(new Error(`Failed to load classic dependency "${dependency.url}"`))
      document.head.append(script)
    })
  }
}

export type SerializedSandboxError = { name: string; message: string; stack?: string }

export function serializeSandboxError(error: unknown): SerializedSandboxError {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      ...(error.stack ? { stack: error.stack } : {}),
    }
  }
  return { name: 'Error', message: typeof error === 'string' ? error : 'Unknown error' }
}

export const deserializeSandboxError = (serialized: SerializedSandboxError) => {
  const error = new Error(serialized.message)
  error.name = serialized.name
  if (serialized.stack) error.stack = serialized.stack
  return error
}
