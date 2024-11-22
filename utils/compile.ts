import { transpile } from 'typescript'

type CompileProps = {
  code: string
}

/**
 * Transpile TS code to JS.
 */
export function compile(props: CompileProps): string {
  return transpile(props.code, {
    target: 'ES2022',
    module: 'ESNext',
  })
}
