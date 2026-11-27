import { useState } from 'preact/hooks'
import { isBits } from './algo/errors'
import { Note, TextField } from './ui'

type Level = 1 | 0 | -1

interface Scheme {
  id: string
  name: string
  rule: string
  /** two half-bit levels per bit */
  encode: (bits: string) => Level[]
  props: [string, string, string, string]
}

const SCHEMES: Scheme[] = [
  {
    id: 'nrzl', name: 'NRZ-L', rule: 'Level shows the bit: 0 = high, 1 = low (Forouzan’s convention; some books swap them).',
    encode: (b) => Array.from(b).flatMap((c) => (c === '0' ? [1, 1] : [-1, -1]) as Level[]),
    props: ['No', 'Yes (long runs)', 'No', 'RS-232 style serial links'],
  },
  {
    id: 'nrzi', name: 'NRZ-I', rule: 'A 1 inverts the level at the start of the bit; a 0 keeps it. The line starts high.',
    encode: (b) => { let l: Level = 1; return Array.from(b).flatMap((c) => { if (c === '1') l = (l === 1 ? -1 : 1); return [l, l] }) },
    props: ['No', 'Yes (runs of 0s)', 'No (runs of 0s)', 'USB, 100BASE-FX (with 4B/5B)'],
  },
  {
    id: 'manch', name: 'Manchester', rule: 'Transition in the middle of every bit: 0 = high→low, 1 = low→high (IEEE 802.3 convention).',
    encode: (b) => Array.from(b).flatMap((c) => (c === '0' ? [1, -1] : [-1, 1]) as Level[]),
    props: ['Every bit', 'No', 'Yes', '10 Mb/s Ethernet (10BASE-T)'],
  },
  {
    id: 'dman', name: 'Differential Manchester', rule: 'Always a mid-bit transition; a 0 adds a transition at the start of the bit, a 1 does not. The line starts high.',
    encode: (b) => { let last: Level = 1; return Array.from(b).flatMap((c) => { const first: Level = c === '0' ? (last === 1 ? -1 : 1) : last; last = first === 1 ? -1 : 1; return [first, last] }) },
    props: ['Every bit', 'No', 'Yes', 'Token Ring (802.5)'],
  },
  {
    id: 'ami', name: 'AMI (bipolar)', rule: '0 = zero volts; each 1 alternates between high and low.',
    encode: (b) => { let next: Level = 1; return Array.from(b).flatMap((c) => { if (c === '0') return [0, 0] as Level[]; const l = next; next = next === 1 ? -1 : 1; return [l, l] }) },
    props: ['No', 'No', 'No (runs of 0s)', 'T1 lines (with B8ZS scrambling)'],
  },
  {
    id: 'pseudo', name: 'Pseudoternary', rule: 'The mirror of AMI: 1 = zero volts; each 0 alternates between high and low.',
    encode: (b) => { let next: Level = 1; return Array.from(b).flatMap((c) => { if (c === '1') return [0, 0] as Level[]; const l = next; next = next === 1 ? -1 : 1; return [l, l] }) },
    props: ['No', 'No', 'No (runs of 1s)', 'ISDN basic-rate interface'],
  },
]

function Wave({ bits, levels }: { bits: string; levels: Level[] }) {
  const cell = 46
  const w = bits.length * cell
  const h = 96
  const y = (l: Level) => 48 - l * 32
  let d = `M0 ${y(levels[0])}`
  levels.forEach((l, i) => {
    const x0 = (i * cell) / 2
    if (i > 0 && levels[i - 1] !== l) d += ` L${x0} ${y(l)}`
    d += ` L${x0 + cell / 2} ${y(l)}`
  })
  return (
    <svg class="wave" viewBox={`-30 0 ${w + 40} ${h + 22}`} style={{ minWidth: `${Math.min(w, 900)}px` }} aria-hidden="true">
      {[1, 0, -1].map((l) => (
        <g key={l}>
          <line class="wave-axis" x1={0} x2={w} y1={y(l as Level)} y2={y(l as Level)} />
          <text class="wave-lvl" x={-8} y={y(l as Level) + 4} text-anchor="end">{l === 1 ? '+V' : l === 0 ? '0' : '−V'}</text>
        </g>
      ))}
      {Array.from(bits).map((b, i) => (
        <g key={i}>
          <line class="wave-cell" x1={i * cell} x2={i * cell} y1={4} y2={h - 4} />
          <line class="wave-mid" x1={i * cell + cell / 2} x2={i * cell + cell / 2} y1={10} y2={h - 10} />
          <text class="wave-bit" x={i * cell + cell / 2} y={h + 16} text-anchor="middle">{b}</text>
        </g>
      ))}
      <line class="wave-cell" x1={w} x2={w} y1={4} y2={h - 4} />
      <path class="wave-line" d={d} />
    </svg>
  )
}

export default function LineCoding() {
  const [bits, setBits] = useState('01001110')
  const [shown, setShown] = useState<Set<string>>(new Set(['nrzl', 'nrzi', 'manch', 'dman', 'ami']))
  const valid = isBits(bits) && bits.length <= 24
  const b = valid ? bits : '0'

  const toggle = (id: string) => {
    const next = new Set(shown)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setShown(next)
  }

  return (
    <div class="lab-grid">
      <div class="card">
        <div class="lab-controls">
          <TextField label="Bits to send (up to 24)" value={bits} onInput={(v) => setBits(v.replace(/\s/g, ''))} error={valid ? undefined : 'Use only 0 and 1, at most 24 bits.'} />
          <div class="chips-row">
            {['00000000', '11111111', '01010101', '10110010'].map((p) => <button key={p} class="btn sm" onClick={() => setBits(p)}>{p}</button>)}
          </div>
        </div>
        <div class="toggles">
          {SCHEMES.map((s) => (
            <label key={s.id} class={`toggle ${shown.has(s.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={shown.has(s.id)} onChange={() => toggle(s.id)} /> {s.name}
            </label>
          ))}
        </div>
      </div>

      {SCHEMES.filter((s) => shown.has(s.id)).map((s) => (
        <div class="card wave-card" key={s.id}>
          <div class="wave-head"><h2>{s.name}</h2><p class="muted">{s.rule}</p></div>
          <div class="wave-scroll"><Wave bits={b} levels={s.encode(b)} /></div>
        </div>
      ))}

      <div class="card">
        <h2>Compare the schemes</h2>
        <div class="table-wrap">
          <table class="lab-table">
            <thead><tr><th>Scheme</th><th>Mid-bit transition</th><th>DC component</th><th>Self-clocking</th><th>Used in</th></tr></thead>
            <tbody>{SCHEMES.map((s) => <tr key={s.id}><td><strong>{s.name}</strong></td>{s.props.map((p, i) => <td key={i}>{p}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <Note title="Things to notice">
          Try 00000000 and 11111111. NRZ-L becomes a flat line: the receiver loses track of where bits start (no clock) and the average voltage drifts (DC component).
          Manchester always has a transition, so it carries its own clock, at the cost of twice the signal rate (baud = 2 × bit rate).
        </Note>
      </div>
    </div>
  )
}
