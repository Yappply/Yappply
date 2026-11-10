import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogArticle } from '@/components/landing/BlogArticle'
import content from '@/components/landing/blogContent.json'
import { getPostMeta, type BlogBlock } from '@/components/landing/blogPosts'
import '@/styles/yappply.css'

type Article = {
  slug: string
  blocks: BlogBlock[]
}

const ARTICLES = content as Article[]

export function generateStaticParams() {
  return ARTICLES.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostMeta(slug)
  if (!post) return { title: 'Blog — Yappply' }
  return {
    title: `${post.title} — Yappply`,
    description: post.excerpt,
  }
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostMeta(slug)
  const article = ARTICLES.find((item) => item.slug === slug)
  if (!post || !article) notFound()
  return <BlogArticle post={post} blocks={article.blocks} />
}
