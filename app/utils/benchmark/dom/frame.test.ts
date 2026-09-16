import { describe, expect, it } from 'vitest'
import { createDomFrameSrcdoc } from './frame'
import { createSandboxHarness } from '../../../../tests/helpers/sandbox-frame'

const payload = {
  dependencies: [{ url: '/classic.js' }],
  setupHtml: '<p>fixture</p>',
  options: {
    async: false,
    code: 'if (DATA !== "<p>fixture</p>") throw new Error("Missing fixture")',
    dataCode: 'return document.body.innerHTML',
    targetBatchTime: 1,
    time: 1,
    warmupTime: 0,
  },
}

const harness = () => {
  let elapsed = 0

  return createSandboxHarness(createDomFrameSrcdoc(), { performance: { now: () => ++elapsed } })
}

describe('DOM benchmark frame', () => {
  it('accepts one job and one port only from its parent', async () => {
    const frame = harness()

    expect(frame.parent.postMessage).toHaveBeenCalledWith({ type: 'ready' }, '*')

    await frame.send(payload, {})
    await frame.send(payload, frame.parent, [])
    await frame.send(payload, frame.parent, [frame.port, frame.port])

    expect(frame.port.postMessage).not.toHaveBeenCalled()

    await frame.send(payload)
    await frame.send(payload)

    expect(frame.port.postMessage).toHaveBeenCalledOnce()
    expect(frame.port.close).toHaveBeenCalledOnce()
  })

  it('returns execution errors and closes the port', async () => {
    const frame = harness()

    await frame.send({
      ...payload,
      options: { ...payload.options, code: "throw new TypeError('setup failed')" },
    })

    expect(frame.port.postMessage).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ name: 'TypeError', message: 'setup failed' }),
    })

    expect(frame.port.close).toHaveBeenCalledOnce()
  })
})
