import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  Disc3,
  ExternalLink,
  Heart,
  Headphones,
  Home,
  Library,
  ListMusic,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Upload,
  Volume2,
  X,
  Youtube,
} from 'lucide-react'
import ScrollDimensions from './components/ScrollDimensions'
const ImmersiveScene = lazy(() => import('./components/ImmersiveScene'))
import YouTubePlayerDock from './components/YouTubePlayerDock'
import {
  formatTime,
  initialPlaylists,
  normalizeJamendoTrack,
  type Album,
  type Playlist,
  type Track,
} from './data/catalog'
import { getLocalAudioBlob, listLocalAudioTracks, saveLocalAudioTrack } from './services/localAudio'
import { parseYouTubeVideoId, type YouTubePlayer } from './services/youtube'

type JamendoMode = 'checking' | 'configured' | 'unavailable'
type View = 'Overview' | 'Search' | 'Your library' | 'Playlists'
type LibraryMode = 'albums' | 'tracks'
const STORAGE_KEY = 'musicverse-playlists-v1'

function filterTracks(tracks: Track[], query: string) {
  const normalizedQuery = query.toLowerCase()
  if (!normalizedQuery) return tracks
  return tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(normalizedQuery))
}

function readSavedPlaylists(): Playlist[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialPlaylists
    const value = JSON.parse(saved) as Playlist[]
    if (!Array.isArray(value)) return initialPlaylists
    return value
      .map((playlist) => ({ ...playlist, tracks: playlist.tracks.filter((track) => !track.id.startsWith('demo-')) }))
      .filter((playlist) => !(['local-midnight', 'local-motion', 'local-blue-hour'].includes(playlist.id) && !playlist.tracks.length))
  } catch {
    return initialPlaylists
  }
}

