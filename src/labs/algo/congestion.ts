// Per-round TCP congestion window, as drawn in textbook exercises (units of MSS).
// Slow start doubles cwnd each round but does not overshoot ssthresh.

export type Variant = 'tahoe' | 'reno'
export type LossKind = 'timeout' | 'dup3'

export interface Round {
  round: number
  cwnd: number
  ssthresh: number
  phase: 'Slow start' | 'Congestion avoidance' | 'Fast recovery'
  loss?: LossKind
}

export function congestion(variant: Variant, rounds: number, ssthresh0: number, losses: Record<number, LossKind>): Round[] {
  let cwnd = 1
  let ssthresh = ssthresh0
  let recovering = false
  const out: Round[] = []
  for (let r = 1; r <= rounds; r++) {
    const loss = losses[r]
    const phase: Round['phase'] = recovering ? 'Fast recovery' : cwnd < ssthresh ? 'Slow start' : 'Congestion avoidance'
    out.push({ round: r, cwnd, ssthresh, phase, loss })
    recovering = false
    if (loss) {
      ssthresh = Math.max(2, Math.floor(cwnd / 2))
      if (loss === 'dup3' && variant === 'reno') {
        cwnd = ssthresh + 3
        recovering = true
      } else {
        cwnd = 1
      }
    } else if (cwnd < ssthresh) {
      cwnd = Math.min(cwnd * 2, ssthresh)
    } else {
      cwnd += 1
    }
  }
  return out
}
