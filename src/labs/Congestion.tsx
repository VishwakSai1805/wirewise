import { useState } from 'preact/hooks'
import { congestion, type LossKind } from './algo/congestion'
import { Note, Slider } from './ui'

const NEXT: Record<string, LossKind | undefined> = { none: 'dup3', dup3: 'timeout', timeout: undefined }

export default function Congestion() {
  const [rounds, setRounds] = useState(26)
  const [ss, setSs] = useState(8)
  const [losses, setLosses] = useState<Record<number, LossKind>>({ 8: 'dup3', 18: 'timeout' })
  const [show, setShow] = useState({ reno: true, tahoe: true })

  const reno = congestion('reno', rounds, ss, losses)
  const tahoe = congestion('tahoe', rounds, ss, losses)
  const maxY = Math.max(ss, ...reno.map((r) => r.cwnd), ...tahoe.map((r) => r.cwnd)) + 2

  const W = 860, H = 340, L = 44, B = 40, T = 14, R = 14
  const x = (r: number) => L + ((r - 1) / Math.max(1, rounds - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B)
  const line = (rs: typeof reno) => rs.map((r, i) => `${i ? 'L' : 'M'}${x(r.round)} ${y(r.cwnd)}`).join(' ')
  const ssLine = reno.map((r, i) => `${i ? 'L' : 'M'}${x(r.round) - (i ? (W - L - R) / Math.max(1, rounds - 1) / 2 : 0)} ${y(r.ssthresh)} H${x(r.round) + (W - L - R) / Math.max(1, rounds - 1) / 2}`).join(' ')

  const cycle = (r: number) => {
    const n = { ...losses }
    const nxt = NEXT[losses[r] ?? 'none']
    if (nxt) n[r] = nxt
    else delete n[r]
    setLosses(n)
  }
  const yTicks = Array.from({ length: Math.floor(maxY / 2) + 1 }, (_, i) => i * 2).filter((v) => v <= maxY)

  return (
    <div class="lab-grid">
      <div class="card">
        <div class="sliders">
          <Slider label="Initial ssthresh" value={ss} min={2} max={32} onChange={setSs} suffix=" MSS" />
          <Slider label="Transmission rounds" value={rounds} min={10} max={40} onChange={setRounds} />
        </div>
        <div class="toggles">
          <label class={`toggle ${show.reno ? 'on' : ''}`}><input type="checkbox" checked={show.reno} onChange={() => setShow({ ...show, reno: !show.reno })} /> <span class="sw reno" /> TCP Reno</label>
          <label class={`toggle ${show.tahoe ? 'on' : ''}`}><input type="checkbox" checked={show.tahoe} onChange={() => setShow({ ...show, tahoe: !show.tahoe })} /> <span class="sw tahoe" /> TCP Tahoe</label>
          <button class="btn sm ghost" onClick={() => setLosses({})}>Clear losses</button>
        </div>
        <p class="muted">Click a round on the axis to add a loss: once for <strong>3 duplicate ACKs</strong>, twice for a <strong>timeout</strong>, three times to remove it.</p>
        <div class="chart-scroll">
          <svg class="cc-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Congestion window per round">
            {yTicks.map((v) => (
              <g key={v}>
                <line class="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
                <text class="axis" x={L - 8} y={y(v) + 4} text-anchor="end">{v}</text>
              </g>
            ))}
            <path class="ssline" d={ssLine} />
            {show.tahoe && <path class="cwnd tahoe" d={line(tahoe)} />}
            {show.reno && <path class="cwnd reno" d={line(reno)} />}
            {show.tahoe && tahoe.map((r) => <circle key={'t' + r.round} class="pt tahoe" cx={x(r.round)} cy={y(r.cwnd)} r={3.2} />)}
            {show.reno && reno.map((r) => <circle key={'r' + r.round} class="pt reno" cx={x(r.round)} cy={y(r.cwnd)} r={3.2} />)}
            {reno.map((r) => (
              <g key={r.round} class={`xcell ${losses[r.round] ?? ''}`} onClick={() => cycle(r.round)}>
                <rect x={x(r.round) - 12} y={H - B + 4} width={24} height={24} rx={6} />
                <text x={x(r.round)} y={H - B + 20} text-anchor="middle">{r.round}</text>
                {losses[r.round] && <line class="lossline" x1={x(r.round)} x2={x(r.round)} y1={T} y2={H - B} />}
              </g>
            ))}
            <text class="axis" x={L} y={10}>cwnd (MSS)</text>
          </svg>
        </div>
        <div class="legend cc"><span class="lg reno">Reno</span><span class="lg tahoe">Tahoe</span><span class="lg ss">ssthresh (Reno)</span><span class="lg dup3">3 dup ACKs</span><span class="lg timeout">timeout</span></div>
      </div>

      <div class="card">
        <h2>Round by round</h2>
        <div class="table-wrap tall">
          <table class="lab-table">
            <thead><tr><th>Round</th><th>Event at end</th><th>Reno cwnd</th><th>Reno ssthresh</th><th>Reno phase</th><th>Tahoe cwnd</th><th>Tahoe ssthresh</th></tr></thead>
            <tbody>
              {reno.map((r, i) => (
                <tr key={r.round} class={r.loss ? 'changed' : ''}>
                  <td>{r.round}</td>
                  <td>{r.loss === 'dup3' ? '3 dup ACKs' : r.loss === 'timeout' ? 'Timeout' : ''}</td>
                  <td class="mono">{r.cwnd}</td><td class="mono">{r.ssthresh}</td><td>{r.phase}</td>
                  <td class="mono">{tahoe[i].cwnd}</td><td class="mono">{tahoe[i].ssthresh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note title="The rules used here">
          Slow start: cwnd doubles every round (capped at ssthresh). Congestion avoidance: +1 MSS per round.
          On any loss, ssthresh = ⌊cwnd / 2⌋. Timeout: cwnd = 1 for both versions. Three duplicate ACKs: Tahoe also drops to 1, while Reno does fast recovery: cwnd = ssthresh + 3, then grows linearly.
        </Note>
      </div>
    </div>
  )
}
