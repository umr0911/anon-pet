import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const gifPath = join(pkgDir, 'assets', 'anon.gif')
const MAX_UPLOAD = 20 * 1024 * 1024

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export function apply(ctx) {
  const creds = ctx.credentials
  const webServer = ctx.webServer

  let bundledGif = null
  readFile(gifPath).then((b) => { bundledGif = b }).catch(() => { bundledGif = null })

  // Serve the pet GIF (the bundled asset, which upload overwrites).
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/anon-pet/animation.gif',
    handler: (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
      const gif = bundledGif
      if (gif === null || gif === undefined) { res.writeHead(503, { 'retry-after': '1' }); res.end(); return }
      res.writeHead(200, { 'content-type': 'image/gif', 'content-length': String(gif.byteLength), 'cache-control': 'no-cache' })
      if (req.method === 'HEAD') { res.end(); return }
      res.end(gif)
    },
  }))

  // Upload a custom GIF (raw image/gif body), overwriting assets/anon.gif.
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/anon-pet/upload',
    handler: (req, res) => {
      if (req.method !== 'POST') { json(res, 405, { error: 'method-not-allowed' }); return }
      const chunks = []
      let size = 0
      req.on('data', (chunk) => { size += chunk.length; if (size <= MAX_UPLOAD) chunks.push(chunk) })
      req.on('end', async () => {
        if (size > MAX_UPLOAD) { json(res, 413, { error: '文件过大（上限 20MB）' }); return }
        try {
          const buf = Buffer.concat(chunks)
          if (buf.length < 6 || buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x38) {
            json(res, 400, { error: '不是有效的 GIF 文件' }); return
          }
          await mkdir(dirname(gifPath), { recursive: true })
          await writeFile(gifPath, buf)
          bundledGif = buf
          json(res, 200, { ok: true, bytes: buf.length })
        } catch (e) {
          json(res, 500, { error: e && e.message ? e.message : String(e) })
        }
      })
      req.on('error', () => {})
    },
  }))

  let keyCache = ''
  let keyLoaded = false
  const getKey = async () => {
    if (keyLoaded) return keyCache
    try {
      const r = await creds.resolve('DEEPSEEK_API_KEY')
      keyCache = r && r.value ? r.value : ''
    } catch (e) {
      keyCache = ''
    }
    keyLoaded = true
    return keyCache
  }

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/anon-pet/balance',
    handler: async (req, res) => {
      if (req.method !== 'GET') { json(res, 405, { error: 'method-not-allowed' }); return }
      try {
        const key = await getKey()
        if (!key) { json(res, 200, { error: '未找到 DeepSeek key' }); return }
        const resp = await fetch('https://api.deepseek.com/user/balance', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
        })
        const data = await resp.json()
        json(res, 200, data)
      } catch (e) {
        json(res, 200, { error: e && e.message ? e.message : String(e) })
      }
    },
  }))
}

export const inject = ['webServer', 'credentials']
