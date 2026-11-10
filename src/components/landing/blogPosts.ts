import meta from './blogMeta.json'

export type BlogCategory = 'Speaking' | 'Practice' | 'Mindset' | 'Product'

export type BlogCoverKind =
  | 'bubble'
  | 'mic'
  | 'star'
  | 'chart'
  | 'tie'
  | 'ear'
  | 'quote'
  | 'yappy'
  | 'spark'

export type BlogPost = {
  slug: string
  title: string
  category: BlogCategory
  minutes: number
  excerpt: string
  date: string
  author: string
  cover: BlogCoverKind
  tint: string
  circle: string
}

export type BlogBlock = {
  t: 'h2' | 'p' | 'li'
  text: string
}

export const BLOG_CATEGORIES: Array<BlogCategory | 'All'> = [
  'All',
  'Speaking',
  'Practice',
  'Mindset',
  'Product',
]

export const BLOG_POSTS = meta as BlogPost[]

/** The three posts shown in the landing-page blog section. */
export function getTeaserPosts(count = 3) {
  return BLOG_POSTS.slice(0, count)
}

/** Posts listed on /blog, after the landing-page teasers. */
export function getLibraryPosts() {
  return BLOG_POSTS.slice(3)
}

export function getFeaturedPost() {
  return getLibraryPosts()[0] ?? BLOG_POSTS[0]
}

export function getPostMeta(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug)
}
