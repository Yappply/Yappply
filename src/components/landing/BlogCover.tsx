import type { BlogPost } from './blogPosts'

function Motif({ kind }: { kind: BlogPost['cover'] }) {
  switch (kind) {
    case 'mic':
      return (
        <g>
          <rect x="132" y="78" width="36" height="58" rx="18" fill="#fff" stroke="#16151F" strokeWidth="4" />
          <path d="M118 118c0 28 20 44 42 44s42-16 42-44" fill="none" stroke="#16151F" strokeWidth="4" strokeLinecap="round" />
          <path d="M160 162v18M140 180h40" stroke="#16151F" strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'star':
      return (
        <use href="#spark" x="120" y="70" width="80" height="80" style={{ color: '#DDF55B' }} />
      )
    case 'chart':
      return (
        <g stroke="#16151F" strokeWidth="4" strokeLinecap="round">
          <path d="M100 170V90M130 170V110M160 170V70M190 170V120" />
          <path d="M90 180h120" />
        </g>
      )
    case 'tie':
      return (
        <g>
          <path d="M160 70l18 22-18 18-18-18z" fill="#C9B8FF" stroke="#16151F" strokeWidth="4" />
          <path d="M142 110l18 70 18-70" fill="#FF8CC6" stroke="#16151F" strokeWidth="4" strokeLinejoin="round" />
        </g>
      )
    case 'ear':
      return (
        <g>
          <path
            d="M150 70c28 0 46 22 46 50s-14 54-40 54c-10 0-16-6-16-16 0-18 14-24 26-30 10-5 14-12 14-22 0-16-12-26-30-26-22 0-36 16-36 40"
            fill="#fff"
            stroke="#16151F"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="148" cy="118" r="8" fill="#FF8CC6" stroke="#16151F" strokeWidth="3" />
        </g>
      )
    case 'quote':
      return (
        <g fill="#16151F">
          <path d="M110 90h34v34c0 18-10 30-28 36l-8-14c10-4 16-10 16-20h-14z" />
          <path d="M176 90h34v34c0 18-10 30-28 36l-8-14c10-4 16-10 16-20h-14z" />
        </g>
      )
    case 'yappy':
      return <use href="#yappy" x="95" y="45" width="130" height="145" />
    case 'spark':
      return (
        <g>
          <use href="#spark" x="105" y="65" width="55" height="55" style={{ color: '#FF8CC6' }} />
          <use href="#spark" x="160" y="100" width="40" height="40" style={{ color: '#DDF55B' }} />
        </g>
      )
    case 'bubble':
    default:
      return (
        <g>
          <rect x="95" y="72" width="130" height="78" rx="28" fill="#fff" stroke="#16151F" strokeWidth="4" />
          <path d="M128 150l-18 28 40-20z" fill="#fff" stroke="#16151F" strokeWidth="4" strokeLinejoin="round" />
          <circle cx="135" cy="108" r="6" fill="#16151F" />
          <circle cx="160" cy="108" r="6" fill="#16151F" />
          <path d="M140 126c8 6 18 6 26 0" fill="none" stroke="#16151F" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      )
  }
}

export function BlogCover({ post }: { post: BlogPost }) {
  return (
    <svg viewBox="0 0 320 200" aria-hidden>
      <rect width="320" height="200" fill={post.tint} />
      <circle cx="250" cy="30" r="90" fill={post.circle} opacity="0.55" />
      <path d="M0 150c40-28 90-28 140 0s100 28 180 0v50H0z" fill="#fff" />
      <Motif kind={post.cover} />
    </svg>
  )
}
