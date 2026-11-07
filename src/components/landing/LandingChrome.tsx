import Link from 'next/link'
import { LandingAuthNav } from './LandingAuthNav'
import { SvgDefs } from './SvgDefs'

export function LandingNav({ active }: { active?: 'home' | 'blog' }) {
  return (
    <>
      <SvgDefs />
      <header className="nav">
        <div className="wrap nav-in">
          <Link href="/" className="logo" aria-label="Yappply home">
            <svg className="logo-mark" viewBox="0 0 300 330" aria-hidden>
              <use href="#yappy" />
            </svg>
            Yappply
          </Link>
          <ul className="nav-links">
            <li>
              <a href={active === 'blog' ? '/#test' : '#test'}>Free test</a>
            </li>
            <li>
              <a href={active === 'blog' ? '/#how' : '#how'}>How it works</a>
            </li>
            <li>
              <a href={active === 'blog' ? '/#pricing' : '#pricing'}>Pricing</a>
            </li>
            <li>
              <Link href="/blog" aria-current={active === 'blog' ? 'page' : undefined}>
                Blog
              </Link>
            </li>
            <li>
              <a href={active === 'blog' ? '/#faq' : '#faq'}>FAQ</a>
            </li>
          </ul>
          <LandingAuthNav />
        </div>
      </header>
    </>
  )
}

export function LandingFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-top">
          <p style={{ maxWidth: '36ch' }}>
            Yappply helps you speak English with confidence, one 30-minute conversation at a time.
          </p>
          <nav aria-label="Footer">
            <a href="/#how">How it works</a>
            <a href="/#report">Your report</a>
            <a href="/#test">Free test</a>
            <a href="/#pricing">Pricing</a>
            <Link href="/blog">Blog</Link>
            <a href="/#faq">FAQ</a>
            <a href="mailto:hello@yappply.com">Contact</a>
          </nav>
        </div>
        <div className="wordmark" aria-hidden>
          Yapp<em>ply</em>
        </div>
        <div className="foot-base">
          <span>© 2026 Yappply</span>
          <span>Made for everyone who&apos;s ever frozen mid-sentence.</span>
        </div>
      </div>
    </footer>
  )
}
