import type { Metadata } from 'next'
import { YappplyBlog } from '@/components/landing/YappplyBlog'

export const metadata: Metadata = {
  title: 'Blog — Yappply',
  description:
    'Guides on speaking English out loud: fluency, pronunciation, meetings, interviews, and daily practice.',
}

export default function BlogPage() {
  return <YappplyBlog />
}
