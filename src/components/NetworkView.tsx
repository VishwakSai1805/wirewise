import type { Lesson, LessonPacket } from '../course/types'
import { DeviceGlyph } from './DeviceGlyph'
import { layerColor, topLayer } from './packetInfo'
import type { PlaybackState } from './usePlayback'

interface Props {
  lesson: Lesson
  pb: PlaybackState
  selected: LessonPacket | null
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

function pointAlong(pts: { x: number; y: number }[], t: number) {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y))
  const total = segs.reduce((a, b) => a + b, 0)
  let d = ease(Math.min(1, Math.max(0, t))) * total
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? Math.min(1, d / segs[i]) : 1
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }
    }
    d -= segs[i]
  }
  return pts[pts.length - 1]
}

function Chip({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  const w = Math.max(54, label.length * 9.4 + 30)
  const cx = Math.min(1000 - w / 2 - 4, Math.max(w / 2 + 4, x))
  return (
    <g transform={`translate(${cx} ${y})`} class="chip">
      <rect x={-w / 2} y={-17} width={w} height={34} rx={17} style={{ fill: color }} />
      <text y={6} text-anchor="middle">{label}</text>
    </g>
  )
}

export function NetworkView({ lesson, pb, selected }: Props) {
  const pos = Object.fromEntries(lesson.devices.map((d) => [d.id, d]))
  const active = pb.active ? lesson.packets.find((p) => p.id === pb.active) ?? null : null
  const shown = active ?? selected
  const color = shown ? layerColor(topLayer(shown.build()).id) : 'var(--accent)'
  const busy = new Set(shown ? shown.paths.flat() : [])

  return (
    <svg class="netview" viewBox="0 0 1000 470" role="img" aria-label={`Network diagram for the ${lesson.protocol} lesson`}>
      <g class="links">
        {lesson.links.map(([a, b]) => (
          <line key={a + b} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} />
        ))}
      </g>
      {shown && (
        <g class={active ? 'route route-live' : 'route'} style={{ stroke: color }}>
          {shown.paths.map((path, i) => (
            <polyline key={i} points={path.map((id) => `${pos[id].x},${pos[id].y}`).join(' ')} />
          ))}
        </g>
      )}
      <g class="devices">
        {lesson.devices.map((d) => (
          <g key={d.id} transform={`translate(${d.x} ${d.y})`} class={busy.has(d.id) ? 'device busy' : 'device'}>
            {d.kind === 'cloud' ? (
              <g class="glyph cloud" transform="scale(1.9)"><DeviceGlyph kind="cloud" /></g>
            ) : (
              <>
                <rect class="tile" x={-34} y={-34} width={68} height={68} rx={18} />
                <g class="glyph" transform="scale(1.2)"><DeviceGlyph kind={d.kind} /></g>
              </>
            )}
            <text class="dlabel" y={d.kind === 'cloud' ? 7 : 58} text-anchor="middle">{d.label}</text>
            {d.sub && <text class="dsub" y={78} text-anchor="middle">{d.sub}</text>}
          </g>
        ))}
      </g>
      {active && active.paths.map((path, i) => {
        const p = pointAlong(path.map((id) => pos[id]), pb.t)
        return <Chip key={i} x={p.x} y={p.y} label={active.label} color={color} />
      })}
      {!active && selected && selected.paths.map((path, i) => {
        const end = pos[path[path.length - 1]]
        const prev = pos[path[path.length - 2]]
        const p = { x: end.x + (prev.x - end.x) * 0.34, y: end.y + (prev.y - end.y) * 0.34 }
        return <Chip key={i} x={p.x} y={p.y} label={selected.label} color={color} />
      })}
    </svg>
  )
}