function App() {
  const [view, setView] = useState<View>('Overview')
  const [localPlaylists, setLocalPlaylists] = useState<Playlist[]>(readSavedPlaylists)
  const [localAudioTracks, setLocalAudioTracks] = useState<Track[]>([])
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('albums')
  const [activePlaylistId, setActivePlaylistId] = useState('')
  const [jamendoMode, setJamendoMode] = useState<JamendoMode>('checking')
  const [jamendoLive, setJamendoLive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeTrack, setYoutubeTrack] = useState<Track | null>(null)
  const [youtubeReady, setYoutubeReady] = useState(false)
  const [youtubeCompact, setYoutubeCompact] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [volume, setVolume] = useState(0.72)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('musicverse-favorites-v1') || '[]') as string[] } catch { return [] }
  })
  const [reverseTrackOrder, setReverseTrackOrder] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [busyAction, setBusyAction] = useState(false)
  const [importingAudio, setImportingAudio] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistDescription, setPlaylistDescription] = useState('')
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const queueRef = useRef<Track[]>([])
  const searchCounter = useRef(0)
  const deferredSearch = useDeferredValue(searchQuery.trim())

  const allPlaylists = localPlaylists
  const activePlaylist = allPlaylists.find((playlist) => playlist.id === activePlaylistId) || localPlaylists[0]
  const hasLiveCatalog = jamendoLive
  const displayedTracks = useMemo(() => {
    const tracks = activePlaylist?.tracks || []
    return reverseTrackOrder ? [...tracks].reverse() : tracks
  }, [activePlaylist, reverseTrackOrder])
  const libraryTracks = useMemo(() => {
    const tracks = [...localAudioTracks, ...localPlaylists.flatMap((playlist) => playlist.tracks)]
    return tracks.filter((track, index) => tracks.findIndex((candidate) => candidate.id === track.id) === index)
  }, [localAudioTracks, localPlaylists])
  const libraryAlbums = useMemo(() => {
    const groups = new Map<string, Album>()
    for (const track of libraryTracks) {
      if (track.source === 'file' || track.source === 'youtube' || !track.album || track.album.toLowerCase() === 'imported audio') continue
      const key = `${track.artist.toLowerCase()}\u0000${track.album.toLowerCase()}`
      const album = groups.get(key) || {
        id: `album-${track.id}`,
        title: track.album,
        artist: track.artist,
        artwork: track.artwork,
        tracks: [],
        source: track.source,
      }
      album.tracks.push(track)
      groups.set(key, album)
    }
    return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title))
  }, [libraryTracks])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localPlaylists))
  }, [localPlaylists])

  useEffect(() => {
    if (!activePlaylistId && allPlaylists[0]) setActivePlaylistId(allPlaylists[0].id)
  }, [activePlaylistId, allPlaylists])

  useEffect(() => {
    localStorage.setItem('musicverse-favorites-v1', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    let live = true
    listLocalAudioTracks()
      .then((tracks) => { if (live) setLocalAudioTracks(tracks) })
      .catch((error: unknown) => { if (live) notify(error instanceof Error ? error.message : 'The local audio library could not be loaded.') })
    return () => { live = false }
  }, [])

  useEffect(() => () => {
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current)
  }, [])

  useEffect(() => {
    let live = true
    fetch('/api/health')
      .then((response) => response.json())
      .then((data: { jamendoMode?: JamendoMode }) => {
        if (live) setJamendoMode(data.jamendoMode || 'unavailable')
      })
      .catch(() => {
        if (live) setJamendoMode('unavailable')
      })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (jamendoMode === 'checking') {
      setSearchLoading(true)
      return
    }
    const requestNumber = ++searchCounter.current
    if (jamendoMode === 'unavailable') {
      setResults(filterTracks(localAudioTracks, deferredSearch))
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      const request = fetch(`/api/music/catalog${deferredSearch ? `?q=${encodeURIComponent(deferredSearch)}` : ''}`, { cache: 'no-store' })
          .then(async (response) => {
            const payload = await response.json() as { tracks?: Record<string, unknown>[]; error?: string }
            if (!response.ok) throw new Error(payload.error || 'Live catalog search failed.')
            return (payload.tracks || []).map(normalizeJamendoTrack).filter((track) => Boolean(track.audioUrl))
          })
      request.then((tracks) => {
          if (requestNumber === searchCounter.current) {
            setResults(tracks)
            setJamendoLive(true)
          }
        })
        .catch((error: unknown) => {
          if (requestNumber === searchCounter.current) {
            setResults(filterTracks(localAudioTracks, deferredSearch))
            notify(error instanceof Error ? error.message : 'Live music search could not be loaded.')
          }
        })
        .finally(() => { if (requestNumber === searchCounter.current) setSearchLoading(false) })
    }, deferredSearch ? 260 : 0)
    return () => window.clearTimeout(timer)
  }, [deferredSearch, jamendoMode, localAudioTracks])

  useEffect(() => {
    if (!youtubeReady || !youtubeTrack || currentTrack?.source !== 'youtube') return
    const syncYouTubePlayer = () => {
      const player = youtubePlayerRef.current
      if (!player) return
      const data = player.getVideoData()
      const videoId = data.video_id || youtubeTrack.youtubeVideoId
      const duration = player.getDuration() || 0
      const currentTime = player.getCurrentTime() || 0
      const state = player.getPlayerState()
      setPlaybackTime(currentTime)
      if (duration > 0) setPlaybackDuration(duration)
      if (state === 1 || state === 2 || state === 0) setIsPlaying(state === 1)
      if (videoId) {
        setCurrentTrack((track) => {
          if (track?.source !== 'youtube' || track.youtubeVideoId !== videoId) return track
          const title = data.title || track.title
          const artist = data.author || track.artist
          return track.title === title && track.artist === artist ? track : { ...track, title, artist }
        })
      }
    }
    syncYouTubePlayer()
    const interval = window.setInterval(syncYouTubePlayer, 500)
    return () => window.clearInterval(interval)
  }, [youtubeReady, youtubeTrack?.id, currentTrack?.id, currentTrack?.source])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 4200)
  }

  async function importAudioFiles(fileList: FileList | null) {
    const selectedFiles = Array.from(fileList || []).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac|webm)$/i.test(file.name))
    if (!selectedFiles.length) {
      if (fileList?.length) notify('Choose audio files such as MP3, M4A, WAV, or OGG.')
      return
    }

    setImportingAudio(true)
    const imported: Track[] = []
    let failedCount = 0
    for (const file of selectedFiles) {
      const filename = file.name.replace(/\.[^.]+$/, '').trim() || 'Untitled track'
      const parts = filename.split(/\s+-\s+/)
      const localAudioId = crypto.randomUUID()
      const track: Track = {
        id: `file-${localAudioId}`,
        localAudioId,
        title: parts.length > 1 ? parts.slice(1).join(' - ') : filename,
        artist: parts.length > 1 ? parts[0] : 'Your files',
        album: 'Imported audio',
        duration: await readAudioDuration(file),
        source: 'file',
      }
      try {
        await saveLocalAudioTrack(file, track)
        imported.push(track)
      } catch {
        failedCount += 1
      }
    }

    if (imported.length) {
      setLocalAudioTracks((tracks) => [...imported, ...tracks])
      setResults((tracks) => [...imported, ...tracks.filter((track) => !imported.some((item) => item.id === track.id))])
      setSearchQuery('')
      setView('Search')
      window.setTimeout(() => document.getElementById('search-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
    }
    setImportingAudio(false)
    if (failedCount) notify(`${imported.length} imported; ${failedCount} could not be saved. Check browser storage space and try again.`)
    else if (imported.length) notify(`${imported.length} real audio track${imported.length === 1 ? '' : 's'} imported into this browser.`)
  }

  function addYouTubeVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const videoId = parseYouTubeVideoId(youtubeUrl)
    if (!videoId) {
      notify('Paste a valid YouTube video link or 11-character video ID.')
      return
    }
    const track: Track = {
      id: `youtube-${videoId}`,
      youtubeVideoId: videoId,
      title: 'YouTube video',
      artist: 'YouTube',
      album: 'YouTube',
      artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0,
      source: 'youtube',
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }
    setYoutubeUrl('')
    setResults((tracks) => [track, ...tracks.filter((item) => item.id !== track.id)])
    setView('Search')
    void startTrack(track)
  }

  function onYouTubePlayerReady(player: YouTubePlayer) {
    youtubePlayerRef.current = player
    setYoutubeReady(true)
    player.setVolume(Math.round(volume * 100))
    player.playVideo()
  }

  function onYouTubePlayerStateChange(player: YouTubePlayer, state: number) {
    const data = player.getVideoData()
    const videoId = data.video_id || youtubeTrack?.youtubeVideoId
    if (videoId) {
      const title = data.title || 'YouTube video'
      const artist = data.author || 'YouTube'
      const activeTrack: Track = {
        id: `youtube-${videoId}`,
        youtubeVideoId: videoId,
        title,
        artist,
        album: 'YouTube',
        artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: player.getDuration() || 0,
        source: 'youtube',
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      }
      setCurrentTrack((track) => track?.id === activeTrack.id && track.title === title && track.artist === artist ? track : activeTrack)
      setPlaybackDuration(player.getDuration() || 0)
    }
    if (state === 1) {
      audioRef.current?.pause()
      setIsPlaying(true)
    } else if (state === 2) {
      setIsPlaying(false)
    } else if (state === 0) {
      setIsPlaying(false)
      if (queueRef.current.some((track) => track.id !== `youtube-${videoId}`)) void skipTrack('next')
    }
  }

  async function startTrack(track: Track, queue: Track[] = [track]) {
    queueRef.current = queue.length ? queue : [track]
    setCurrentTrack(track)
    setPlaybackTime(0)
    setPlaybackDuration(track.duration)
    if (track.source === 'youtube') {
      audioRef.current?.pause()
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current)
        audioObjectUrlRef.current = null
      }
      if (!track.youtubeVideoId) {
        setIsPlaying(false)
        notify('This YouTube track is missing its video link. Add it again from the search panel.')
        return
      }
      const sameVideo = youtubeTrack?.youtubeVideoId === track.youtubeVideoId
      setIsPlaying(false)
      setYoutubeTrack(track)
      if (sameVideo && youtubeReady && youtubePlayerRef.current) youtubePlayerRef.current.playVideo()
      else if (!sameVideo) {
        youtubePlayerRef.current = null
        setYoutubeReady(false)
      }
      return
    }
    if (track.source === 'jamendo' || track.source === 'file') {
      try {
        youtubePlayerRef.current?.pauseVideo()
        const audio = audioRef.current
        if (!audio) throw new Error('The browser audio player is not ready. Reload and try again.')
        audio.pause()
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current)
          audioObjectUrlRef.current = null
        }
        if (track.source === 'file') {
          if (!track.localAudioId) throw new Error('This imported track is missing from the local library.')
          const file = await getLocalAudioBlob(track.localAudioId)
          if (!file) throw new Error('This audio file is no longer saved in this browser. Import it again to play it.')
          audioObjectUrlRef.current = URL.createObjectURL(file)
          audio.src = audioObjectUrlRef.current
        } else {
          if (!track.audioUrl) throw new Error('This catalog track has no playable stream URL.')
          audio.src = track.audioUrl
        }
        audio.volume = volume
        setPlaybackDuration(track.duration)
        await audio.play()
        setIsPlaying(true)
      } catch (error) {
        setIsPlaying(false)
        notify(error instanceof Error ? error.message : 'This stream could not start. Try another track.')
      }
      return
    }
  }

  async function playAlbum(album: Album) {
    if (album.tracks[0]) await startTrack(album.tracks[0], album.tracks)
    else notify('This album does not have any playable tracks in the current library.')
  }

  async function togglePlayback() {
    if (!currentTrack) {
      const firstTrack = activePlaylist?.tracks[0]
      if (firstTrack) await startTrack(firstTrack)
      else notify('Choose a track to start listening.')
      return
    }
    if ((currentTrack.source === 'jamendo' || currentTrack.source === 'file') && audioRef.current) {
      try {
        if (audioRef.current.paused) await audioRef.current.play()
        else audioRef.current.pause()
        setIsPlaying(!audioRef.current.paused)
      } catch (error) {
        notify(error instanceof Error ? error.message : 'This stream could not resume. Try another track.')
      }
      return
    }
    if (currentTrack.source === 'youtube') {
      if (!youtubePlayerRef.current || !youtubeReady) {
        notify('The YouTube player is still loading. Use its Play button if playback does not start automatically.')
        return
      }
      if (youtubePlayerRef.current.getPlayerState() === 1) youtubePlayerRef.current.pauseVideo()
      else youtubePlayerRef.current.playVideo()
      return
    }
  }

  async function skipTrack(direction: 'next' | 'previous') {
    const tracks = queueRef.current.length ? queueRef.current : activePlaylist?.tracks || []
    const currentIndex = tracks.findIndex((track) => track.id === currentTrack?.id)
    const nextIndex = direction === 'next'
      ? (currentIndex + 1 + tracks.length) % tracks.length
      : (currentIndex - 1 + tracks.length) % tracks.length
    if (tracks.length > 1 || (tracks.length === 1 && tracks[0].id !== currentTrack?.id)) await startTrack(tracks[nextIndex], tracks)
    else if (tracks.length === 1 && tracks[0].source === 'youtube') notify('Add another track to this queue to skip from the YouTube video.')
    else if (tracks.length) await startTrack(tracks[nextIndex], tracks)
    else notify('Add a playable track to this playlist first.')
  }

  function selectPlaylist(playlist: Playlist) {
    setActivePlaylistId(playlist.id)
    setView('Playlists')
    document.getElementById('library-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submitNewPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = playlistName.trim()
    if (!name) return
    setBusyAction(true)
    const hue = ['violet', 'blue', 'rose', 'amber', 'green'][localPlaylists.length % 5]
    try {
      const playlist: Playlist = {
        id: `local-${crypto.randomUUID()}`,
        name,
        description: playlistDescription.trim() || 'A collection made in MusicVerse.',
        tracks: [],
        hue,
        source: 'local',
      }
      setLocalPlaylists((items) => [playlist, ...items])
      setActivePlaylistId(playlist.id)
      notify('Playlist created and saved in this browser.')
      setPlaylistName('')
      setPlaylistDescription('')
      setModalOpen(false)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Playlist could not be created.')
    } finally {
      setBusyAction(false)
    }
  }

  async function addTrack(track: Track) {
    if (!activePlaylist) {
      notify('Create a playlist to save this track.')
      setModalOpen(true)
      return
    }
    if (activePlaylist.tracks.some((item) => item.id === track.id)) {
      notify('This track is already in the selected playlist.')
      return
    }
    setLocalPlaylists((items) => items.map((playlist) => playlist.id === activePlaylist.id
      ? { ...playlist, tracks: [...playlist.tracks, track] }
      : playlist))
    notify(`Added to ${activePlaylist.name}.`)
  }

  function removeTrack(trackId: string) {
    if (!activePlaylist) return
    setLocalPlaylists((items) => items.map((playlist) => playlist.id === activePlaylist.id
      ? { ...playlist, tracks: playlist.tracks.filter((track) => track.id !== trackId) }
      : playlist))
  }

  function deleteActivePlaylist() {
    if (!activePlaylist) return
    setLocalPlaylists((items) => items.filter((playlist) => playlist.id !== activePlaylist.id))
    const next = localPlaylists.find((playlist) => playlist.id !== activePlaylist.id)
    setActivePlaylistId(next?.id || '')
    notify('Playlist removed from MusicVerse in this browser.')
  }

  function changeVolume(value: number) {
    setVolume(value)
    youtubePlayerRef.current?.setVolume(Math.round(value * 100))
    if (audioRef.current) audioRef.current.volume = value
  }

  function toggleFavorite() {
    if (!currentTrack) return notify('Choose a track first to save it as a favorite.')
    const wasFavorite = favorites.includes(currentTrack.id)
    setFavorites((items) => wasFavorite ? items.filter((id) => id !== currentTrack.id) : [...items, currentTrack.id])
    notify(wasFavorite ? 'Removed from MusicVerse favorites.' : 'Saved to MusicVerse favorites in this browser.')
  }

  function seek(value: number) {
    setPlaybackTime(value)
    if ((currentTrack?.source === 'jamendo' || currentTrack?.source === 'file') && audioRef.current) audioRef.current.currentTime = value
    else if (currentTrack?.source === 'youtube') youtubePlayerRef.current?.seekTo(value, true)
  }

  return (
    <div className="app-frame">
      <ScrollDimensions />
      <audio
        ref={audioRef}
        preload="none"
        hidden
        aria-hidden="true"
        onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime || 0)}
        onLoadedMetadata={(event) => setPlaybackDuration(event.currentTarget.duration || currentTrack?.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => { if (currentTrack?.source === 'jamendo' || currentTrack?.source === 'file') setIsPlaying(false) }}
        onEnded={() => void skipTrack('next')}
        onError={() => {
          if (currentTrack?.source === 'jamendo' || currentTrack?.source === 'file') {
            setIsPlaying(false)
            notify('This audio could not be played. Try another file or track.')
          }
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.webm"
        multiple
        hidden
        onChange={(event) => {
          const files = event.currentTarget.files
          void importAudioFiles(files)
          event.currentTarget.value = ''
        }}
      />
      <aside className="sidebar">
        <a className="brand" href="#top" onClick={() => setView('Overview')} aria-label="MusicVerse home">
          <span className="brand-mark"><AudioLines size={21} strokeWidth={2.2} /></span>
          <span>music<span className="brand-light">verse</span></span>
          <span className="brand-dot" />
        </a>

        <div className="side-caption">YOUR SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <NavButton icon={<Home size={18} />} label="Overview" active={view === 'Overview'} onClick={() => { setView('Overview'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
          <NavButton icon={<Search size={18} />} label="Search" active={view === 'Search'} onClick={() => { setView('Search'); document.getElementById('search-workspace')?.scrollIntoView({ behavior: 'smooth' }) }} />
          <NavButton icon={<Library size={18} />} label="Your library" active={view === 'Your library'} onClick={() => { setView('Your library'); document.getElementById('library-browser')?.scrollIntoView({ behavior: 'smooth' }) }} />
          <NavButton icon={<ListMusic size={18} />} label="Playlists" active={view === 'Playlists'} onClick={() => { setView('Playlists'); document.getElementById('library-workspace')?.scrollIntoView({ behavior: 'smooth' }) }} />
        </nav>

        <div className="side-section-head">
          <div className="side-caption">YOUR PLAYLISTS</div>
          <button className="icon-button side-add" aria-label="Create playlist" onClick={() => setModalOpen(true)}><Plus size={15} /></button>
        </div>
        <div className="sidebar-playlists">
          {localPlaylists.map((playlist) => (
            <button key={playlist.id} className={`side-playlist ${playlist.id === activePlaylistId ? 'is-selected' : ''}`} onClick={() => void selectPlaylist(playlist)}>
              <span className={`mini-cover cover-${playlist.hue}`}><Disc3 size={15} /></span>
              <span className="side-playlist-name">{playlist.name}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-orb"><Sparkles size={15} /></span>
            <div><strong>Your sound, reimagined.</strong><p>A little more room to feel it.</p></div>
          </div>
          <button className="profile-row" onClick={() => setModalOpen(true)}>
            <span className="profile-avatar">M</span><span><strong>My MusicVerse</strong><small>Personal space</small></span><Settings2 size={16} className="profile-settings" />
          </button>
        </div>
      </aside>

      <main className="main-column" id="top">
        <header className="topbar">
          <div className="topbar-arrows">
            <button className="icon-button" aria-label="Scroll to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowLeft size={17} /></button>
            <button className="icon-button" aria-label="Scroll to playlist manager" onClick={() => document.getElementById('library-workspace')?.scrollIntoView({ behavior: 'smooth' })}><ArrowRight size={17} /></button>
          </div>
          <label className="global-search">
            <Search size={17} />
            <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setView('Search') }} onFocus={() => { setView('Search'); document.getElementById('search-workspace')?.scrollIntoView({ behavior: 'smooth' }) }} placeholder="Search songs, artists, moods..." aria-label="Search music" />
            {searchQuery && <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')}><X size={15} /></button>}
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="import-audio-button" onClick={() => fileInputRef.current?.click()} disabled={importingAudio}>
              {importingAudio ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
              <span>{importingAudio ? 'Importing' : 'Import audio'}</span>
            </button>
            <button className="avatar-button" aria-label="Open profile" onClick={() => notify('Your MusicVerse workspace is saved in this browser.')}><span>M</span></button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="immersive-stage" aria-labelledby="hero-title">
            <div className="depth-sticky">
              <div className="hero-gradient" />
              <div className="depth-floor" />
              <Suspense fallback={null}><ImmersiveScene /></Suspense>
              <div className="depth-hud" aria-hidden="true">
                <span className="depth-hud-number" data-depth-number>01</span>
                <span className="depth-hud-copy"><small>SPATIAL SCROLL</small><strong data-depth-name>SURFACE</strong></span>
                <span className="depth-hud-track"><i /></span>
                <small className="depth-hud-total">04 / DEPTH</small>
              </div>
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-line" /> A NEW WAY TO FEEL YOUR MUSIC</div>
                <h1 id="hero-title">Your sound,<br /><em>in another</em> dimension.</h1>
                <p>Playlists that move with you.<br />A universe that moves with the music.</p>
                <div className="hero-actions">
                  <button className="button-primary" onClick={() => document.getElementById('library-workspace')?.scrollIntoView({ behavior: 'smooth' })}><span>Explore your space</span><ArrowDownRight size={16} /></button>
                  <button className="hero-play" onClick={() => {
                    const firstPlayable = results.find((track) => (track.source === 'jamendo' && track.audioUrl) || (track.source === 'file' && track.localAudioId)) || localAudioTracks[0]
                    if (firstPlayable) void startTrack(firstPlayable, results.length ? results : localAudioTracks)
                    else fileInputRef.current?.click()
                  }} aria-label="Import or play your music"><span><Play size={14} fill="currentColor" /></span><span><b>Take a listen</b><small>{results[0]?.title || localAudioTracks[0]?.title || 'Import a track to start'}</small></span></button>
                </div>
                <div className="hero-metric"><span className="metric-dot" /> YOUR MUSIC, WITH MORE DIMENSION <span className="metric-separator">/</span> <b>01 — ∞</b></div>
              </div>
              <div className="hero-aside"><span>SCROLL TO SHIFT</span><span className="aside-line" /><ArrowDownRight size={16} /></div>
              <div className="hero-index"><span data-depth-index>01</span> <span>/</span> 04</div>
              <div className="scene-caption"><span>FIG 01.</span> A SPACE BETWEEN SOUNDS</div>
            </div>
            <div className="stage-depth-label"><span>KEEP GOING</span><span>THE DEEPER YOU GO, THE CLOSER IT GETS</span></div>
          </section>

          <section className="welcome-row" aria-label="MusicVerse status">
            <div>
              <p className="section-kicker">YOUR PERSONAL SOUNDSPACE</p>
              <h2>{view === 'Overview' ? 'Good evening, music lover.' : view}</h2>
              <p className="welcome-subtitle">{view === 'Overview' ? 'The right track can change the whole atmosphere.' : 'Find a track, make a collection, and let it take shape.'}</p>
            </div>
            <div className={`mode-badge ${hasLiveCatalog || localAudioTracks.length ? 'mode-live' : ''}`}>
              <span className="mode-indicator" />
              {hasLiveCatalog ? 'LIVE MUSIC CATALOG' : jamendoMode === 'configured' ? 'CHECKING JAMENDO CATALOG' : localAudioTracks.length ? 'YOUR MUSIC IS READY' : 'READY FOR YOUR MUSIC'}
              <span className="mode-separator">·</span>
              {hasLiveCatalog ? 'JAMENDO STREAMS' : jamendoMode === 'configured' ? 'CATALOG NOT CONFIRMED' : localAudioTracks.length ? `${localAudioTracks.length} FILES · THIS BROWSER` : 'IMPORT AUDIO FILES'}
            </div>
          </section>

          <section className="rotation-section" aria-labelledby="rotation-title">
            <div className="section-heading">
              <div><div className="section-kicker"><span className="kicker-sparkle">✳</span> MADE FOR YOUR MOMENT</div><h2 id="rotation-title">In your rotation</h2></div>
              <button className="text-link" onClick={() => { setView('Playlists'); document.getElementById('library-workspace')?.scrollIntoView({ behavior: 'smooth' }) }}>View all <ArrowRight size={15} /></button>
            </div>
            <div className={`playlist-cards ${allPlaylists.length ? '' : 'playlist-cards-empty'}`}>
              {allPlaylists.slice(0, 4).map((playlist, index) => <PlaylistCard key={playlist.id} playlist={playlist} index={index} onClick={() => void selectPlaylist(playlist)} />)}
              {!allPlaylists.length && <div className="rotation-empty"><span className="empty-icon"><ListMusic size={19} /></span><span><strong>Your playlists live here.</strong><small>Create a playlist, then add tracks from your library or catalog.</small></span></div>}
              <button className="create-card" onClick={() => setModalOpen(true)}><span className="create-card-plus"><Plus size={18} /></span><span>Create a playlist</span><small>Set a mood. Start a world.</small></button>
            </div>
          </section>

          <section className="library-browser" id="library-browser" aria-labelledby="library-title">
            <div className="section-heading library-browser-heading">
              <div><div className="section-kicker"><span className="kicker-sparkle">✳</span> YOUR MUSIC, IN ONE PLACE</div><h2 id="library-title">Your library</h2><p className="library-subtitle">Browse albums and tracks you’ve saved or imported.</p></div>
              <div className="library-tabs" role="tablist" aria-label="Library view">
                <button role="tab" aria-selected={libraryMode === 'albums'} className={libraryMode === 'albums' ? 'is-active' : ''} onClick={() => setLibraryMode('albums')}><Disc3 size={14} /> Albums</button>
                <button role="tab" aria-selected={libraryMode === 'tracks'} className={libraryMode === 'tracks' ? 'is-active' : ''} onClick={() => setLibraryMode('tracks')}><ListMusic size={14} /> Tracks <span>{libraryTracks.length}</span></button>
              </div>
            </div>
            {libraryMode === 'albums' ? libraryAlbums.length ? (
              <div className="album-grid">
                {libraryAlbums.slice(0, 8).map((album, index) => <AlbumCard key={`${album.artist}-${album.title}`} album={album} index={index} onPlay={() => void playAlbum(album)} />)}
              </div>
            ) : (
              <div className="library-empty"><span className="empty-icon"><Disc3 size={20} /></span><div><strong>No album details in your library yet.</strong><p>Add catalog tracks to a playlist to browse album artwork here. Your imported files are in Tracks.</p></div><button className="text-link" onClick={() => setLibraryMode('tracks')}>View tracks <ArrowRight size={15} /></button></div>
            ) : libraryTracks.length ? (
              <div className="library-track-list">
                {libraryTracks.slice(0, 8).map((track, index) => <TrackRow key={track.id} track={track} index={index} current={currentTrack?.id === track.id} isPlaying={isPlaying && currentTrack?.id === track.id} onPlay={() => void startTrack(track, libraryTracks)} onAdd={() => void addTrack(track)} onRemove={() => {}} showRemove={false} />)}
              </div>
            ) : (
              <div className="library-empty"><span className="empty-icon"><Music2 size={20} /></span><div><strong>Your library is ready for music.</strong><p>Import audio files you own or search a configured catalog.</p></div><button className="text-link" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Import audio</button></div>
            )}
          </section>

          <section className="workspace-section" id="library-workspace">
            <div className="workspace-main">
              <div className="section-heading workspace-heading">
                <div><div className="section-kicker"><span className="kicker-sparkle">✳</span> THE COLLECTION</div><h2>{activePlaylist?.name || 'Your playlists'}</h2></div>
                <div className="workspace-heading-actions">
                  <button className="subtle-button" onClick={() => setModalOpen(true)}><Plus size={15} /> New playlist</button>
                  <button className="icon-button round-icon" aria-label={reverseTrackOrder ? 'Restore playlist order' : 'Reverse track order'} onClick={() => setReverseTrackOrder((value) => !value)}><ChevronDown size={15} className={reverseTrackOrder ? 'sort-reversed' : ''} /></button>
                </div>
              </div>
              <div className="collection-summary">
                <PlaylistArtwork playlist={activePlaylist} compact />
                <div className="collection-copy"><span className="collection-label">YOUR COLLECTION</span><h3>{activePlaylist?.description || (activePlaylist ? 'Make a little room for new favorites.' : 'Create your first playlist.')}</h3><p>{activePlaylist ? `${activePlaylist.tracks.length} tracks · Saved in this browser` : 'Your library is ready to fill'}</p></div>
                <button className="collection-play" aria-label="Play playlist" disabled={!activePlaylist?.tracks.length} onClick={() => activePlaylist?.tracks[0] && void startTrack(activePlaylist.tracks[0], displayedTracks)}><Play size={17} fill="currentColor" /></button>
              </div>
              <div className="track-table" aria-label="Playlist tracks">
                <div className="track-table-head"><span>#</span><span>TITLE</span><span>ALBUM</span><span><Disc3 size={14} /></span><span /></div>
                {displayedTracks.length ? displayedTracks.map((track, index) => (
                  <TrackRow key={track.id} track={track} index={index} current={currentTrack?.id === track.id} isPlaying={isPlaying && currentTrack?.id === track.id} onPlay={() => void startTrack(track, displayedTracks)} onAdd={() => void addTrack(track)} onRemove={() => removeTrack(track.id)} showRemove={activePlaylist.source === 'local'} />
                )) : (
                  <div className="empty-playlist"><span className="empty-icon"><Music2 size={20} /></span><div><strong>{activePlaylist ? 'This playlist is waiting for its first track.' : 'Start a collection of your own.'}</strong><p>{activePlaylist ? 'Search your library or catalog, then add tracks here.' : 'Create a playlist, then add tracks from your library or search.'}</p></div><button className="text-link" onClick={() => activePlaylist ? (setView('Search'), document.getElementById('search-workspace')?.scrollIntoView({ behavior: 'smooth' })) : setModalOpen(true)}>{activePlaylist ? 'Find music' : 'Create playlist'} <ArrowRight size={15} /></button></div>
                )}
              </div>
              <div className="playlist-management-row">
                  {!activePlaylist
                  ? <span>Create a playlist to organize your music</span>
                  : <button className="quiet-action danger-action" onClick={deleteActivePlaylist}><X size={14} /> Delete this playlist</button>}
                <span>Changes save automatically</span>
              </div>
            </div>

            <aside className="search-panel" id="search-workspace">
              <div className="search-panel-head">
                <div><div className="section-kicker">FIND YOUR NEXT FAVORITE</div><h3>Search music</h3></div>
                {searchLoading && <LoaderCircle size={15} className="spin search-spinner" />}
              </div>
              <label className="panel-search"><Search size={16} /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setView('Search') }} placeholder="Track, artist, album..." aria-label="Search catalog" /><kbd>/</kbd></label>
              <div className="search-context"><span className={`search-live-dot ${hasLiveCatalog || localAudioTracks.length ? 'live' : ''}`} />{hasLiveCatalog ? 'LIVE JAMENDO CATALOG' : jamendoMode === 'configured' ? 'CHECKING JAMENDO CATALOG' : localAudioTracks.length ? 'YOUR IMPORTED MUSIC' : 'IMPORT MUSIC TO SEARCH'} <span>·</span> {`ADD TO ${activePlaylist?.name || 'PLAYLIST'}`}</div>
              <form className="youtube-import-form" onSubmit={addYouTubeVideo}>
                <label htmlFor="youtube-link"><span><Youtube size={14} /> PLAY FROM YOUTUBE</span></label>
                <div className="youtube-link-row">
                  <input id="youtube-link" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="Paste a YouTube video link" aria-label="YouTube video link" />
                  <button type="submit" className="youtube-play-link"><Play size={13} fill="currentColor" /><span>Play</span></button>
                </div>
                <small>Played here, synced to the MusicVerse player. Separate YouTube tabs can’t be read by this page.</small>
              </form>
              <div className="search-results">
                {results.length ? results.slice(0, 8).map((track, index) => (
                  <div className="search-result" key={track.id}>
                    <button className="result-play" onClick={() => void startTrack(track, results)} aria-label={`Play ${track.title}`}><TrackArtwork track={track} index={index} /><span className="result-play-icon"><Play size={12} fill="currentColor" /></span></button>
                    <button className="result-copy" onClick={() => void startTrack(track, results)}><strong>{track.title}</strong><span>{track.artist}{track.source === 'jamendo' ? ' · Jamendo' : track.source === 'youtube' ? ' · YouTube' : ''}</span></button>
                    {track.sourceUrl && <a className="track-source-link" href={track.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} by ${track.artist} on ${track.source === 'youtube' ? 'YouTube' : 'Jamendo'}`}><ExternalLink size={13} /></a>}
                    <button className="add-track-button" aria-label={`Add ${track.title} to ${activePlaylist?.name || 'playlist'}`} onClick={() => void addTrack(track)} disabled={busyAction}><Plus size={15} /></button>
                  </div>
                )) : (
                  <div className="no-results"><Search size={18} /><span>{searchQuery ? 'No matching tracks found.' : localAudioTracks.length ? 'Your imported tracks will appear here.' : 'Import audio files you own to search and play them here.'}</span>{!localAudioTracks.length && !hasLiveCatalog && <button className="subtle-button" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Import audio</button>}</div>
                )}
              </div>
              <div className="search-footer"><span>{hasLiveCatalog ? 'Jamendo streams and YouTube videos can play; playlists stay in this browser.' : jamendoMode === 'configured' ? 'Jamendo credentials are present; live catalog access appears after a successful search.' : localAudioTracks.length ? 'Imported files stay on this device. Nothing is uploaded.' : 'Paste a YouTube link to play a video here, or import audio files you own.'}</span><button className="tiny-arrow" onClick={() => fileInputRef.current?.click()} aria-label="Import audio"><Upload size={15} /></button></div>
            </aside>
          </section>

          <section className="bottom-note">
            <div className="bottom-note-line" />
            <span>Made for the way music makes you feel.</span>
            <div className="bottom-note-right"><Headphones size={15} /> BEST EXPERIENCED WITH SOUND ON</div>
          </section>
        </div>
      </main>

      {youtubeTrack?.youtubeVideoId && <YouTubePlayerDock
        key={youtubeTrack.youtubeVideoId}
        videoId={youtubeTrack.youtubeVideoId}
        title={currentTrack?.source === 'youtube' ? currentTrack.title : youtubeTrack.title}
        compact={youtubeCompact}
        onToggleCompact={() => setYoutubeCompact((value) => !value)}
        onReady={onYouTubePlayerReady}
        onStateChange={onYouTubePlayerStateChange}
        onError={(message) => { setIsPlaying(false); notify(message) }}
      />}

      <footer className="player-bar" aria-label="Music player">
        <div className="now-playing">
          {currentTrack ? <TrackArtwork track={currentTrack} index={2} large /> : <div className="player-placeholder"><AudioLines size={19} /></div>}
          <div className="now-playing-copy"><strong>{currentTrack?.title || 'Find your first track'}</strong>{currentTrack?.source === 'jamendo' ? <span>{currentTrack.artist} · <a href={currentTrack.sourceUrl || 'https://www.jamendo.com'} target="_blank" rel="noreferrer">Jamendo source</a>{currentTrack.licenseUrl && <> · <a href={currentTrack.licenseUrl} target="_blank" rel="noreferrer">license</a></>}</span> : currentTrack?.source === 'file' ? <span>{currentTrack.artist} · MusicVerse local file</span> : currentTrack?.source === 'youtube' ? <span>{currentTrack.artist} · YouTube in MusicVerse</span> : <span>{currentTrack?.artist || 'Your sound is waiting'}</span>}</div>
          <button className={`player-heart ${currentTrack && favorites.includes(currentTrack.id) ? 'is-favorite' : ''}`} aria-label={currentTrack && favorites.includes(currentTrack.id) ? 'Remove favorite' : 'Save favorite'} onClick={toggleFavorite}><Heart size={16} fill={currentTrack && favorites.includes(currentTrack.id) ? 'currentColor' : 'none'} /></button>
        </div>
        <div className="player-controls">
          <div className="transport-controls">
            <button className="transport-secondary" aria-label="Previous track" onClick={() => void skipTrack('previous')}><SkipBack size={17} fill="currentColor" /></button>
            <button className="main-play-button" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={() => void togglePlayback()}>{isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
            <button className="transport-secondary" aria-label="Next track" onClick={() => void skipTrack('next')}><SkipForward size={17} fill="currentColor" /></button>
          </div>
          <div className="seek-row"><span>{formatTime(playbackTime)}</span><input aria-label="Playback position" type="range" min={0} max={playbackDuration || currentTrack?.duration || 100} value={Math.min(playbackTime, playbackDuration || currentTrack?.duration || 100)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(playbackDuration || currentTrack?.duration || 0)}</span></div>
        </div>
        <div className="player-right"><button className="player-queue" aria-label="Open current playlist" onClick={() => document.getElementById('library-workspace')?.scrollIntoView({ behavior: 'smooth' })}><ListMusic size={17} /></button><Volume2 size={17} /><input className="volume-slider" aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} /><span className="player-airplay"><AudioLines size={17} /></span></div>
      </footer>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false) }}>
        <form className="playlist-modal" onSubmit={(event) => void submitNewPlaylist(event)}>
          <button type="button" className="icon-button modal-close" aria-label="Close dialog" onClick={() => setModalOpen(false)}><X size={17} /></button>
          <div className="modal-icon"><ListMusic size={20} /></div>
          <div className="section-kicker">START WITH A FEELING</div>
          <h2>Create a playlist</h2>
          <p>Give this little corner of your sound a name.</p>
          <label className="modal-label">Playlist name<input autoFocus maxLength={60} value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="e.g. slow mornings" required /></label>
          <label className="modal-label">A few words about it <span>OPTIONAL</span><textarea maxLength={120} value={playlistDescription} onChange={(event) => setPlaylistDescription(event.target.value)} placeholder="For the moments when..." rows={3} /></label>
          <button type="submit" className="button-primary modal-submit" disabled={busyAction || !playlistName.trim()}>{busyAction ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}Create playlist</button>
          <div className="local-save-note"><Check size={13} /> Saves automatically in this browser</div>
        </form>
      </div>}
      {toast && <div className="toast-message" role="status"><span className="toast-icon"><AudioLines size={15} /></span>{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><X size={14} /></button></div>}
    </div>
  )
}

function NavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{active && <span className="nav-active-mark" />}</button>
}

function PlaylistCard({ playlist, index, onClick }: { playlist: Playlist; index: number; onClick: () => void }) {
  return (
    <button className={`playlist-card card-${playlist.hue}`} onClick={onClick}>
      <PlaylistArtwork playlist={playlist} />
      <span className="card-visual-no">0{index + 1}</span>
      <span className="card-art-copy"><small>YOUR MIX</small><strong>{playlist.name}</strong><span>{playlist.tracks.length} tracks <i>·</i> {playlist.description}</span></span>
      <span className="card-play"><Play size={14} fill="currentColor" /></span>
      <span className="card-line" />
    </button>
  )
}

function AlbumCard({ album, index, onPlay }: { album: Album; index: number; onPlay: () => void }) {
  const cover = album.tracks[0]
  return (
    <button className={`album-card album-card-${index % 5}`} onClick={onPlay} aria-label={`Play ${album.title} by ${album.artist}`}>
      <span className="album-card-cover">{album.artwork ? <img className="album-card-art-image" src={album.artwork} alt="" loading="lazy" /> : cover ? <TrackArtwork track={cover} index={index} /> : <span className="album-artwork-placeholder"><Disc3 size={30} /></span>}<span className="album-card-play"><Play size={17} fill="currentColor" /></span><span className="album-card-index">{String(index + 1).padStart(2, '0')}</span></span>
      <span className="album-card-copy"><strong>{album.title}</strong><small>{album.artist}</small><span>{album.tracks.length} {album.tracks.length === 1 ? 'track' : 'tracks'}</span></span>
    </button>
  )
}

function PlaylistArtwork({ playlist, compact = false }: { playlist?: Playlist; compact?: boolean }) {
  const hue = playlist?.hue || 'violet'
  return (
    <span className={`playlist-artwork cover-${hue} ${compact ? 'compact-art' : ''}`} aria-hidden="true">
      <span className="artwork-ring ring-one" /><span className="artwork-ring ring-two" /><span className="artwork-core"><Disc3 size={compact ? 28 : 38} strokeWidth={1.1} /></span>
      <span className="artwork-glow" />
    </span>
  )
}

function TrackArtwork({ track, index, large = false }: { track: Track; index: number; large?: boolean }) {
  if (track.artwork) return <span className={`track-art ${large ? 'art-large' : ''}`}><img src={track.artwork} alt="" loading="lazy" /></span>
  const colors = ['violet', 'blue', 'rose', 'amber', 'green']
  return <span className={`track-art cover-${colors[index % colors.length]} ${large ? 'art-large' : ''}`}><span className="track-art-orbit" /><Disc3 size={large ? 19 : 16} strokeWidth={1.2} /></span>
}

function TrackRow({ track, index, current, isPlaying, onPlay, onAdd, onRemove, showRemove }: {
  track: Track
  index: number
  current: boolean
  isPlaying: boolean
  onPlay: () => void
  onAdd: () => void
  onRemove: () => void
  showRemove: boolean
}) {
  return (
    <div className={`track-row ${current ? 'is-current' : ''}`}>
      <button className="track-number" onClick={onPlay} aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}>
        {isPlaying ? <AudioLines size={15} className="playing-equalizer" /> : current ? <Play size={13} fill="currentColor" /> : String(index + 1).padStart(2, '0')}
      </button>
      <button className="track-title-cell" onClick={onPlay}>
        <TrackArtwork track={track} index={index} />
        <span><strong>{track.title}</strong><small>{track.artist}{track.source === 'jamendo' ? ' · Jamendo' : track.source === 'file' ? ' · My files' : track.source === 'youtube' ? ' · YouTube' : ''}</small></span>
      </button>
      <span className="track-album">{track.album}</span>
      <span className="track-duration">{formatTime(track.duration)}</span>
      <div className="track-row-actions">{track.sourceUrl && <a className="track-source-link" href={track.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} on ${track.source === 'youtube' ? 'YouTube' : 'Jamendo'}`}><ExternalLink size={13} /></a>}<button className="track-add" aria-label={`Add ${track.title} to a playlist`} onClick={onAdd}><Plus size={15} /></button>{showRemove && <button className="track-remove" aria-label={`Remove ${track.title}`} onClick={onRemove}><X size={14} /></button>}</div>
    </div>
  )
}

function readAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const player = new Audio()
    const objectUrl = URL.createObjectURL(file)
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      const duration = Number.isFinite(player.duration) ? Math.floor(player.duration) : 0
      window.clearTimeout(timeout)
      player.removeAttribute('src')
      player.load()
      URL.revokeObjectURL(objectUrl)
      resolve(duration)
    }
    const timeout = window.setTimeout(finish, 5000)
    player.preload = 'metadata'
    player.addEventListener('loadedmetadata', finish, { once: true })
    player.addEventListener('error', finish, { once: true })
    player.src = objectUrl
    player.load()
  })
}

export default App
