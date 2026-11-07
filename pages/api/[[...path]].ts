import type { NextApiRequest, NextApiResponse } from 'next'
import { app, ensureReady } from '../../server/app.mjs'

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
}

export const maxDuration = 60

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureReady()
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Database unavailable'
    res.status(500).json({ error: message })
    return
  }

  app(req, res)
}
