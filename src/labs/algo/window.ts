// Discrete-time simulation of Stop-and-Wait, Go-Back-N and Selective Repeat.
// The sender can start one transmission per tick; every message takes
// `delay` ticks to cross the link. Any transmission can be marked lost.

export type Protocol = 'sw' | 'gbn' | 'sr'

export interface WindowParams {
  protocol: Protocol
  frames: number
  window: number
  delay: number
  timeout: number
  lost: Set<string>
}

export interface Tx {
  key: string
  kind: 'data' | 'ack'
  seq: number
  sendT: number
  arriveT: number
  lost: boolean
  retx: boolean
  note?: string
}

export interface SimResult {
  txs: Tx[]
  finish: number
  dataSent: number
  retransmissions: number
  /** sender state per tick, for the window strip */
  timeline: { base: number; next: number; acked: boolean[] }[]
  completed: boolean
}

export function simulate(p: WindowParams): SimResult {
  const W = p.protocol === 'sw' ? 1 : Math.max(1, p.window)
  const N = p.frames
  const txs: Tx[] = []
  const attempts = new Map<string, number>()
  const keyFor = (kind: 'd' | 'a', seq: number) => {
    const base = `${kind}:${seq}`
    const n = attempts.get(base) ?? 0
    attempts.set(base, n + 1)
    return { key: `${base}:${n}`, retx: n > 0 }
  }

  // sender
  let base = 0
  let next = 0
  const acked = new Array<boolean>(N).fill(false)
  const timers = new Map<number, number>() // seq → start time (SR: per frame; GBN/SW: key 0 = oldest)
  let resend: number[] = []
  // receiver
  let expected = 0
  const buffered = new Set<number>()
  const timeline: SimResult['timeline'] = []

  const send = (kind: 'data' | 'ack', seq: number, t: number, note?: string) => {
    const { key, retx } = keyFor(kind === 'data' ? 'd' : 'a', seq)
    const tx: Tx = { key, kind, seq, sendT: t, arriveT: t + p.delay, lost: p.lost.has(key), retx, note }
    txs.push(tx)
    return tx
  }

  const LIMIT = 600
  let t = 0
  for (; t < LIMIT && base < N; t++) {
    // 1. ACKs arriving at the sender
    for (const a of txs) {
      if (a.kind !== 'ack' || a.lost || a.arriveT !== t) continue
      if (p.protocol === 'sr') {
        if (a.seq >= base && a.seq < base + W && !acked[a.seq]) {
          acked[a.seq] = true
          timers.delete(a.seq)
          while (base < N && acked[base]) base++
        }
      } else if (a.seq > base) {
        for (let s = base; s < a.seq; s++) acked[s] = true
        base = a.seq
        resend = resend.filter((s) => s >= base)
        if (base < next) timers.set(0, t)
        else timers.delete(0)
      }
    }
    // 2. data frames arriving at the receiver → ACKs go out immediately
    for (const d of txs) {
      if (d.kind !== 'data' || d.lost || d.arriveT !== t) continue
      if (p.protocol === 'sr') {
        if (d.seq >= expected && d.seq < expected + W) {
          const fresh = !buffered.has(d.seq)
          buffered.add(d.seq)
          const start = expected
          while (buffered.has(expected)) { buffered.delete(expected); expected++ }
          d.note = !fresh ? 'duplicate, ACK again'
            : expected > start ? (expected - start > 1 ? `deliver ${start}–${expected - 1}` : `deliver ${start}`)
            : 'buffered (out of order)'
          send('ack', d.seq, t)
        } else if (d.seq < expected) {
          d.note = 'duplicate, ACK again'
          send('ack', d.seq, t)
        } else {
          d.note = 'outside window, discarded'
        }
      } else {
        if (d.seq === expected) { expected++; d.note = `deliver ${d.seq}` }
        else d.note = d.seq < expected ? 'duplicate, discarded' : 'out of order, discarded'
        send('ack', expected, t)
      }
    }
    if (base >= N) { timeline.push({ base, next, acked: acked.slice() }); break }
    // 3. timeouts
    if (p.protocol === 'sr') {
      for (const [s, start] of [...timers]) {
        if (t - start >= p.timeout && !acked[s]) { timers.delete(s); if (!resend.includes(s)) resend.push(s) }
      }
    } else if (timers.has(0) && t - timers.get(0)! >= p.timeout) {
      timers.set(0, t)
      resend = []
      for (let s = base; s < next; s++) resend.push(s)
    }
    // 4. transmit at most one frame this tick
    if (resend.length) {
      const s = resend.shift()!
      if (!acked[s]) {
        send('data', s, t)
        if (p.protocol === 'sr') timers.set(s, t)
        else if (!timers.has(0)) timers.set(0, t)
      }
    } else if (next < N && next < base + W) {
      send('data', next, t)
      if (p.protocol === 'sr') timers.set(next, t)
      else if (!timers.has(0)) timers.set(0, t)
      next++
    }
    timeline.push({ base, next, acked: acked.slice() })
  }

  const data = txs.filter((x) => x.kind === 'data')
  return {
    txs,
    finish: t,
    dataSent: data.length,
    retransmissions: data.filter((x) => x.retx).length,
    timeline,
    completed: base >= N,
  }
}
