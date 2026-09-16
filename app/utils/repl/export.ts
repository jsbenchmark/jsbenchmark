import type { ReplCompletedState } from './types'
import { serialize } from '../index'

const codeBlock = (language: string, content: string) => {
  const longestFence = Math.max(0, ...[...content.matchAll(/`+/g)].map((match) => match[0].length))
  const fence = '`'.repeat(Math.max(3, longestFence + 1))
  return `${fence}${language}\n${content}\n${fence}`
}

const duration = (value: number) => `${value.toFixed(3)} ms`

export const formatReplMarkdown = (state: ReplCompletedState, url: string) => {
  const { config } = state
  const reproduction = new URL(url)
  reproduction.hash = serialize({ config })
  const sections: string[] = [
    `# ${(config.name || 'Untitled investigation').replace(/\r?\n/g, ' ')}`,
    `Runtime: ${config.runtime === 'dom' ? 'DOM' : 'Worker'}\n\nReproduction: <${reproduction.href}>`,
  ]

  if (config.test.dependencies.length) {
    sections.push(
      `## Dependencies\n\n${config.test.dependencies
        .map(
          (dependency, index) =>
            `- \`${dependency.name || `DEP_${index}`}\`${dependency.esm ? ' (ESM)' : ''}: ${dependency.url}`
        )
        .join('\n')}`
    )
  }

  sections.push(`## JavaScript\n\n${codeBlock('js', config.test.code)}`)

  if (config.runtime === 'dom') {
    sections.push(`## HTML fixture\n\n${codeBlock('html', config.setupHtml)}`)
  }

  if (state.status === 'error') {
    sections.push(`## Error\n\n${codeBlock('text', `${state.error.name}: ${state.error.message}`)}`)
  } else {
    sections.push(`## Result\n\n${codeBlock('text', state.output.value)}`)
  }

  if (state.output.logs.length) {
    const consoleOutput = state.output.logs
      .map((entry) =>
        `${entry.time.toFixed(3)} ms [${entry.level}] ${entry.values.join(' ')}`.trimEnd()
      )
      .join('\n')
    sections.push(`## Console\n\n${codeBlock('text', consoleOutput)}`)
  }

  if (state.output.markers.length) {
    const timings = state.output.markers
      .map((marker) =>
        marker.duration === undefined
          ? `${marker.name}: marker at ${duration(marker.time)}`
          : `${marker.name}: ${duration(marker.duration)}`
      )
      .join('\n')
    sections.push(`## Timings\n\n${codeBlock('text', timings)}`)
  }

  if (state.status === 'success') {
    sections.push(`Total: ${duration(state.output.duration)}`)
  }

  return sections.join('\n\n')
}
