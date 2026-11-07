# Yappply

**Yappply** is a browser-based English speaking practice app. You talk out loud with **Lucy** (also called Yappy on the marketing site) — a patient AI speaking partner — through real voice conversations, not drills or multiple-choice quizzes.

The goal is simple: you’ve studied English; this app helps you **actually speak it**.

## What it does

1. **Sign up** with your name, email, password, and speaking level (beginner / intermediate / advanced).
2. **Pick a lesson** from a 30-lesson path built around real-life stories and situations (introductions, family, routines, travel, work, goals, and more).
3. **Start a live voice call** with Lucy in the browser. She greets you, asks about the lesson topic, follows up, and keeps the conversation going.
4. **Speak with your mic.** Speech recognition turns your speech into text; Lucy replies via Gemini and can gently correct unclear or incorrect English (with up to a few practice tries).
5. **Hang up or hit the 30-minute limit.** The session is scored and saved — clarity, accuracy, pronunciation, and completeness — with top mistakes highlighted.
6. **Track progress** on the dashboard: lessons done, minutes spoken, streak, and recent sessions.

## Who it’s for

Learners who understand English but freeze or struggle when speaking out loud. Lessons start easy and build toward everyday chats, stories, and more confident conversation. Prefer **Chrome** or **Edge** so speech recognition works well.

## Main screens

| Screen | Purpose |
| --- | --- |
| Landing (`/`) | Product story and call-to-action |
| Register / Login | Create an account or sign in |
| Dashboard | Overview of streak, minutes, and lesson progress |
| Lessons | Browse all 30 speaking lessons |
| Practice | Live voice call with Lucy for a chosen lesson |
| Results | Scores and feedback after a session |

## Practice rules (in the app)

- Each call lasts **up to 30 minutes**, then ends automatically.
- You can hang up earlier anytime.
- Mistakes may offer **up to 3 correction tries**, then the chat continues.
- Progress is saved when you finish a meaningful session (hang up or time’s up).
- You must be logged in to use dashboard, lessons, and practice.

> Note: The landing page mentions day-by-day unlock and paid plans. That marketing copy is not fully enforced yet — after login, the lesson list is available in the app.

## Tech stack

- **Frontend:** Next.js (App Router) + React
- **Backend:** Express API on port `3001` (proxied as `/api` from the Next app)
- **Database:** MongoDB (Atlas-friendly)
- **AI:** Google Gemini (server-side only — the key never goes to the browser)
- **Auth:** JWT sessions
- **Speech:** Browser speech recognition + synthesis for the voice call UX

## Setup

### Requirements

- Node.js 20+
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or any MongoDB URI)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Environment

Create a `.env` in the project root:

```env
GEMINI_API_KEY=your_actual_key_here
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/yappply?retryWrites=true&w=majority
JWT_SECRET=change-me-to-a-long-random-string
PORT=3001
```

### Run locally

```bash
npm install
npm run dev
```

This starts the **Yappply** Next.js app and the Express API together.

- **App (use this):** http://localhost:5173  
- **API only:** http://localhost:3001  

Do not open `:3001` in the browser for the UI — that port is API-only now.

### Production

```bash
npm run build
npm start
```

## Project layout (high level)

```
app/                 Next.js routes (landing, auth, dashboard, lessons, practice)
src/                 React UI, chat/practice logic, lesson data
server/              Express API (auth, progress, Gemini)
public/              Static assets
```

## Privacy note

Mic audio is processed in the browser for speech-to-text. Conversation text is sent to your backend so Lucy can reply via Gemini. Account and progress data are stored in MongoDB. Keep `.env` private and never commit API keys.
