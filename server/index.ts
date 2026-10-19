import express from 'express'
import helmet from 'helmet'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (existsSync(path.resolve(process.cwd(), '.env'))) process.loadEnvFile()

const app = express()
const port = Number(process.env.PORT || 8787)

app.disable('x-powered-by')
app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.json({
    ok: true,
    jamendoMode: getJamendoConfig().mode,
  })
})

app.get('/api/music/catalog', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  const { clientId, mode } = getJamendoConfig()
  if (!clientId) {
    response.status(503).json({ error: 'Live music search is not configured. Add a Jamendo developer client ID to the server environment.' })
    return
  }

  const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : ''
  const parameters = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '18',
    imagesize: '200',
    audioformat: 'mp32',
    type: 'single albumtrack',
    include: 'licenses',
  })
  if (query) {
    parameters.set('search', query)
  } else {
    parameters.set('tags', 'relaxation')
    parameters.set('featured', '1')
  }

  try {
    const upstream = await fetch(`https://api.jamendo.com/v3.0/tracks/?${parameters}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!upstream.ok) {
      response.status(502).json({ error: `Live music search is temporarily unavailable (${upstream.status}).` })
      return
    }
    const payload = await upstream.json() as { results?: unknown[]; headers?: { status?: string; error_message?: string } }
    if (!Array.isArray(payload.results)) {
      response.status(502).json({ error: 'The music catalog returned an unexpected response.' })
      return
    }
    response.json({ tracks: payload.results, mode })
  } catch {
    response.status(502).json({ error: 'Could not reach the live music catalog. Check the server’s internet connection and try again.' })
  }
})

const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)
const projectDirectory = path.resolve(currentDirectory, '..')
const builtClient = path.join(projectDirectory, 'dist')

if (existsSync(builtClient)) {
  app.use(express.static(builtClient, { maxAge: '1h', index: false }))
  app.get('*splat', (_request, response) => response.sendFile(path.join(builtClient, 'index.html')))
}

app.listen(port, () => {
  console.log(`MusicVerse API listening on http://localhost:${port}`)
})

function getJamendoConfig(): { clientId: string; mode: 'configured' | 'unavailable' } {
  const configuredClientId = process.env.JAMENDO_CLIENT_ID?.trim()
  if (configuredClientId) return { clientId: configuredClientId, mode: 'configured' }
  return { clientId: '', mode: 'unavailable' }
}

