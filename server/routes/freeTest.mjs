import { Router } from 'express'
import { FreeTestLead } from '../models/FreeTestLead.mjs'
import { evaluateFreeTestWithGemini } from '../lib/evaluateFreeTest.mjs'
import { clientMeta } from '../middleware/auth.mjs'
import { resolveApiKey, transcribeAudio } from '../geminiApi.mjs'

const router = Router()

router.post('/evaluate', async (req, res) => {
  try {
    const topic = String(req.body?.topic || '').trim().slice(0, 200)
    let transcript = String(req.body?.transcript || '').trim().slice(0, 5000)
    const durationSec = 60
    const audioBase64 = String(req.body?.audioBase64 || '').trim()
    const mimeType = String(req.body?.mimeType || 'audio/webm').trim()

    if (!topic) {
      res.status(400).json({ error: 'Missing topic' })
      return
    }

    let asrModel = null
    if (audioBase64) {
      const apiKey = resolveApiKey(process.env)
      if (!apiKey) {
        res.status(503).json({ error: 'Speech-to-text is not configured' })
        return
      }
      try {
        const asr = await transcribeAudio(apiKey, {
          audioBase64,
          mimeType,
          languageCodes: ['en-US'],
        })
        transcript = String(asr.transcript || '').trim().slice(0, 12000)
        asrModel = asr.model
      } catch (err) {
        console.warn('Free-test transcription failed', err)
        res.status(502).json({
          error: 'Could not transcribe your speech. Please try again closer to the mic.',
        })
        return
      }
    }

    const { report, model } = await evaluateFreeTestWithGemini({
      topic,
      transcript,
      durationSec,
    })

    res.json({
      report,
      model,
      asrModel,
      heard: Boolean(transcript),
      transcript,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not build your report' })
  }
})

router.post('/leads', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const topic = String(req.body?.topic || '').trim().slice(0, 200)
    const transcript = String(req.body?.transcript || '').trim().slice(0, 5000)
    const durationSec = Math.max(5, Math.min(120, Number(req.body?.durationSec) || 60))
    const report = req.body?.report && typeof req.body.report === 'object' ? req.body.report : null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      res.status(400).json({ error: "That email doesn't look right" })
      return
    }
    if (!topic) {
      res.status(400).json({ error: 'Missing topic' })
      return
    }

    const meta = clientMeta(req)
    const lead = await FreeTestLead.create({
      email,
      topic,
      transcript,
      durationSec,
      report,
      overall: Number.isFinite(report?.overall) ? report.overall : undefined,
      level: String(report?.level || '').slice(0, 40),
      userAgent: meta.userAgent,
      ip: meta.ip,
    })

    res.status(201).json({
      ok: true,
      id: lead._id.toString(),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not save your email' })
  }
})

export default router
