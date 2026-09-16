import { ref } from 'vue'
import { tryOnScopeDispose } from '@vueuse/core'
import type { ConfigurableWindow } from '@vueuse/core'
import { defaultWindow } from '@vueuse/core'
import createWorkerBlobUrl from './lib/createWorkerBlobUrl'
import type { Dependency } from '~/types'

export type WebWorkerStatus = 'PENDING' | 'SUCCESS' | 'RUNNING' | 'ERROR' | 'TIMEOUT_EXPIRED'

export interface UseWebWorkerOptions<Progress = unknown> extends ConfigurableWindow {
  /**
   * Number of milliseconds before killing the worker
   *
   * @default undefined
   */
  timeout?: number
  /**
   * An array that contains the external dependencies needed to run the worker
   */
  dependencies?: Dependency[]

  esm?: boolean

  onProgress?: (progress: Progress) => void
}

type WorkerMessage<Result, Progress> =
  ['PROGRESS', Progress] | ['SUCCESS', Result] | ['ERROR', unknown]

export function useWebWorkerFn<Args extends unknown[], Result, Progress = unknown>(
  fn: (...args: Args) => Result,
  options: UseWebWorkerOptions<Progress> = {}
) {
  const { dependencies = [], esm = false, onProgress, timeout, window = defaultWindow } = options
  const workerStatus = ref<WebWorkerStatus>('PENDING')
  let worker: Worker | undefined
  let workerUrl: string | undefined
  let timeoutId: number | undefined
  let rejectRun: ((error: unknown) => void) | undefined

  const workerTerminate = (status: WebWorkerStatus = 'PENDING') => {
    if (!worker && !workerUrl) return
    if (worker) {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }
    if (workerUrl) URL.revokeObjectURL(workerUrl)
    window?.clearTimeout(timeoutId)

    if (status === 'TIMEOUT_EXPIRED') rejectRun?.(new ErrorEvent('TIMEOUT_EXPIRED'))
    else if (status === 'PENDING')
      rejectRun?.(new DOMException('Worker execution canceled.', 'AbortError'))

    worker = undefined
    workerUrl = undefined
    rejectRun = undefined
    timeoutId = undefined
    workerStatus.value = status
  }

  tryOnScopeDispose(workerTerminate)

  const workerFn = (...args: Args): Promise<Awaited<Result>> => {
    if (workerStatus.value === 'RUNNING') {
      return Promise.reject(new Error('Only one worker execution can run at a time.'))
    }

    return new Promise((resolve, reject) => {
      rejectRun = reject
      try {
        workerUrl = createWorkerBlobUrl(fn, dependencies, esm)
        worker = new Worker(workerUrl, { type: esm ? 'module' : 'classic' })
        workerStatus.value = 'RUNNING'
        worker.onmessage = ({ data }: MessageEvent<WorkerMessage<Awaited<Result>, Progress>>) => {
          const [status, result] = data
          switch (status) {
            case 'PROGRESS':
              onProgress?.(result)
              break
            case 'SUCCESS':
              resolve(result)
              workerTerminate('SUCCESS')
              break
            default:
              reject(result)
              workerTerminate('ERROR')
              break
          }
        }
        worker.onerror = (error) => {
          reject(error)
          workerTerminate('ERROR')
        }
        if (timeout)
          timeoutId = window?.setTimeout(() => workerTerminate('TIMEOUT_EXPIRED'), timeout)
        worker.postMessage([args])
      } catch (error) {
        reject(error)
        workerTerminate('ERROR')
      }
    })
  }

  return { workerFn, workerStatus, workerTerminate }
}

export type UseWebWorkerFnReturn = ReturnType<typeof useWebWorkerFn>
