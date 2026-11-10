export type MediaConfig = { entrance: string | null; idle: string | null; playIntro: string | null }

// Only same-origin website videos are accepted. Game/character paths cannot be
// pulled into the opening through an accidental manifest edit.
export function videoPath(value: unknown): string | null {
  return typeof value === 'string' && /^\/media\/website\/[\w/-]+\.mp4$/.test(value) ? value : null
}

export async function loadOpening(signal: AbortSignal): Promise<{ media: MediaConfig; fallback: boolean }> {
  const config = fetch('/media/website/media.json', { signal }).then(async response => {
    if (!response.ok) throw new Error('Media configuration unavailable')
    const data = await response.json()
    return { entrance: videoPath(data.entrance), idle: videoPath(data.idle), playIntro: videoPath(data.playIntro) }
  })
  const poster = new Promise<void>((resolve, reject) => {
    const image = new Image()
    const cleanup = () => { image.onload = null; image.onerror = null; signal.removeEventListener('abort', abort) }
    const abort = () => { cleanup(); image.src = ''; reject(new Error('Cancelled')) }
    image.onload = () => { cleanup(); resolve() }
    image.onerror = () => { cleanup(); reject(new Error('Poster unavailable')) }
    signal.addEventListener('abort', abort, { once: true })
    image.src = '/media/website/city-poster.svg'
  })
  const results = await Promise.allSettled([config, poster, document.fonts.ready])
  const media = results[0].status === 'fulfilled' ? results[0].value : { entrance: null, idle: null, playIntro: null }
  return { media, fallback: results.some(result => result.status === 'rejected') }
}
