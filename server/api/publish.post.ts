type WorkerResponse = {
  code: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const config = useRuntimeConfig(event)
  const data = await $fetch<WorkerResponse>(`${config.public.workerUrl}/api/shortcode`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return data
})
