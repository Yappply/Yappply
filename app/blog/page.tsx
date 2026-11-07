import type { Metadata } from 'next'
import { YappplyBlog } from '@/components/landing/YappplyBlog'

export const metadata: Metadata = {
  title: 'Blog — Yappply',
  description:
    'Short, practical notes on speaking English out loud: freezing less, correcting faster, and using your daily report.',
}

export default function BlogPage() {
  return <YappplyBlog />
}
