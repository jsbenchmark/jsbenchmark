type CompileProps = {
  code: string
}

/**
 * Transpile TS code to JS.
 */
export async function compile(props: CompileProps): Promise<string> {
  const { transform } = await import('sucrase')

  const result = transform(props.code, {
    transforms: ['typescript'],
    disableESTransforms: true,
  })

  console.group('Code transformed')
  console.log('from')
  console.log(props.code)
  console.log('to')
  console.log(result.code)
  console.groupEnd()

  return result.code
}
