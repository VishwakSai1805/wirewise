// Decoded field tree + synchronized hex dump. Selecting a field highlights its
// bytes; clicking a byte selects the field that owns it.
import { useMemo, useState } from 'preact/hooks'
import type { Field, Packet } from '../packets/build'
import { layerColor } from './packetInfo'

const h2 = (b: number) => b.toString(16).padStart(2, '0')

export function Inspector({ packet, title }: { packet: Packet | null; title?: string }) {
  const [sel, setSel] = useState<Field | null>(null)
  const [hover, setHover] = useState<Field | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())

  const owner = useMemo(() => {
    if (!packet) return []
    const map: { layer: number; field: Field | null }[] = []
    packet.layers.forEach((l, li) => {
      for (let i = l.start; i < l.end; i++) map[i] = { layer: li, field: l.fields.find((f) => i >= f.start && i < f.end) ?? null }
    })
    return map
  }, [packet])

  if (!packet) {
    return (
      <div class="inspector empty-state">
        <p>Select a packet to decode its headers, field by field.</p>
      </div>
    )
  }

  const focus = hover ?? sel
  const inFocus = (i: number) => !!focus && i >= focus.start && i < focus.end
  const rows: number[][] = []
  for (let i = 0; i < packet.bytes.length; i += 16) rows.push(Array.from({ length: Math.min(16, packet.bytes.length - i) }, (_, k) => i + k))

  const toggle = (id: string) => {
    const next = new Set(closed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setClosed(next)
  }

  return (
    <div class="inspector">
      <div class="tree" role="tree" aria-label="Decoded headers">
        {title && <div class="insp-title">{title}</div>}
        {packet.layers.map((l) => (
          <div class="layer" key={l.id + l.start} style={{ '--c': layerColor(l.id) }}>
            <button class="layer-head" onClick={() => toggle(l.id)} aria-expanded={!closed.has(l.id)}>
              <span class="swatch" />
              <span class="lname">{l.name}</span>
              <span class="lsize">{l.end - l.start} B</span>
            </button>
            {!closed.has(l.id) && (
              <div class="fields">
                {l.fields.map((f) => (
                  <button
                    key={f.name + f.start}
                    role="treeitem"
                    class={`field ${sel === f ? 'sel' : ''} ${hover === f ? 'hov' : ''}`}
                    onClick={() => setSel(sel === f ? null : f)}
                    onMouseEnter={() => setHover(f)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <span class="fname">{f.name}</span>
                    <span class="fval">{f.value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div class="hexside">
        <div class="hex" aria-label="Raw bytes in hexadecimal">
          {rows.map((r) => (
            <div class="hexrow" key={r[0]}>
              <span class="off">{r[0].toString(16).padStart(4, '0')}</span>
              <span class="bytes">
                {r.map((i) => (
                  <span
                    key={i}
                    class={`b ${inFocus(i) ? 'on' : ''}`}
                    style={{ '--c': layerColor(packet.layers[owner[i]?.layer ?? 0].id) }}
                    onClick={() => setSel(owner[i]?.field ?? null)}
                    onMouseEnter={() => setHover(owner[i]?.field ?? null)}
                    onMouseLeave={() => setHover(null)}
                  >{h2(packet.bytes[i])}</span>
                ))}
              </span>
              <span class="ascii">
                {r.map((i) => {
                  const b = packet.bytes[i]
                  return <span key={i} class={inFocus(i) ? 'on' : ''}>{b >= 32 && b < 127 ? String.fromCharCode(b) : '·'}</span>
                })}
              </span>
            </div>
          ))}
        </div>
        <div class="explain" aria-live="polite">
          {focus ? (
            <>
              <div class="ex-head">
                <strong>{focus.name}</strong>
                <span class="mono">bytes {focus.start}–{focus.end - 1} · {focus.end - focus.start} B</span>
              </div>
              <div class="ex-val mono">{focus.value}</div>
              <div class="ex-hex mono">{Array.from(packet.bytes.slice(focus.start, Math.min(focus.end, focus.start + 24)), h2).join(' ')}{focus.end - focus.start > 24 ? ' …' : ''}</div>
              {focus.note && <p>{focus.note}</p>}
            </>
          ) : (
            <p class="muted">Click a field or a byte to see what it means. Colours mark the layers: each header wraps the one inside it.</p>
          )}
        </div>
      </div>
    </div>
  )
}
