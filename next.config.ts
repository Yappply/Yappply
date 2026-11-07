import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    // Local `next dev` proxies to the Express process. Production (including
    // Vercel) serves the same Express app from pages/api, because nothing is
    // listening on 127.0.0.1:3001 there.
    if (process.env.NODE_ENV !== 'development') return []
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/api/:path*',
      },
    ]
  },
}

export default nextConfig
