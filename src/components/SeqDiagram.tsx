// A message sequence chart: one column per participant, one arrow per message.
// Used by the lesson player, the exam builder and the exam results.
// It is drawn at the container's real pixel width so text never shrinks.
import { useLayoutEffect, useRef, useState } from 'preact/hooks'

export interface SeqParticipant { id: string; label: string; sub?: string }

export interface SeqRow {
  key: string
  label: string
  from: string
  to: string
  broadcast?: boolean
  time?: string
  color?: string
  /** 0..1 while the arrow is being drawn */
  progress?: number
  tone?: 'current' | 'ok' | 'bad' | 'warn' | 'past'
  selected?: boolean
}

interface Props {
  participants: SeqParticipant[]
  rows: SeqRow[]
  onSelect?: (key: string) => void
  empty?: string
  compact?: boolean
}

const TOP = 76

export function SeqDiagram({ participants, rows, onSelect, empty, compact }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(720)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = (w: number) => setW(Math.max(500, Math.floor(w)))
    measure(el.clientWidth)
    const ro = new ResizeObserver(([e]) => measure(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const gutter = rows.some((r) => r.time) ? 78 : 16
  const rowH = compact ? 38 : 46
  const colW = (W - gutter - 16) / participants.length
  const x = (id: string) => gutter + colW * (participants.findIndex((p) => p.id === id) + 0.5)
  const height = Math.max(TOP + rows.length * rowH + 24, compact ? 150 : 220)
  const boxW = Math.min(170, colW - 14)

  return (
    <div class="seq-wrap" ref={wrap}>
    <svg class="seq" width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Message sequence diagram">
      {participants.map((p) => (
        <g key={p.id}>
          <line class="lifeline" x1={x(p.id)} y1={54} x2={x(p.id)} y2={height - 8} />
          <rect class="pbox" x={x(p.id) - boxW / 2} y={8} width={boxW} height={p.sub ? 46 : 36} rx={10} />
          <text class="plabel" x={x(p.id)} y={p.sub ? 28 : 31} text-anchor="middle">{p.label}</text>
          {p.sub && <text class="psub" x={x(p.id)} y={44} text-anchor="middle">{p.sub}</text>}
        </g>
      ))}
      {rows.length === 0 && empty && (
        <text class="seq-empty" x={W / 2} y={TOP + 50} text-anchor="middle">{empty}</text>
      )}
      {rows.map((r, i) => {
        const y = TOP + 22 + i * rowH
        const x1 = x(r.from)
        const x2 = x(r.to)
        const k = r.progress ?? 1
        const tip = x1 + (x2 - x1) * k
        const dir = Math.sign(x2 - x1) || 1
        const others = r.broadcast ? participants.filter((p) => p.id !== r.from && p.id !== r.to) : []
        return (
          <g
            key={r.key}
            class={`srow ${r.tone ?? ''} ${r.selected ? 'sel' : ''} ${onSelect ? 'clickable' : ''}`}
            style={r.color ? { color: r.color } : undefined}
            onClick={onSelect ? () => onSelect(r.key) : undefined}
          >
            <rect class="hit" x={0} y={y - rowH / 2 - 4} width={W} height={rowH} rx={8} />
            {r.time && <text class="stime" x={10} y={y + 4}>{r.time}</text>}
            {others.map((o) => (
              <line key={o.id} class="bcast" x1={x1} y1={y} x2={x1 + (x(o.id) - x1) * k} y2={y} />
            ))}
            <line class="arrow" x1={x1} y1={y} x2={tip - dir * 2} y2={y} />
            <path class="head" d={`M${tip} ${y} l${-dir * 10} -5.5 v11 z`} />
            {k > 0.25 && (
              <text class="slabel" x={(x1 + x2) / 2} y={y - 9} text-anchor="middle">
                {r.label}{r.broadcast ? ' (broadcast)' : ''}
              </text>
            )}
          </g>
        )
      })}
    </svg>
    </div>
  )
}
