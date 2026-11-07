const TOKEN_KEY = 'speakora_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function clientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Auth headers for raw fetch calls (Gemini proxy, TTS, etc.). */
export function authHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('X-Client-Timezone')) {
    headers.set('X-Client-Timezone', clientTimeZone())
  }
  return headers
}

export class ApiError extends Error {
  status: number
  code?: string
  unlocksAt?: string | null
  constructor(message: string, status: number, code?: string, unlocksAt?: string | null) {
    super(message)
    this.status = status
    this.code = code
    this.unlocksAt = unlocksAt ?? null
  }
}

async function fetchOnce(
  path: string,
  options: RequestInit,
  headers: Headers,
): Promise<Response> {
  return fetch(path, { ...options, headers })
}

function isTransientStatus(status: number) {
  return status === 500 || status === 502 || status === 503 || status === 504
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.auth !== false) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('X-Client-Timezone')) {
    headers.set('X-Client-Timezone', clientTimeZone())
  }

  const maxAttempts = 4
  let res: Response | null = null
  let lastNetworkError = false

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      res = await fetchOnce(path, options, headers)
      lastNetworkError = false
      if (!isTransientStatus(res.status) || attempt === maxAttempts - 1) break
    } catch {
      lastNetworkError = true
      res = null
      if (attempt === maxAttempts - 1) break
    }
    await sleep(350 * (attempt + 1))
  }

  if (!res) {
    throw new ApiError(
      lastNetworkError
        ? 'Cannot reach the server. Check that npm run dev is running.'
        : 'Cannot reach the server. Try again in a moment.',
      503,
    )
  }

  const contentType = res.headers.get('Content-Type') || ''
  const isJson = contentType.includes('application/json')
  let data: { error?: string; code?: string; unlocksAt?: string | null } | null = null
  try {
    data = isJson ? await res.json() : null
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new ApiError(
      (data && typeof data.error === 'string' && data.error) ||
        (res.status >= 500
          ? 'Server is waking up — please try again'
          : `Request failed (${res.status})`),
      res.status,
      data?.code,
      data?.unlocksAt,
    )
  }
  return data as T
}
