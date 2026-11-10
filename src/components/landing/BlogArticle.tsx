import type { ReactNode } from 'react'
import Link from 'next/link'
import { BlogCover } from './BlogCover'
import type { BlogBlock, BlogPost } from './blogPosts'
import { LandingFooter, LandingNav } from './LandingChrome'

function ArticleBody({ blocks }: { blocks: BlogBlock[] }) {
  const nodes: ReactNode[] = []
  let items: BlogBlock[] = []

  const flush = () => {
    if (items.length === 0) return
    const list = items
    items = []
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {list.map((item, index) => (
          <li key={`${index}-${item.text.slice(0, 32)}`}>{item.text}</li>
        ))}
      </ul>,
    )
  }

  blocks.forEach((block) => {
    if (block.t === 'li') {
      items.push(block)
      return
    }
    flush()
    if (block.t === 'h2') {
      nodes.push(<h2 key={`h-${nodes.length}`}>{block.text}</h2>)
      return
    }
    nodes.push(<p key={`p-${nodes.length}`}>{block.text}</p>)
  })
  flush()
  return nodes
}

export function BlogArticle({ post, blocks }: { post: BlogPost; blocks: BlogBlock[] }) {
  return (
    <div className="yappply">
      <LandingNav active="blog" />
      <main>
        <article className="section blog-article">
          <div className="wrap blog-article-wrap">
            <Link href="/blog" className="blog-back">
              All posts
            </Link>
            <div className="blog-article-cover" aria-hidden>
              <BlogCover post={post} />
            </div>
            <span className="pill">{post.category}</span>
            <h1>{post.title}</h1>
            <p className="blog-byline">
              {post.date} · {post.author} · {post.minutes} min read
            </p>
            <div className="blog-body">
              <ArticleBody blocks={blocks} />
            </div>
          </div>
        </article>
      </main>
      <LandingFooter />
    </div>
  )
}
