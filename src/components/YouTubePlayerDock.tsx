import { useEffect, useRef, type CSSProperties } from 'react'
import { Maximize2, Minimize2, Youtube } from 'lucide-react'
import { loadYouTubeIframeApi, type YouTubePlayer, type YouTubePlayerEvent, type YouTubePlayerReadyEvent } from '../services/youtube'

interface YouTubePlayerDockProps {
  videoId: string
  title: string
  compact: boolean
  onToggleCompact: () => void
  onReady: (player: YouTubePlayer) => void
  onStateChange: (player: YouTubePlayer, state: number) => void
  onError: (message: string) => void
}

export default function YouTubePlayerDock({ videoId, title, compact, onToggleCompact, onReady, onStateChange, onError }: YouTubePlayerDockProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const callbacksRef = useRef({ onReady, onStateChange, onError })
  callbacksRef.current = { onReady, onStateChange, onError }

  useEffect(() => {
    let disposed = false
    let player: YouTubePlayer | null = null

    loadYouTubeIframeApi()
      .then((YouTube) => {
        if (disposed || !hostRef.current) return
        const mount = document.createElement('div')
        hostRef.current.replaceChildren(mount)
        player = new YouTube.Player(mount, {
          width: '480',
          height: '270',
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event: YouTubePlayerReadyEvent) => {
              if (!disposed) callbacksRef.current.onReady(event.target)
            },
            onStateChange: (event: YouTubePlayerEvent) => {
              if (!disposed) callbacksRef.current.onStateChange(event.target, event.data)
            },
            onError: (event: YouTubePlayerEvent) => {
              if (!disposed) callbacksRef.current.onError(youtubeErrorMessage(event.data))
            },
          },
        })
      })
      .catch((error: unknown) => {
        if (!disposed) callbacksRef.current.onError(error instanceof Error ? error.message : 'YouTube’s player could not be loaded.')
      })

    return () => {
      disposed = true
      player?.destroy()
      hostRef.current?.replaceChildren()
    }
  }, [videoId])

  const sizing = { '--youtube-player-width': compact ? '200px' : 'min(480px, max(200px, calc(100vw - 28px)))' } as CSSProperties

  return (
    <aside className={`youtube-player-dock ${compact ? 'is-compact' : ''}`} style={sizing} aria-label="YouTube player">
      <div className="youtube-dock-heading">
        <span><Youtube size={15} /><span className="youtube-live-dot" /> Now playing on YouTube</span>
        <button type="button" className="youtube-size-button" onClick={onToggleCompact} aria-label={compact ? 'Expand YouTube player' : 'Make YouTube player compact'} title={compact ? 'Expand video' : 'Compact video'}>
          {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
      </div>
      <div className="youtube-video-viewport" ref={hostRef} />
      <div className="youtube-dock-caption" title={title}>{title}</div>
    </aside>
  )
}

function youtubeErrorMessage(code: number) {
  if (code === 2) return 'That YouTube link is invalid. Paste a video link and try again.'
  if (code === 5) return 'This video cannot play in the embedded YouTube player.'
  if (code === 100) return 'This YouTube video was removed or made private.'
  if (code === 101 || code === 150) return 'The video owner does not allow playback inside MusicVerse.'
  return 'YouTube could not play this video. It may be unavailable or restricted.'
}
