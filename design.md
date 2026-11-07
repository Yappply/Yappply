# Yappply Landing Page — design.md

Design reference for the Yappply landing page v4 and the blog page. Everything here matches the shipped production stack. Use it to rebuild the page, or to design new pages that match.

**Code map**

| Piece | Path |
| --- | --- |
| Landing | `src/components/landing/YappplyLanding.tsx` · `app/page.tsx` |
| Blog | `src/components/landing/YappplyBlog.tsx` · `app/blog/page.tsx` |
| Free speaking test | `src/components/landing/FreeSpeakingTest.tsx` |
| Hero stage | `src/components/landing/HeroStage.tsx` |
| SVG sprite | `src/components/landing/SvgDefs.tsx` |
| Styles / tokens | `src/styles/yappply.css` |
| Fonts | Bricolage Grotesque + Instrument Serif in `app/layout.tsx` |

---

## 1. Design idea

Playful notebook meets sticker sheet. A clean white page with chunky, hand-drawn doodles, bold grotesque headlines with a handwritten-feeling italic serif accent, rounded cards with ink outlines, and one friendly mascot, Yappy, who appears wherever the user needs encouragement.

**Principles**

- **White first.** The page background is white. Colour comes in blocks (cards, sections, pills), not washes.
- **Ink outlines, chunky shapes.** Interactive and featured elements get a 2px near-black outline and big rounded corners.
- **One bold word per headline.** Headlines are heavy sans-serif; one key phrase switches to the italic serif.
- **Show, don't tell.** Prefer an illustration, a mock report or a chat bubble over a paragraph.
- **Yappy is the guide.** The mascot appears in the hero, while the AI thinks, in the report pitch and in the final call to action.

---

## 2. Colour

### Core palette

| Token | Hex | Role |
| --- | --- | --- |
| `--white` | `#FFFFFF` | Page background, cards |
| `--ink` | `#16151F` | Text, outlines, dark sections, dark buttons |
| `--ink-2` | `#55536A` | Secondary text, captions, meta |
| `--lilac` | `#C9B8FF` | Primary brand colour: hero stage, featured pricing card, final CTA, report shadow |
| `--lime` | `#DDF55B` | Accent: primary buttons, tags, highlights, stickers, scribble underline |
| `--pink` | `#FF8CC6` | Small accent: mascot cheeks, tag pills, "Best value" flag, lever knob, sparkles |

### Soft tints (backgrounds only)

| Token | Hex | Used for |
| --- | --- | --- |
| `--lilac-soft` | `#EEE8FF` | "How it works" section, chat bubbles, report cards, FAQ open state |
| `--lime-soft` | `#F4FBCF` | Pricing section, comparison highlight column |
| `--pink-soft` | `#FFE3F1` | Problem card, "fix first" chip, filler-word highlight |

### Semantic colours (inside reports only)

| Use | Hex |
| --- | --- |
| Mistake / strikethrough | `#B4235F` |
| Correction | `#1F7A3D` |
| Recording dot | `#FF4D8F` |

### Rules

- Text on lilac, lime or pink is always `--ink`, never white.
- White text only on `--ink` backgrounds (dark dashboard, footer, gate panel, marquee).
- Lime is for the single most important action in a section. Avoid two lime buttons side by side.
- Pink is an accent, never a large background.

---

## 3. Typography

### Typefaces

| Family | Weights | Role |
| --- | --- | --- |
| Bricolage Grotesque | 400, 500, 600, 700, 800 | Everything: headlines (800), UI and body (400–700) |
| Instrument Serif, italic | 400 | Accent words inside headlines, rewritten answers, small handwritten-style notes, wordmark tail |

Both are free on Google Fonts. Load with `font-display: swap` (see `app/layout.tsx`).

### Scale

| Element | Size | Weight | Line height | Letter spacing |
| --- | --- | --- | --- | --- |
| Hero H1 | `clamp(3.2rem, 6.4vw, 5.7rem)` | 800 | 0.98 | -0.035em |
| Section H2 | `clamp(2.4rem, 5.4vw, 4.2rem)` | 800 | 0.98 | -0.035em |
| Card H3 | 1.35rem | 800 | 1.15 | -0.02em |
| Hero subtitle | 1.2rem | 400 | 1.55 | normal |
| Section intro | 1.18rem | 400 | 1.55 | normal |
| Body | 1.0625rem (17px) | 400 | 1.55 | normal |
| Pills / meta | 0.85–0.95rem | 600–700 | — | normal |
| Price | 2.9rem | 800 | 1 | -0.045em |
| Footer wordmark | `clamp(5rem, 20vw, 17rem)` | 800 | 0.85 | -0.06em |

### Accent word pattern

```html
<h2>Real conversations you'll <em class="s">actually have.</em></h2>
```

```css
em.s { font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; }
```

The hero accent word also gets a hand-drawn lime underline (an SVG path behind the word).

Body text max width: `60ch`.

---

## 4. Layout and spacing

