'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BlogCard } from './BlogCard'
import { BlogCover } from './BlogCover'
import { LandingFooter, LandingNav } from './LandingChrome'
import {
  BLOG_CATEGORIES,
  getFeaturedPost,
  getLibraryPosts,
  type BlogCategory,
} from './blogPosts'
import '@/styles/yappply.css'

export function YappplyBlog() {
  const featured = getFeaturedPost()
  const [category, setCategory] = useState<(typeof BLOG_CATEGORIES)[number]>('All')
  const [query, setQuery] = useState('')

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return getLibraryPosts().filter((p) => {
      if (category !== 'All' && p.category !== (category as BlogCategory)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    })
  }, [category, query])

  return (
    <div className="yappply">
      <LandingNav active="blog" />

      <main>
        <section className="section blog-hero">
          <div className="wrap blog-hero-grid">
            <div>
              <span className="pill dot">Blog</span>
              <h1>
                Short notes on speaking English <em className="s">out loud.</em>
              </h1>
              <p className="hero-sub">
                Guides on fluency, pronunciation, meetings, interviews, and speaking practice.
                Read them here on the page.
              </p>
            </div>
            <div className="blog-hero-mascot bobbing" aria-hidden>
              <svg viewBox="0 0 300 330">
                <use href="#yappy" />
              </svg>
              <span className="pill">Yappy is reading with you</span>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <Link href={`/blog/${featured.slug}`} className="blog-featured">
              <div className="blog-featured-cover" aria-hidden>
                <BlogCover post={featured} />
              </div>
              <div className="blog-featured-copy">
                <span className="pill">{featured.category}</span>
                <h2>{featured.title}</h2>
                <p>{featured.excerpt}</p>
                <span className="rt">{featured.minutes} min read</span>
              </div>
            </Link>

            <div className="blog-tools">
              <div className="blog-filters" role="group" aria-label="Filter by category">
                {BLOG_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`pill filter${category === c ? ' on' : ''}`}
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="blog-search">
                <span className="sr">Search posts</span>
                <input
                  type="search"
                  placeholder="Search posts"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>

            {posts.length === 0 ? (
              <p className="blog-empty">No posts match that filter. Try another category.</p>
            ) : (
              <div className="posts">
                {posts.map((post) => (
                  <article key={post.slug} id={post.slug}>
                    <BlogCard post={post} />
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="section blog-cta">
          <div className="wrap">
            <div className="blog-cta-card">
              <h2>
                Ready to practise, not just <em className="s">read?</em>
              </h2>
              <p>Take the free speaking test and see what native listeners would notice first.</p>
              <Link href="/#test" className="btn btn-lime">
                Test your English free
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    fill="none"
                    stroke="#16151F"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
