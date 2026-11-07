/** Server-side Gemini key status (key itself never reaches the browser). */

export async function fetchApiStatus(): Promise<{ configured: boolean }> {
  try {
    const res = await fetch('/api/status', { cache: 'no-store' })
    if (!res.ok) return { configured: false }
    const data = (await res.json()) as { configured?: boolean }
    return { configured: Boolean(data.configured) }
  } catch {
    return { configured: false }
  }
}
