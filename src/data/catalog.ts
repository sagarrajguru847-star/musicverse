export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  artwork?: string
  audioUrl?: string
  localAudioId?: string
  youtubeVideoId?: string
  sourceUrl?: string
  licenseUrl?: string
  source: 'jamendo' | 'file' | 'youtube'
}

export interface Playlist {
  id: string
  name: string
  description: string
  tracks: Track[]
  hue: string
  source: 'local'
}

export interface Album {
  id: string
  title: string
  artist: string
  artwork?: string
  tracks: Track[]
  source: Track['source']
}

export const initialPlaylists: Playlist[] = []

export const artworkGradients: Record<string, string> = {
  violet: 'linear-gradient(145deg, #262a78 0%, #7241a4 48%, #f08ac5 100%)',
  blue: 'linear-gradient(145deg, #102a4e 0%, #278ba0 52%, #b6eecc 100%)',
  rose: 'linear-gradient(145deg, #673455 0%, #cf657b 53%, #f3c18c 100%)',
  amber: 'linear-gradient(145deg, #4b3219 0%, #c0733c 53%, #f4d486 100%)',
  green: 'linear-gradient(145deg, #143f3d 0%, #46917d 53%, #d8e29a 100%)',
}

export function normalizeJamendoTrack(raw: Record<string, unknown>): Track {
  const id = String(raw.id || '')
  return {
    id: `jamendo-${id}`,
    title: String(raw.name || 'Untitled track'),
    artist: String(raw.artist_name || 'Unknown artist'),
    album: String(raw.album_name || 'Single'),
    duration: Math.max(0, Math.floor(Number(raw.duration || 0))),
    artwork: typeof raw.image === 'string' ? raw.image : undefined,
    audioUrl: typeof raw.audio === 'string' ? raw.audio : undefined,
    sourceUrl: typeof raw.shorturl === 'string' ? raw.shorturl : undefined,
    licenseUrl: typeof raw.license_ccurl === 'string' ? raw.license_ccurl : undefined,
    source: 'jamendo',
  }
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
