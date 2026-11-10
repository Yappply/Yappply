import dns from 'node:dns'
import mongoose from 'mongoose'

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1']

function looksLikePlaceholder(uri) {
  return (
    !uri ||
    uri.includes('<') ||
    uri.includes('>') ||
    uri.includes('USER:PASSWORD') ||
    uri.includes('<username>') ||
    uri.includes('<password>') ||
    uri.includes('<cluster>')
  )
}

/**
 * Connect to MongoDB Atlas.
 * Set a real MONGODB_URI in .env (not the placeholder with <username>/<cluster>).
 */
export async function connectDb(uri) {
  const wanted = (uri || '').trim()

  if (looksLikePlaceholder(wanted)) {
    throw new Error(
      'MONGODB_URI is still a placeholder. Open .env and paste your real Atlas connection string from ' +
        'Atlas → Database → Connect → Drivers. It should look like: ' +
        'mongodb+srv://myuser:mypass@cluster0.xxxxx.mongodb.net/speakora?retryWrites=true&w=majority',
    )
  }

  if (!wanted.startsWith('mongodb://') && !wanted.startsWith('mongodb+srv://')) {
    throw new Error(
      'MONGODB_URI must start with mongodb+srv:// (Atlas) or mongodb://. Check your .env file.',
    )
  }

  mongoose.set('strictQuery', true)
  try {
    await mongoose.connect(wanted, { serverSelectionTimeoutMS: 15000 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Windows DNS often refuses MongoDB SRV lookups. Public DNS can resolve them.
    if (!/querySrv|ECONNREFUSED|ENOTFOUND|ETIMEOUT|ESERVFAIL/.test(message)) throw err
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {})
    }
    dns.setServers(PUBLIC_DNS)
    await mongoose.connect(wanted, { serverSelectionTimeoutMS: 15000 })
  }
  console.log('MongoDB Atlas connected')
}
