/** A readiness contract for route modules, media and future mode asset groups. */
export type AssetResource<T = unknown> = { id: string; load: (signal: AbortSignal) => Promise<T> }
export async function loadAssets<T>(resources: readonly AssetResource<T>[], signal: AbortSignal): Promise<T[]> {
  signal.throwIfAborted()
  let onAbort = () => {}
  const cancellation = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason ?? new DOMException('Loading cancelled', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([
      Promise.all(resources.map(resource => Promise.resolve().then(() => {
        signal.throwIfAborted()
        return resource.load(signal)
      }))), cancellation,
    ])
  } finally { signal.removeEventListener('abort', onAbort) }
}
