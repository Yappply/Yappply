'use client'

import { useEffect, useState } from 'react'

export function HeroStage() {
  const [show, setShow] = useState([false, false, false])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShow([true, true, true])
      return
    }
    const timers = [0, 1, 2].map((i) =>
      setTimeout(() => {
        setShow((prev) => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 500 + i * 1100),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="stage" aria-label="Example of a conversation with Yappy">
      <div className="stage-bg" aria-hidden />
      <span className="tagpill t2" aria-hidden>
        Today: Job interview
      </span>
      <div className={`bubble b1${show[0] ? ' show' : ''}`}>
        <small>Yappy</small>
        So, tell me about your last job. What did you do there?
      </div>
      <div className={`bubble b2${show[1] ? ' show' : ''}`}>
        <small>You</small>
        &quot;I was work in a bank for two years.&quot;
      </div>
      <div className={`bubble b3${show[2] ? ' show' : ''}`}>
        <small>Quick fix</small>
        <s>I was work</s> → <b>I worked</b> in a bank. Try it again?
      </div>
      <div className="mascot bobbing" aria-hidden>
        <svg viewBox="0 0 300 330">
          <use href="#yappy" />
        </svg>
      </div>
      <span className="tagpill t1" aria-hidden>
        No judging
      </span>
      <svg className="sticker" viewBox="0 0 150 150" aria-hidden>
        <circle cx="75" cy="75" r="72" fill="#DDF55B" stroke="#16151F" strokeWidth="3" />
        <text
          fontFamily="Bricolage Grotesque, sans-serif"
          fontWeight="800"
          fontSize="14"
          fill="#16151F"
        >
          <textPath href="#circ" textLength="345" lengthAdjust="spacing">
            SPEAK DAILY • GET BETTER •{' '}
          </textPath>
        </text>
        <use href="#spark" x="50" y="50" width="50" height="50" style={{ color: '#FF8CC6' }} />
      </svg>
      <svg
        className="star"
        viewBox="0 0 100 100"
        style={{ width: 44, left: '4%', top: '30%', color: '#DDF55B' }}
        aria-hidden
      >
        <use href="#spark" />
      </svg>
      <svg
        className="star"
        viewBox="0 0 100 100"
        style={{ width: 30, right: '20%', bottom: '30%', color: '#fff' }}
        aria-hidden
      >
        <use href="#spark" />
      </svg>
    </div>
  )
}
