// Grades a rebuilt message sequence against the reference exchange.

export interface Msg { label: string; from: string; to: string }

export type RefStatus = 'ok' | 'order' | 'direction' | 'missing'
export type AnsStatus = 'ok' | 'order' | 'direction' | 'extra'

export interface Grade {
  score: number
  inPlace: number
  ref: RefStatus[]
  ans: AnsStatus[]
}

const same = (a: Msg, b: Msg) => a.label === b.label && a.from === b.from && a.to === b.to

export function grade(reference: Msg[], answer: Msg[]): Grade {
  const n = reference.length
  const m = answer.length
  // longest common subsequence = messages that are right and in the right order
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = same(reference[i], answer[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ref: (RefStatus | null)[] = new Array(n).fill(null)
  const ans: (AnsStatus | null)[] = new Array(m).fill(null)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (same(reference[i], answer[j])) { ref[i] = 'ok'; ans[j] = 'ok'; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  // right message, wrong place
  ref.forEach((s, ri) => {
    if (s) return
    const aj = ans.findIndex((a, k) => a === null && same(reference[ri], answer[k]))
    if (aj >= 0) { ref[ri] = 'order'; ans[aj] = 'order' }
  })
  // right message type, wrong sender/receiver
  ref.forEach((s, ri) => {
    if (s) return
    const aj = ans.findIndex((a, k) => a === null && answer[k].label === reference[ri].label)
    if (aj >= 0) { ref[ri] = 'direction'; ans[aj] = 'direction' }
  })
  const inPlace = dp[0][0]
  return {
    score: Math.round((100 * inPlace) / Math.max(n, m, 1)),
    inPlace,
    ref: ref.map((s) => s ?? 'missing'),
    ans: ans.map((s) => s ?? 'extra'),
  }
}
