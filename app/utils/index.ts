import { encode, decode } from 'js-base64'

export const getUrl = () => {
  if (!import.meta.client) return 'https://jsbenchmark.com'
  return window.location.href
}

export const serialize = (state: object) => {
  const string = JSON.stringify(state)
  const encoded = encode(string, true)
  return encoded
}

export const deserialize = (encoded: string) => {
  if (!encoded) return

  const string = decode(encoded)
  const state = JSON.parse(string)
  return state
}
