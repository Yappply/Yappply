export type PracticeCallContext = {
  sessionId: string | null
  lessonId: string
  turnIndex: number
}

let ctx: PracticeCallContext = {
  sessionId: null,
  lessonId: '',
  turnIndex: 0,
}

export function setPracticeContext(next: Partial<PracticeCallContext>) {
  ctx = { ...ctx, ...next }
}

export function getPracticeContext() {
  return ctx
}

export function bumpPracticeTurn() {
  ctx = { ...ctx, turnIndex: (ctx.turnIndex || 0) + 1 }
  return ctx.turnIndex
}

export function clearPracticeContext() {
  ctx = { sessionId: null, lessonId: '', turnIndex: 0 }
}
