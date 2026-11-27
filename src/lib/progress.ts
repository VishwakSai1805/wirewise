// Progress lives only in this browser (localStorage). Nothing is sent anywhere.
// Learners can export it to a file and import it on another device.
import { useEffect, useState } from 'preact/hooks'

const KEY = 'wirewise:progress:v1'

export interface Progress {
  lessons: Record<string, { step: number; done: boolean }>
  quizzes: Record<string, number>
  exams: Record<string, number>
  labs: Record<string, boolean>
  last?: string
}

const empty = (): Progress => ({ lessons: {}, quizzes: {}, exams: {}, labs: {} })

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...JSON.parse(raw) }
  } catch {
    /* storage unavailable: start fresh */
  }
  return empty()
}

let state = load()
const listeners = new Set<() => void>()

function commit(next: Progress) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode or full storage: progress just won't persist */
  }
  listeners.forEach((f) => f())
}

export function useProgress(): Progress {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])
  return state
}

export function markStep(lessonId: string, step: number, total: number) {
  const cur = state.lessons[lessonId] ?? { step: 0, done: false }
  const next = { step: Math.max(cur.step, step), done: cur.done || step >= total - 1 }
  if (next.step === cur.step && next.done === cur.done && state.last === `/learn/${lessonId}`) return
  commit({ ...state, lessons: { ...state.lessons, [lessonId]: next }, last: `/learn/${lessonId}` })
}

export function recordQuiz(id: string, percent: number) {
  if ((state.quizzes[id] ?? -1) >= percent) return
  commit({ ...state, quizzes: { ...state.quizzes, [id]: percent } })
}

export function recordExam(id: string, percent: number) {
  if ((state.exams[id] ?? -1) >= percent) return
  commit({ ...state, exams: { ...state.exams, [id]: percent } })
}

export function markLab(id: string) {
  if (state.labs[id] && state.last === `/lab/${id}`) return
  commit({ ...state, labs: { ...state.labs, [id]: true }, last: `/lab/${id}` })
}

/** 0..1 completion for a course item. */
export function completion(p: Progress, kind: 'lesson' | 'lab', id: string, steps = 1): number {
  if (kind === 'lab') return p.labs[id] ? 1 : 0
  const l = p.lessons[id]
  if (!l) return 0
  return l.done ? 1 : Math.min(1, (l.step + 1) / steps)
}

export function exportProgress(): string {
  return JSON.stringify({ app: 'wirewise', version: 1, progress: state }, null, 2)
}

export function importProgress(text: string): boolean {
  try {
    const data = JSON.parse(text)
    const p = data?.progress
    if (!p || typeof p !== 'object' || typeof p.lessons !== 'object') return false
    commit({ ...empty(), ...p })
    return true
  } catch {
    return false
  }
}

export function resetProgress() {
  commit(empty())
}
