export interface YouTubeVideoData {
  video_id?: string
  title?: string
  author?: string
}

export interface YouTubePlayer {
  destroy(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getVideoData(): YouTubeVideoData
  loadVideoById(videoId: string): void
  pauseVideo(): void
  playVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setVolume(volume: number): void
}

export interface YouTubePlayerEvent {
  target: YouTubePlayer
  data: number
}

export interface YouTubePlayerReadyEvent {
  target: YouTubePlayer
}

export interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width: string
      height: string
      videoId: string
      playerVars?: Record<string, number | string>
      events?: {
        onReady?: (event: YouTubePlayerReadyEvent) => void
        onStateChange?: (event: YouTubePlayerEvent) => void
        onError?: (event: YouTubePlayerEvent) => void
      }
    },
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeNamespace> | undefined

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('YouTube’s player could not be loaded. Check your connection and try again.')), 15_000)
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      window.clearTimeout(timeout)
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('YouTube’s player loaded without its controls. Reload the page and try again.'))
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    if (existingScript) {
      existingScript.addEventListener('error', () => {
        window.clearTimeout(timeout)
        reject(new Error('YouTube’s player could not be loaded. Check your connection and try again.'))
      }, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timeout)
      reject(new Error('YouTube’s player could not be loaded. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })

  return apiPromise
}

export function parseYouTubeVideoId(value: string): string | null {
  const trimmed = value.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'youtu.be') return validId(url.pathname.split('/').filter(Boolean)[0])
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return null

    const videoId = url.searchParams.get('v')
      || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
    return validId(videoId)
  } catch {
    return null
  }
}

function validId(value: string | null | undefined) {
  return value && /^[\w-]{11}$/.test(value) ? value : null
}