| Token | Value |
| --- | --- |
| Content width | `min(1200px, 100% − 2.5rem)` |
| Section padding | 6.5rem top and bottom (4.5rem on mobile) |
| Section header gap | 3.25rem below the header block |
| Card gap | 1rem–1.25rem |
| Grid columns | 4 (problem, steps), 3 (pricing, blog), 2 (report section), 4-up dashboard tiles |

### Radius

| Element | Radius |
| --- | --- |
| Buttons, pills, tags, chips | 999px |
| Cards, steps, FAQ items | 24–32px |
| Big panels (hero stage, dashboard, final CTA) | 36–44px |
| Small inner elements (report cards, bars) | 16–20px |

### Borders

- `--line: 2px solid var(--ink)` on buttons, cards, pills, nav, sections.
- 1.5px ink on small pills and report sub-cards.
- Dashed lilac (`#B9AEE6`) for the topic slot in the speaking test.

### Shadows (hard, offset, no blur)

| Use | Value |
| --- | --- |
| Lime button | `0 5px 0 var(--ink)` (hover `0 7px 0`, press `0 1px 0`) |
| Report card | `12px 12px 0 var(--lilac)` |
| Speaking test machine | `12px 12px 0 var(--lilac)` |
| Featured pricing card | `10px 10px 0 var(--ink)` |
| Blog card hover | `8px 8px 0 var(--ink)` |

No soft, blurred drop shadows anywhere.

### Breakpoints

| Width | Changes |
| --- | --- |
| ≤ 1020px | Nav links hide; hero and report go to one column; 4-up grids become 2-up; pricing stacks |
| ≤ 700px | Speaking test machine tightens; report grid to one column; email gate stacks |
| ≤ 640px | All grids one column; hero sticker hidden; comparison table scrolls sideways |

---

## 5. Components

### Buttons

| Variant | Look | Use |
| --- | --- | --- |
| `.btn-lime` | Lime fill, ink outline, hard shadow, arrow icon | The main action: "Test your English free", "Start daily practice", "Choose yearly" |
| `.btn-ink` | Ink fill, white text | Strong secondary: nav "Free test", "I'm ready, start", "Choose quarterly" |
| `.btn-white` | White fill, ink outline | Low-emphasis: "Spin again", "See all posts", "Choose monthly" |

Padding `1.05rem 1.6rem`, font `700 / 1.02rem`, pill radius. Text is always verb-first and specific.

### Pill / tag

White pill with a 1.5px ink outline and an optional pink dot (`.pill.dot`). Used as section eyebrows ("How it works", "Pricing"), fact chips and filters.

### Nav

A floating white pill bar with a 2px ink outline. Logo (Yappy + wordmark) on the left, links in the middle, auth / free-test CTA on the right.

### Hero stage

A lilac rounded panel holding: the Yappy mascot (bobbing), three chat bubbles that appear one by one (Yappy question, user answer in ink, lime "Quick fix"), tilted tag pills ("Today: Job interview", "No judging"), sparkles, and a spinning round sticker with circular text.

### Marquee

A full-width ink strip with scrolling text, alternating bold sans phrases and italic serif phrases, separated by coloured sparkles. Runs at 30s per loop.

### Free speaking test ("Today's challenge" machine)

A white notebook card (punched-hole margin on the left, lined-paper section background) with:

- a step tracker: Spin → Think 15s → Speak 60s → Get report (current step in lime)
- a topic slot showing previous, current and next topics, with a lever on the right
- state panels: idle → spun → prep (15s ring) → speak (60s pink ring, recording dot, sound bars) → think (Yappy bobbing) → result
- quick result: score ring, level chip (lime), strength chip (lilac-soft), "fix first" chip (pink-soft)
- an email gate (ink panel) that unblurs the full report
- full report cards: transcript with marked fillers, pace, "Did you answer it?", structure chips, grammar fixes, stronger words, rewritten answer (serif italic), "Watch next" video card
- the Yappy pitch (lime panel) linking to pricing

### Problem cards

Four outlined cards, each with a doodle face, a quoted feeling (bold) and a one-line explanation. Backgrounds rotate: lilac-soft, lime-soft, pink-soft, white.

### Steps

Four white outlined cards on a lilac-soft section. Each has a black number badge overlapping the top edge, an illustration on a tinted tile, a title and one line.

### Report preview

An outlined white card with a lilac hard shadow: session meta, a lime level badge, four score rings (grammar, clarity, pronunciation, vocabulary) and three corrected mistakes.

### Dashboard preview

A big ink panel with tiles: lime (streak), dark (minutes), lilac (practice days with a 30-square grid), dark (score bars, latest bar in lime), plus strongest-skill and focus-next tiles. Marked "Example data".

### Topic cloud

Outlined pills in rotating fills (lilac, lime, pink-soft, white), some tilted ±3°, ending in a dashed ink pill: "+ new topics added all the time".

### Comparison table

An outlined table; the Yappply column is lime-soft with a lime header and lime check circles.

### Pricing

Three cards. Order: Monthly (white), Yearly in the middle (lilac, ink hard shadow, raised 10px, pink "Best value" flag), Quarterly (white). A lime "Save X%" pill, big price and a per-month equivalent.

