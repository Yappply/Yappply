import Link from 'next/link'
import { BlogCard } from './BlogCard'
import { FreeSpeakingTest } from './FreeSpeakingTest'
import { HeroStage } from './HeroStage'
import { LandingFooter, LandingNav } from './LandingChrome'
import { getTeaserPosts } from './blogPosts'
import '@/styles/yappply.css'

const TOPICS = [
  'Introducing yourself',
  'Your daily routine',
  'Family and friends',
  'Likes and dislikes',
  'Your home and city',
  'Ordering food',
  'Shopping',
  'Asking for directions',
  'Making plans',
  'Hobbies',
  'Talking about the past',
  'Future plans',
  'Feelings',
  'Asking for help',
  'Giving opinions',
  'Small talk',
  'Phone calls',
  'Travel',
  'Work and studies',
  'Goals',
  'Telling a story',
  'Job interview',
]

export function YappplyLanding() {
  const teaserPosts = getTeaserPosts(3)

  return (
    <div className="yappply">
      <LandingNav active="home" />

      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="pill dot hero-eyebrow">
                <span className="hero-eyebrow-full">A new topic every day · 30 minutes with Yappy</span>
                <span className="hero-eyebrow-short">Daily · 30 min with Yappy</span>
              </span>
              <h1>
                You know English. Now start{' '}
                <span className="hl">
                  <em className="s">speaking</em>
                  <svg viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden>
                    <path
                      d="M4 20C60 6 140 4 296 14"
                      fill="none"
                      stroke="#DDF55B"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>{' '}
                it.
              </h1>
              <p className="hero-sub">
                Talk out loud with Yappy, your AI speaking buddy, for 30 minutes every day. You get
                corrected as you go, and after every call you get a full report on your grammar,
                clarity, pronunciation and vocabulary.
              </p>
              <div className="hero-ctas">
                <a href="#test" className="btn btn-lime">
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
                </a>
                <span className="price-hint">60 seconds · no signup to start</span>
              </div>
              <ul className="facts">
                <li className="pill">Live corrections</li>
                <li className="pill">Full report after every call</li>
                <li className="pill">Track your level</li>
              </ul>
            </div>
            <HeroStage />
          </div>
        </section>

        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <span key={copy}>
                Talk, don&apos;t memorise{' '}
                <svg style={{ color: '#DDF55B' }}>
                  <use href="#spark-flat" />
                </svg>{' '}
                <em>a new topic every day</em>{' '}
                <svg style={{ color: '#FF8CC6' }}>
                  <use href="#spark-flat" />
                </svg>{' '}
                Mistakes fixed on the spot{' '}
                <svg style={{ color: '#C9B8FF' }}>
                  <use href="#spark-flat" />
                </svg>{' '}
                <em>a full report after every call</em>{' '}
                <svg style={{ color: '#DDF55B' }}>
                  <use href="#spark-flat" />
                </svg>
              </span>
            ))}
          </div>
        </div>

        <FreeSpeakingTest />

        <section className="section">
          <div className="wrap">
            <div className="head">
              <span className="pill dot">Sound familiar?</span>
              <h2>
                Your English is fine. Speaking it is <em className="s">the hard part.</em>
              </h2>
            </div>
            <div className="feels">
              <article className="feel">
                <svg className="face" viewBox="0 0 64 64" aria-hidden>
                  <circle cx="32" cy="32" r="29" fill="#fff" stroke="#16151F" strokeWidth="3" />
                  <circle cx="23" cy="28" r="3.5" fill="#16151F" />
                  <circle cx="41" cy="28" r="3.5" fill="#16151F" />
                  <path d="M22 43h20" stroke="#16151F" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="49" cy="14" r="4" fill="#C9B8FF" stroke="#16151F" strokeWidth="2" />
                  <circle cx="56" cy="6" r="2.5" fill="#C9B8FF" stroke="#16151F" strokeWidth="2" />
                </svg>
                <q>I understand everything, but the words won&apos;t come out.</q>
                <p>You know the answer. You just can&apos;t say it in time.</p>
              </article>
              <article className="feel">
                <svg className="face" viewBox="0 0 64 64" aria-hidden>
                  <circle cx="32" cy="32" r="29" fill="#fff" stroke="#16151F" strokeWidth="3" />
                  <path
                    d="M18 27l7 3M46 27l-7 3"
                    stroke="#16151F"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22 44c6-5 14-5 20 0"
                    fill="none"
                    stroke="#16151F"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M50 10c4 2 6 6 5 10"
                    fill="none"
                    stroke="#16151F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <q>I translate in my head first.</q>
                <p>By the time the sentence is ready, the conversation has moved on.</p>
              </article>
              <article className="feel">
                <svg className="face" viewBox="0 0 64 64" aria-hidden>
                  <circle cx="32" cy="32" r="29" fill="#fff" stroke="#16151F" strokeWidth="3" />
                  <circle cx="23" cy="28" r="3.5" fill="#16151F" />
                  <circle cx="41" cy="28" r="3.5" fill="#16151F" />
                  <rect
                    x="20"
                    y="40"
                    width="24"
                    height="7"
                    rx="3.5"
                    fill="#FF8CC6"
                    stroke="#16151F"
                    strokeWidth="2.5"
                  />
                  <path d="M26 40v7M32 40v7M38 40v7" stroke="#16151F" strokeWidth="2" />
                </svg>
                <q>I stay quiet so I don&apos;t make a mistake.</q>
                <p>
                  In class, in meetings, in interviews, silence feels safer than wrong grammar.
                </p>
              </article>
              <article className="feel">
                <svg className="face" viewBox="0 0 64 64" aria-hidden>
                  <circle cx="32" cy="32" r="29" fill="#fff" stroke="#16151F" strokeWidth="3" />
                  <path
                    d="M18 30c3-3 7-3 10 0M36 30c3-3 7-3 10 0"
                    fill="none"
                    stroke="#16151F"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M24 43c5 3 11 3 16 0"
                    fill="none"
                    stroke="#16151F"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M8 20h8M10 14l4 2"
                    stroke="#16151F"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <q>I studied English for years but never spoke it.</q>
                <p>Grammar books and word lists don&apos;t prepare you for a real conversation.</p>
              </article>
            </div>
            <p className="punch">
              The fix isn&apos;t another course. It&apos;s <em className="s">practice</em>, every
              single day.
            </p>
          </div>
        </section>

        <section className="section how" id="how">
          <div className="wrap">
            <div className="head center">
              <span className="pill dot">How it works</span>
              <h2>
                One topic. 30 minutes. <em className="s">Every day.</em>
              </h2>
              <p>
                No videos, no grammar drills. Just you and Yappy, talking out loud about real-life
                situations.
              </p>
            </div>
            <ol className="steps">
              <li className="step">
                <span className="no" aria-hidden>
                  1
                </span>
                <div className="ill" style={{ background: 'var(--lilac-soft)' }} aria-hidden>
                  <svg viewBox="0 0 120 100">
                    <rect
                      x="18"
                      y="14"
                      width="84"
                      height="74"
                      rx="14"
                      fill="#fff"
                      stroke="#16151F"
                      strokeWidth="3.5"
                    />
                    <path d="M18 34h84" stroke="#16151F" strokeWidth="3.5" />
                    <path
                      d="M40 6v16M80 6v16"
                      stroke="#16151F"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <rect
                      x="34"
                      y="46"
                      width="52"
                      height="30"
                      rx="10"
                      fill="#DDF55B"
                      stroke="#16151F"
                      strokeWidth="3"
                    />
                    <text
                      x="60"
                      y="67"
                      textAnchor="middle"
                      fontFamily="Bricolage Grotesque,sans-serif"
                      fontWeight="800"
                      fontSize="16"
                      fill="#16151F"
                    >
                      Day 7
                    </text>
                  </svg>
                </div>
                <h3>Get today&apos;s topic</h3>
                <p>
                  A new real-life topic opens each day, from introducing yourself to job interviews.
                </p>
              </li>
              <li className="step">
                <span className="no" aria-hidden>
                  2
                </span>
                <div className="ill" style={{ background: 'var(--lime-soft)' }} aria-hidden>
                  <svg viewBox="0 0 120 100">
                    <rect
                      x="46"
                      y="10"
                      width="28"
                      height="48"
                      rx="14"
                      fill="#C9B8FF"
                      stroke="#16151F"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M34 44a26 26 0 0 0 52 0M60 70v16M46 88h28"
                      fill="none"
                      stroke="#16151F"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 36c-4 8-4 16 0 24M102 36c4 8 4 16 0 24"
                      fill="none"
                      stroke="#16151F"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <h3>Talk with Yappy for 30 minutes</h3>
                <p>
                  A real voice conversation in your browser. Yappy asks, listens, follows up and
                  keeps it going.
                </p>
              </li>
              <li className="step">
                <span className="no" aria-hidden>
                  3
                </span>
                <div className="ill" style={{ background: 'var(--pink-soft)' }} aria-hidden>
                  <svg viewBox="0 0 120 100">
                    <rect
                      x="10"
                      y="18"
                      width="70"
                      height="40"
                      rx="16"
                      fill="#fff"
                      stroke="#16151F"
                      strokeWidth="3.5"
                    />
                    <path d="M24 38h20" stroke="#B4235F" strokeWidth="4" strokeLinecap="round" />
                    <path d="M22 34l26 8" stroke="#16151F" strokeWidth="3" strokeLinecap="round" />
                    <rect
                      x="40"
                      y="50"
                      width="70"
                      height="38"
                      rx="16"
                      fill="#DDF55B"
                      stroke="#16151F"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M56 69l8 8 16-16"
                      fill="none"
                      stroke="#16151F"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3>Get corrected as you speak</h3>
                <p>
                  Make a mistake and Yappy shows you the right way, then lets you try again. Up to 3
                  tries.
                </p>
              </li>
              <li className="step">
                <span className="no" aria-hidden>
                  4
                </span>
                <div className="ill" style={{ background: 'var(--lilac-soft)' }} aria-hidden>
                  <svg viewBox="0 0 120 100">
                    <rect
                      x="26"
                      y="8"
                      width="68"
                      height="86"
                      rx="12"
                      fill="#fff"
                      stroke="#16151F"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M40 28h40M40 40h28"
                      stroke="#16151F"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <rect
                      x="38"
                      y="52"
                      width="10"
                      height="28"
                      rx="3"
                      fill="#C9B8FF"
                      stroke="#16151F"
                      strokeWidth="2.5"
                    />
                    <rect
                      x="55"
                      y="62"
                      width="10"
                      height="18"
                      rx="3"
                      fill="#FF8CC6"
                      stroke="#16151F"
                      strokeWidth="2.5"
                    />
                    <rect
                      x="72"
                      y="46"
                      width="10"
                      height="34"
                      rx="3"
                      fill="#DDF55B"
                      stroke="#16151F"
                      strokeWidth="2.5"
                    />
                  </svg>
                </div>
                <h3>Get your full report</h3>
                <p>
                  See your scores, your mistakes and how to fix them. Tomorrow, a new topic opens.
                </p>
              </li>
            </ol>
            <p className="rule">
              <span className="pill">One topic a day</span> Finish today&apos;s call and your next
              topic unlocks tomorrow.
            </p>
          </div>
        </section>

        <section className="section" id="report">
          <div className="wrap report-grid">
            <div>
              <span className="pill dot">After every call</span>
              <h2 style={{ marginTop: '1.2rem' }}>
                A full report on <em className="s">how you speak.</em>
              </h2>
              <p className="muted" style={{ fontSize: '1.18rem', marginTop: '1.1rem' }}>
                Not just &quot;good job&quot;. After each 30-minute session you see exactly what went
                well, what went wrong, and what to say instead.
              </p>
              <ul className="ticks">
                <li>
                  <div>
                    Scores for grammar, clarity, pronunciation and vocabulary
                    <span>So you know which skill needs the most work.</span>
                  </div>
                </li>
                <li>
                  <div>
                    Your top mistakes, with the right way to say them
                    <span>Taken from what you actually said in the call.</span>
                  </div>
                </li>
                <li>
                  <div>
                    Your current English speaking level
                    <span>Watch it move up as you practise.</span>
                  </div>
                </li>
              </ul>
              <Link href="/login" className="btn btn-lime">
                Get my first report
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

            <div
              className="report"
              role="img"
              aria-label="Example session report showing scores, level and corrected mistakes"
            >
              <svg
                className="star"
                viewBox="0 0 100 100"
                style={{ width: 56, color: '#FF8CC6', position: 'absolute' }}
                aria-hidden
              >
                <use href="#spark" />
              </svg>
              <div className="rep-top">
                <div>
                  <small>Day 7 · Job interview · 30 min</small>
                  <b>Session report</b>
                </div>
                <div className="level">
                  <small>Your level</small>
                  <b>Intermediate</b>
                </div>
              </div>
              <div className="scores">
                {(
                  [
                    { label: 'Grammar', score: 74, dash: 113, track: '#EEE8FF', stroke: '#C9B8FF' },
                    { label: 'Clarity', score: 85, dash: 128, track: '#F4FBCF', stroke: '#B9D334' },
                    {
                      label: 'Pronunciation',
                      score: 69,
                      dash: 104,
                      track: '#FFE3F1',
                      stroke: '#FF8CC6',
                    },
                    {
                      label: 'Vocabulary',
                      score: 78,
                      dash: 118,
                      track: '#EEE8FF',
                      stroke: '#16151F',
                    },
                  ] as const
                ).map((s) => (
                  <div className="score" key={s.label}>
                    <svg viewBox="0 0 60 60">
                      <circle
                        cx="30"
                        cy="30"
                        r="24"
                        fill="none"
                        stroke={s.track}
                        strokeWidth="7"
                      />
                      <circle
                        cx="30"
                        cy="30"
                        r="24"
                        fill="none"
                        stroke={s.stroke}
                        strokeWidth="7"
                        strokeDasharray={`${s.dash} 151`}
                        strokeLinecap="round"
                        transform="rotate(-90 30 30)"
                      />
                      <text
                        x="30"
                        y="35"
                        textAnchor="middle"
                        fontFamily="Bricolage Grotesque,sans-serif"
                        fontWeight="800"
                        fontSize="15"
                        fill="#16151F"
                      >
                        {s.score}
                      </text>
                    </svg>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="mist-h">
                Top mistakes <span>3 of 7</span>
              </div>
              <div className="mist">
                <div>
                  <s>I was work</s> in a bank → <b>I worked</b> in a bank
                  <small>Grammar · past simple</small>
                </div>
                <div>
                  <s>I am working here since 2022</s> → <b>I have been working</b> here since 2022
                  <small>Grammar · present perfect</small>
                </div>
                <div>
                  <s>very much hard</s> → <b>really hard</b> / <b>very difficult</b>
                  <small>Vocabulary · natural phrasing</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: '1rem' }}>
          <div className="wrap">
            <div className="dash-wrap">
              <div className="head">
                <span className="pill">Your dashboard</span>
                <h2 style={{ marginTop: '1.2rem' }}>
                  Watch yourself <em className="s" style={{ color: 'var(--lime)' }}>
                    get better.
                  </em>
                </h2>
                <p>
                  Every session is saved. Track your scores for each topic and overall, see your
                  streak, and see your level change over the month.
                </p>
              </div>
              <div
                className="dash"
                role="img"
                aria-label="Example dashboard with streak, minutes spoken, practice days, score trend and level"
              >
                <div className="tile lime">
                  <small>Current streak</small>
                  <div className="big">
                    12 <em>days</em>
                  </div>
                </div>
                <div className="tile">
                  <small>Minutes spoken</small>
                  <div className="big">
                    348 <em>min</em>
                  </div>
                </div>
                <div className="tile lilac wide">
                  <small>Practice days this month</small>
                  <div className="big">
                    12 <em>days</em>
                  </div>
                  <div className="grid30" aria-hidden>
                    {Array.from({ length: 30 }).map((_, i) => (
                      <i key={i} className={i < 12 ? 'd' : i === 12 ? 't' : undefined} />
                    ))}
                  </div>
                </div>
                <div className="tile wide">
                  <small>Overall score by session</small>
                  <div className="bars" aria-hidden>
                    {[38, 44, 41, 52, 55, 53, 61, 64, 62, 70, 73, 78].map((h, i, arr) => (
                      <i
                        key={i}
                        className={i === arr.length - 1 ? 'on' : undefined}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="tile">
                  <small>Strongest skill</small>
                  <div className="big" style={{ fontSize: '1.9rem', marginTop: '0.5rem' }}>
                    Clarity
                  </div>
                </div>
                <div className="tile">
                  <small>Focus next</small>
                  <div className="big" style={{ fontSize: '1.9rem', marginTop: '0.5rem' }}>
                    Pronunciation
                  </div>
                </div>
              </div>
              <p className="dash-note">Example data for illustration.</p>
            </div>
          </div>
        </section>

        <section className="section" id="topics">
          <div className="wrap">
            <div className="head center">
              <span className="pill dot">Unlimited topics</span>
              <h2>
                Real conversations you&apos;ll <em className="s">actually have.</em>
              </h2>
              <p>
                Each topic is a 30-minute conversation with Yappy. They start easy and build up to
                longer, more confident chats.
              </p>
            </div>
            <div className="cloud">
              {TOPICS.map((t) => (
                <span key={t}>{t}</span>
              ))}
              <span className="more">+ new topics added all the time</span>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="head center">
              <span className="pill dot">Why Yappply</span>
              <h2>
                Built for people who <em className="s">freeze.</em>
              </h2>
            </div>
            <div className="compare" role="table" aria-label="Why Yappply compared to classes and apps">
              <div className="compare-head" role="row">
                <div role="columnheader" className="compare-feature">
                  <span className="sr-only">Feature</span>
                </div>
                <div role="columnheader">Classes and tutors</div>
                <div role="columnheader">Videos and apps</div>
                <div role="columnheader" className="us">
                  Yappply
                </div>
              </div>
              {[
                {
                  feature: 'Speak out loud every day',
                  tutors: 'Only during class',
                  apps: 'Rarely',
                  us: '30 minutes daily',
                },
                {
                  feature: 'Mistakes corrected in the moment',
                  tutors: 'Sometimes',
                  apps: 'No',
                  us: 'Live, with retries',
                },
                {
                  feature: 'Detailed report after each session',
                  tutors: 'Rarely',
                  apps: 'No',
                  us: 'Every session',
                },
                {
                  feature: 'Practise without fear of judgement',
                  tutors: 'Hard in front of others',
                  apps: "Yes, but you're not speaking",
                  us: 'Just you and Yappy',
                },
                {
                  feature: 'Practise any time of day',
                  tutors: 'Fixed schedule',
                  apps: 'Yes',
                  us: 'Whenever you like',
                },
              ].map((row) => (
                <div className="compare-row" role="row" key={row.feature}>
                  <div role="rowheader" className="compare-feature">
                    {row.feature}
                  </div>
                  <div role="cell" data-label="Classes and tutors">
                    {row.tutors}
                  </div>
                  <div role="cell" data-label="Videos and apps">
                    {row.apps}
                  </div>
                  <div role="cell" className="us" data-label="Yappply">
                    <span className="yes">{row.us}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section pricing" id="pricing">
          <div className="wrap">
            <div className="head center">
              <span className="pill dot">Pricing</span>
              <h2>
                Less than a tutor. <em className="s">Every single day.</em>
              </h2>
              <p>Every plan includes everything. Pay for longer and save.</p>
            </div>
            <div className="plans">
              <article className="plan">
                <h3>Monthly</h3>
                <span className="save none">Flexible</span>
                <div className="amount">PKR 4,999</div>
                <div className="per">per month</div>
                <ul>
                  <li>A new topic every day</li>
                  <li>30-minute daily call with Yappy</li>
                  <li>Live corrections</li>
                  <li>Full report after every call</li>
                  <li>Progress dashboard</li>
                </ul>
                <Link href="/login" className="btn btn-white">
                  Choose monthly
                </Link>
              </article>
              <article className="plan best">
                <span className="flag">Best value</span>
                <h3>Yearly</h3>
                <span className="save">Save 10%</span>
                <div className="amount">PKR 53,989</div>
                <div className="per">per year · about PKR 4,499 a month</div>
                <ul>
                  <li>Everything in monthly</li>
                  <li>Every new topic we add</li>
                  <li>A full year of daily practice</li>
                  <li>Your progress saved all year</li>
                </ul>
                <Link href="/login" className="btn btn-lime">
                  Choose yearly
                </Link>
              </article>
              <article className="plan">
                <h3>Quarterly</h3>
                <span className="save">Save 5%</span>
                <div className="amount">PKR 14,247</div>
                <div className="per">every 3 months · about PKR 4,749 a month</div>
                <ul>
                  <li>Everything in monthly</li>
                  <li>Three months of daily practice</li>
                  <li>Every new topic we add</li>
                </ul>
                <Link href="/login" className="btn btn-ink">
                  Choose quarterly
                </Link>
              </article>
            </div>
            <p className="all-plans">
              All plans: one topic a day, a 30-minute daily call, live corrections, full reports and
              your dashboard.
            </p>
          </div>
        </section>

        <section className="section" id="blog">
          <div className="wrap">
            <div className="head center">
              <span className="pill dot">Blog</span>
              <h2>
                Tips for speaking, not just <em className="s">studying.</em>
              </h2>
              <p>Short reads on freezing less, correcting faster, and using your daily report.</p>
            </div>
            <div className="posts">
              {teaserPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
            <div className="blog-teaser-cta">
              <Link href="/blog" className="btn btn-white">
                See all posts
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

        <section className="section" id="faq">
          <div className="wrap">
            <div className="head center">
              <span className="pill dot">FAQ</span>
              <h2>
                Questions? <em className="s">Answers.</em>
              </h2>
            </div>
            <div className="faq">
              <details>
                <summary>How does a day on Yappply work?</summary>
                <p>
                  Each day you get one topic. You have a 30-minute voice call with Yappy about it.
                  When you finish, you get your report, and your next topic unlocks the following
                  day.
                </p>
              </details>
              <details>
                <summary>Do I need to be good at English to start?</summary>
                <p>
                  No. If you can understand simple English and say short sentences, you&apos;re
                  ready. Yappy adjusts to your level, and your report shows where you are right now.
                </p>
              </details>
              <details>
                <summary>Does Yappy really correct my mistakes?</summary>
                <p>
                  Yes. When you make a mistake, Yappy shows you the right way to say it and asks you
                  to try again, up to 3 times, before the conversation carries on.
                </p>
              </details>
              <details>
                <summary>What&apos;s in the report?</summary>
                <p>
                  Scores for grammar, clarity, pronunciation and vocabulary, your top mistakes with
                  corrections, and your current speaking level. Every report is saved to your
                  dashboard.
                </p>
              </details>
              <details>
                <summary>Can I talk for more than 30 minutes a day?</summary>
                <p>
                  Each day gives you one 30-minute session on that day&apos;s topic. Short daily
                  practice builds the habit faster than one long session a week.
                </p>
              </details>
              <details>
                <summary>What do I need?</summary>
                <p>
                  A microphone and Google Chrome or Microsoft Edge, on a laptop or an Android phone.
                  Nothing to download.
                </p>
              </details>
              <details>
                <summary>Will anyone hear my mistakes?</summary>
                <p>No. It&apos;s just you and Yappy, so you can practise without feeling embarrassed.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="final">
          <div className="wrap">
            <div className="final-card">
              <div className="mascot-mini bobbing" aria-hidden>
                <svg viewBox="0 0 300 330">
                  <use href="#yappy" />
                </svg>
              </div>
              <svg className="sticker" viewBox="0 0 150 150" aria-hidden>
                <circle cx="75" cy="75" r="72" fill="#fff" stroke="#16151F" strokeWidth="3" />
                <text
                  fontFamily="Bricolage Grotesque, sans-serif"
                  fontWeight="800"
                  fontSize="14"
                  fill="#16151F"
                >
                  <textPath href="#circ" textLength="345" lengthAdjust="spacing">
                    30 MINUTES • EVERY DAY •{' '}
                  </textPath>
                </text>
                <use
                  href="#spark"
                  x="50"
                  y="50"
                  width="50"
                  height="50"
                  style={{ color: '#DDF55B' }}
                />
              </svg>
              <h2>
                Your next English conversation starts <em className="s">today.</em>
              </h2>
              <p>30 minutes a day with Yappy. A full report every time.</p>
              <Link href="/login" className="btn btn-lime">
                Start daily practice
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
