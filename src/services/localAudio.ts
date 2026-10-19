import type { Track } from '../data/catalog'

const DATABASE_NAME = 'musicverse-audio-library'
const STORE_NAME = 'tracks'
const DATABASE_VERSION = 1

interface StoredAudioTrack {
  id: string
  blob: Blob
  track: Track
}

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('This browser does not support a local audio library.'))
        return
      }
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('The local audio library could not be opened.'))
      request.onblocked = () => reject(new Error('Close other MusicVerse tabs and try opening the local audio library again.'))
    })
  }
  return databasePromise
}

export async function saveLocalAudioTrack(blob: Blob, track: Track) {
  const id = track.localAudioId
  if (!id) throw new Error('This imported track is missing its local audio ID.')
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({ id, blob, track } satisfies StoredAudioTrack)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('The audio file could not be saved in this browser.'))
    transaction.onabort = () => reject(transaction.error || new Error('Saving the audio file was cancelled.'))
  })
}

export async function listLocalAudioTracks(): Promise<Track[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result as StoredAudioTrack[]).map((entry) => entry.track))
    request.onerror = () => reject(request.error || new Error('The local audio library could not be read.'))
  })
}

export async function getLocalAudioBlob(id: string): Promise<Blob | undefined> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve((request.result as StoredAudioTrack | undefined)?.blob)
    request.onerror = () => reject(request.error || new Error('This saved audio file could not be opened.'))
  })
}
