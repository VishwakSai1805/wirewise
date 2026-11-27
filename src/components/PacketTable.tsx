import type { Lesson } from '../course/types'
import { endpoints, formatTime, layerColor, topLayer } from './packetInfo'

interface Props {
  lesson: Lesson
  revealed: Set<string>
  current: Set<string>
  selectedId: string | null
  onSelect: (id: string) => void
}

export function PacketTable({ lesson, revealed, current, selectedId, onSelect }: Props) {
  const rows = lesson.packets.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) => revealed.has(p.id))
  return (
    <div class="ptable-wrap">
      <table class="ptable">
        <thead>
          <tr>
            <th>No.</th><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Length</th><th>Info</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr class="empty"><td colSpan={7}>No packets yet. Press play or step forward.</td></tr>
          )}
          {rows.map(({ p, n }) => {
            const pkt = p.build()
            const [src, dst] = endpoints(pkt)
            const top = topLayer(pkt)
            return (
              <tr
                key={p.id}
                class={`${current.has(p.id) ? 'cur' : ''} ${selectedId === p.id ? 'sel' : ''}`}
                onClick={() => onSelect(p.id)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(p.id) }}
                aria-selected={selectedId === p.id}
              >
                <td class="num">{n}</td>
                <td class="num">{formatTime(p.t)}</td>
                <td class="mono">{src}</td>
                <td class="mono">{dst}</td>
                <td><span class="proto" style={{ '--c': layerColor(top.id) }}>{top.short}</span></td>
                <td class="num">{pkt.bytes.length}</td>
                <td class="info">{p.info}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
