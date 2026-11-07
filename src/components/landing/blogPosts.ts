export type BlogCategory = 'Speaking' | 'Practice' | 'Mindset' | 'Reports' | 'Product'

export type BlogPost = {
  slug: string
  title: string
  category: BlogCategory
  minutes: number
  excerpt: string
  cover: 'bubble' | 'mic' | 'star' | 'chart' | 'tie' | 'ear' | 'quote' | 'yappy' | 'spark'
  tint: string
  circle: string
  featured?: boolean
}

export const BLOG_CATEGORIES: Array<BlogCategory | 'All'> = [
  'All',
  'Speaking',
  'Practice',
  'Mindset',
  'Reports',
  'Product',
]

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'why-speaking-feels-harder-than-listening',
    title: 'Why speaking feels harder than listening',
    category: 'Speaking',
    minutes: 4,
    excerpt:
      'You understand English. Then someone asks a question and your mind goes blank. Here’s what’s actually happening.',
    cover: 'bubble',
    tint: '#EEE8FF',
    circle: '#C9B8FF',
    featured: true,
  },
  {
    slug: 'the-15-second-think-trick',
    title: 'The 15-second think trick before you speak',
    category: 'Practice',
    minutes: 3,
    excerpt: 'A short pause is not failure. It’s how fluent speakers buy time without freezing.',
    cover: 'mic',
    tint: '#F4FBCF',
    circle: '#DDF55B',
  },
  {
    slug: 'stop-translating-in-your-head',
    title: 'Stop translating in your head',
    category: 'Mindset',
    minutes: 5,
    excerpt: 'Word-by-word translation is slow. Train yourself to answer with ready-made chunks instead.',
    cover: 'quote',
    tint: '#FFE3F1',
    circle: '#FF8CC6',
  },
  {
    slug: 'what-a-good-speaking-report-shows',
    title: 'What a good speaking report actually shows',
    category: 'Reports',
    minutes: 4,
    excerpt: 'Scores alone are not enough. You need the mistake, the fix, and what to practise next.',
    cover: 'chart',
    tint: '#EEE8FF',
    circle: '#C9B8FF',
  },
  {
    slug: 'filler-words-are-clues-not-crimes',
    title: 'Filler words are clues, not crimes',
    category: 'Speaking',
    minutes: 3,
    excerpt: '“Um” and “like” tell you where your planning breaks. Use them as signals, not shame.',
    cover: 'ear',
    tint: '#FFE3F1',
    circle: '#FF8CC6',
  },
  {
    slug: 'one-topic-a-day-beats-weekend-binges',
    title: 'One topic a day beats weekend binges',
    category: 'Practice',
    minutes: 3,
    excerpt: 'Thirty focused minutes daily builds speaking muscle faster than a three-hour Sunday cram.',
    cover: 'star',
    tint: '#F4FBCF',
    circle: '#DDF55B',
  },
  {
    slug: 'job-interview-english-without-scripts',
    title: 'Job interview English without scripts',
    category: 'Speaking',
    minutes: 6,
    excerpt: 'Scripts collapse under pressure. Practise answering the same prompt three different ways.',
    cover: 'tie',
    tint: '#EEE8FF',
    circle: '#C9B8FF',
  },
  {
    slug: 'how-yappy-corrects-without-killing-flow',
    title: 'How Yappy corrects without killing the flow',
    category: 'Product',
    minutes: 4,
    excerpt: 'A good correction is short, clear, and gives you one chance to say it again — then moves on.',
    cover: 'yappy',
    tint: '#F4FBCF',
    circle: '#DDF55B',
  },
  {
    slug: 'from-report-to-tomorrow-topic',
    title: 'From today’s report to tomorrow’s topic',
    category: 'Reports',
    minutes: 3,
    excerpt: 'Your report should point to one skill to watch. Tomorrow’s topic is where you practise it out loud.',
    cover: 'spark',
    tint: '#FFE3F1',
    circle: '#FF8CC6',
  },
]

export function getFeaturedPost() {
  return BLOG_POSTS.find((p) => p.featured) || BLOG_POSTS[0]
}

export function getTeaserPosts(count = 3) {
  return BLOG_POSTS.slice(0, count)
}