Prices: Monthly PKR 4,999 · Yearly PKR 53,989 · Quarterly PKR 14,247.

### FAQ

Outlined pill-cornered `<details>` items with a lime plus button that rotates 45° when open. Open items get a lilac-soft background.

### Blog card

An outlined card with an illustrated cover (16:10), a category pill, a title and the read time. On hover it lifts 4px with an 8px ink shadow.

### Final CTA

A lilac panel with Yappy bobbing in the corner, a round sticker ("30 minutes • every day") and a lime button.

### Footer

Ink background, links in the top row, and a giant "Yappply" wordmark (white sans + lime italic serif).

---

## 6. Illustration

### Yappy (mascot)

A doodle speech bubble with a face, arms and legs.

- Body: white fill, 5px ink outline, speech-bubble tail bottom-left
- Eyes: two black ovals with white highlights
- Cheeks: pink `#FF8CC6` ovals
- Mouth: open smile, ink fill, pink tongue line
- One arm raised with a lime "antenna" ball; one arm resting
- Two stick legs with small feet
- Lilac highlight stroke on the top-left of the head

Defined once as an SVG `<symbol id="yappy">` in `SvgDefs.tsx` and reused with `<use href="#yappy">`.

### Supporting doodles

- Sparkle: four-point star, coloured fill, 4px ink outline
- Doodle faces: simple circle faces with different expressions (problem section)
- Step icons: calendar, mic, correction bubbles, report sheet, all ink-outlined with lime, lilac or pink fills
- Round sticker: lime or white circle with circular text (`<textPath>`) and a sparkle in the middle
- Blog covers: a tinted background, a big soft circle, a white wave, and one motif (bubble, mic, star, chart, tie, ear, quote marks, Yappy)

Line weight 3–5px, round caps, flat fills, no gradients.

---

## 7. Motion

| Animation | Where | Spec |
| --- | --- | --- |
| Bob | Yappy (hero, thinking, final CTA) | 4s ease-in-out, 8px up and down |
| Bubble entrance | Hero chat | Fade and spring in, one every 1.1s on load |
| Spin | Round stickers | 18s linear, continuous |
| Marquee | Ink strip | 30s linear, continuous |
| Slot spin | Speaking test | Topics shuffle every 70ms for about 1s with a slight blur |
| Lever pull | Speaking test | Knob drops 62px and springs back |
| Countdown rings | Speaking test | Stroke offset animates 1s linear per second |
| Recording | Speaking test | Pulsing pink dot; sound bars 0.9s |
| Button press | Lime button | Moves down 4px as the shadow shrinks |

All motion is disabled under `prefers-reduced-motion: reduce`. Bubbles and test states appear instantly.

---

## 8. Voice and copy

- Speak to the learner as "you". Short, plain sentences. Encouraging, never judging.
- Headlines: a bold claim plus one italic accent phrase. E.g. "How good is your English, really?"
- Buttons: verb first and specific. "Test your English free", "Unlock my report", "Start daily practice".
- Name the mascot: "Yappy corrects you", "just you and Yappy".
- No made-up numbers or testimonials. Sample data is labelled "Example data" or "Scores shown are a sample".

---

## 9. Accessibility

- Visible focus: `outline: 3px solid var(--ink); outline-offset: 3px`.
- Decorative SVGs carry `aria-hidden="true"`; informative mocks use `role="img"` with an `aria-label`.
- Colour is never the only signal: corrections use strikethrough plus colour, and steps use labels plus colour.
- Email gate: a labelled input, with inline error messages in a `role="alert"` element.
- Contrast: ink on white, lilac, lime and pink all pass WCAG AA for body text.

---

## 10. Page structure (v4)

1. Nav
2. Hero: headline, subtitle, "Test your English free", fact pills, chat stage with Yappy
3. Marquee
4. Free speaking test (`#test`)
5. Problem: "Your English is fine. Speaking it is the hard part."
6. How it works (`#how`): 4 steps and the one-topic-a-day rule
7. Report preview (`#report`)
8. Dashboard preview
9. Topics (`#topics`): unlimited topic cloud
10. Why Yappply: comparison table
11. Pricing (`#pricing`): Monthly PKR 4,999 · Yearly PKR 53,989 · Quarterly PKR 14,247
12. Blog teaser: 3 posts and "See all posts"
13. FAQ (`#faq`)
14. Final CTA
15. Footer with wordmark

**Blog page** (`/blog`): nav, blog hero with Yappy reading, featured post, category filters and search, 3×3 post grid, CTA band to the free test, footer.

---

## 11. Notes for engineers

- The speaking test is a front-end demo. Production needs audio recording, back-end analysis, email capture, rate limiting and a captcha for a live free test.
- All tokens live in `.yappply` CSS variables at the top of `src/styles/yappply.css`. Keep them unchanged when designing new marketing surfaces.
- SVG symbols (`#yappy`, `#spark`, `#spark-flat`, `#circ`) are defined once in `SvgDefs.tsx`. Keep them as a shared sprite.
- Authenticated app chrome (`src/styles/yappply-app.css`) may reuse brand hues but is not bound to every landing layout rule.
