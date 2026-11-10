import Link from 'next/link'
import { BlogCover } from './BlogCover'
import type { BlogPost } from './blogPosts'

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="post">
      <div className="cover" aria-hidden>
        <BlogCover post={post} />
      </div>
      <div className="meta">
        <span className="pill">{post.category}</span>
        <h3>{post.title}</h3>
        <span className="rt">{post.minutes} min read</span>
      </div>
    </Link>
  )
}
