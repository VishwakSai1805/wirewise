import { useMemo, useState } from 'preact/hooks'
import { simulate, type Protocol, type Tx } from './algo/window'
import { Note, Segmented, Slider } from './ui'

const ABOUT: Record<Protocol, { title: string; text: string }> = {
  sw: {
    title: 'Stop-and-Wait',
    text: 'Send one frame, then wait for its ACK before sending the next. Simple, but the link sits idle for a whole round trip after every frame. A lost frame or ACK is fixed by a timeout and retransmission; the receiver discards duplicates.',
  },
  gbn: {
    title: 'Go-Back-N',
    text: 'Up to N frames may be unacknowledged. The receiver only accepts frames in order and sends cumulative ACKs (“next frame I expect”). On a timeout, the sender resends the oldest unacknowledged frame and everything sent after it.',
  },
  sr: {
    title: 'Selective Repeat',
    text: 'The receiver buffers frames that arrive out of order and acknowledges each one individually. Each frame has its own timer, so only the frames that were really lost are resent.',
  },
}

const TICK = 16
const SX = 170
const RX = 690

export default function SlidingWindow() {
  const [protocol, setProtocol] = useState<Protocol>('gbn')
  const [frames, setFrames] = useState(8)
  const [win, setWin] = useState(4)
  const [delay, setDelay] = useState(3)
  const [timeout, setTimeoutTicks] = useState(10)
  const [lost, setLost] = useState<Set<string>>(new Set(['d:2:0']))
  const [cursor, setCursor] = useState(0)

  const sim = useMemo(() => simulate({ protocol, frames, window: win, delay, timeout, lost }), [protocol, frames, win, delay, timeout, lost])
  const endT = sim.txs.reduce((m, x) => Math.max(m, x.arriveT), sim.finish)
  const height = (endT + 2) * TICK + 50
  const cur = Math.min(cursor, sim.timeline.length - 1)
  const state = sim.timeline[Math.max(0, cur)]
  const W = protocol === 'sw' ? 1 : win

  const toggle = (tx: Tx) => {
    const next = new Set(lost)
    if (next.has(tx.key)) next.delete(tx.key)
    else next.add(tx.key)
    setLost(next)
  }
  const y = (t: number) => 34 + t * TICK

  return (
    <div class="lab-grid">
      <div class="card">
        <div class="lab-controls wrap">
          <Segmented label="Protocol" value={protocol} onChange={setProtocol} options={[
            { value: 'sw', label: 'Stop-and-Wait' }, { value: 'gbn', label: 'Go-Back-N' }, { value: 'sr', label: 'Selective Repeat' },
          ]} />
          <div class="btn-row">
            <button class="btn sm" onClick={() => setLost(new Set())}>No losses</button>
            <button class="btn sm" onClick={() => setLost(new Set(['d:2:0']))}>Lose frame 2</button>
            <button class="btn sm" onClick={() => setLost(new Set(['a:2:0', 'a:1:0']))}>Lose ACKs</button>
          </div>
        </div>
        <div class="sliders">
          <Slider label="Frames to send" value={frames} min={3} max={16} onChange={setFrames} />
          <Slider label="Window size" value={W} min={1} max={8} onChange={setWin} disabled={protocol === 'sw'} />
          <Slider label="One-way delay" value={delay} min={1} max={6} onChange={setDelay} suffix=" ticks" />
          <Slider label="Timeout" value={timeout} min={3} max={30} onChange={setTimeoutTicks} suffix=" ticks" />
        </div>
        {timeout <= 2 * delay && <p class="hint bad">The timeout is shorter than a round trip ({2 * delay} ticks), so frames are resent before their ACKs can possibly return.</p>}
        <Note title={ABOUT[protocol].title}>{ABOUT[protocol].text}</Note>
      </div>

      <div class="card">
        <div class="section-head">
          <h2>Space–time diagram</h2>
          <span class="muted">Time runs downward. Click any arrow to lose it (or bring it back).</span>
        </div>
        <div class="kpis">
          <div><span>Finished at</span><strong>{sim.completed ? `t = ${sim.finish}` : 'not finished'}</strong></div>
          <div><span>Frames sent</span><strong>{sim.dataSent}</strong></div>
          <div><span>Retransmissions</span><strong>{sim.retransmissions}</strong></div>
          <div><span>Efficiency</span><strong>{Math.round((100 * frames) / Math.max(1, sim.dataSent))}%</strong></div>
        </div>

        <div class="winstrip" aria-label="Sender window at the selected time">
          <div class="winstrip-head">
            <span>Sender at t = {cur}</span>
            <input type="range" min={0} max={Math.max(0, sim.timeline.length - 1)} value={cur} onInput={(e) => setCursor(Number((e.currentTarget as HTMLInputElement).value))} aria-label="Time" />
          </div>
          <div class="frames">
            {Array.from({ length: frames }, (_, s) => {
              const inWin = s >= state.base && s < state.base + W
              const cls = state.acked[s] ? 'acked' : s < state.next ? 'sent' : inWin ? 'usable' : 'later'
              return <span key={s} class={`fr ${cls} ${inWin ? 'inwin' : ''}`}>{s}</span>
            })}
          </div>
          <div class="legend"><span class="fr acked">ACKed</span><span class="fr sent">sent, waiting</span><span class="fr usable">can send</span><span class="fr later">outside window</span></div>
        </div>

        <div class="st-scroll">
          <svg class="spacetime" viewBox={`0 0 860 ${height}`} style={{ height: `${height}px` }}>
            <text class="st-head" x={SX} y={18} text-anchor="middle">Sender</text>
            <text class="st-head" x={RX} y={18} text-anchor="middle">Receiver</text>
            <line class="st-axis" x1={SX} x2={SX} y1={26} y2={height - 8} />
            <line class="st-axis" x1={RX} x2={RX} y1={26} y2={height - 8} />
            {Array.from({ length: Math.floor(endT / 5) + 1 }, (_, k) => (
              <text key={k} class="st-tick" x={SX - 14} y={y(k * 5) + 4} text-anchor="end">t={k * 5}</text>
            ))}
            {cur > 0 && <line class="st-cursor" x1={SX - 10} x2={RX + 10} y1={y(cur)} y2={y(cur)} />}
            {sim.txs.map((tx) => {
              const data = tx.kind === 'data'
              const x1 = data ? SX : RX
              const x2 = data ? RX : SX
              const y1 = y(tx.sendT)
              const y2 = y(tx.arriveT)
              const k = tx.lost ? 0.55 : 1
              const ex = x1 + (x2 - x1) * k
              const ey = y1 + (y2 - y1) * k
              const lx = x1 + (x2 - x1) * 0.2
              const ly = y1 + (y2 - y1) * 0.2
              return (
                <g key={tx.key} class={`tx ${tx.kind} ${tx.lost ? 'lost' : ''} ${tx.retx ? 'retx' : ''}`} onClick={() => toggle(tx)}>
                  <line class="hitline" x1={x1} y1={y1} x2={x2} y2={y2} />
                  <line class="shaft" x1={x1} y1={y1} x2={ex} y2={ey} />
                  {tx.lost
                    ? <path class="xmark" d={`M${ex - 6} ${ey - 6}l12 12m0-12l-12 12`} />
                    : <circle class="tip" cx={ex} cy={ey} r={3.5} />}
                  <text class="txlabel" x={lx} y={ly - 5} text-anchor="middle">{data ? `F${tx.seq}` : `ACK ${tx.seq}`}{tx.retx ? (data ? ' ↻' : ' (dup)') : ''}</text>
                  {data && !tx.lost && tx.note && <text class="rxnote" x={RX + 12} y={y2 + 4}>{tx.note}</text>}
                </g>
              )
            })}
          </svg>
        </div>
        <p class="fine">F = data frame, ↻ = retransmission. {protocol === 'sr' ? 'ACK n acknowledges frame n only.' : 'ACK n means “everything before n arrived; send n next”.'}</p>
      </div>

      <div class="card">
        <h2>Formulas worth knowing</h2>
        <div class="table-wrap">
          <table class="lab-table">
            <thead><tr><th /><th>Stop-and-Wait</th><th>Go-Back-N</th><th>Selective Repeat</th></tr></thead>
            <tbody>
              <tr><td>Sender window</td><td>1</td><td>≤ 2<sup>k</sup> − 1</td><td>≤ 2<sup>k−1</sup></td></tr>
              <tr><td>Receiver window</td><td>1</td><td>1</td><td>same as sender</td></tr>
              <tr><td>Resent after a loss</td><td>the lost frame</td><td>lost frame + all after it</td><td>the lost frame only</td></tr>
              <tr><td>Link utilisation (no loss)</td><td>1 / (1 + 2a)</td><td colSpan={2}>min(1, N / (1 + 2a))</td></tr>
            </tbody>
          </table>
        </div>
        <p class="fine">k = bits in the sequence number, a = propagation delay ÷ frame transmission time, N = window size.</p>
      </div>
    </div>
  )
}
