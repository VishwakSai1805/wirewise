import { useMemo, useState } from 'preact/hooks'
import { dijkstra, distanceVector, forwarding, type GEdge, type GNode } from './algo/routing'
import { Note, Segmented } from './ui'

const PRESETS: Record<string, { name: string; nodes: GNode[]; edges: GEdge[] }> = {
  six: {
    name: 'Six routers (classic textbook network)',
    nodes: [
      { id: 'u', x: 90, y: 200 }, { id: 'v', x: 260, y: 70 }, { id: 'w', x: 470, y: 70 },
      { id: 'x', x: 260, y: 330 }, { id: 'y', x: 470, y: 330 }, { id: 'z', x: 640, y: 200 },
    ],
    edges: [
      { a: 'u', b: 'v', w: 2 }, { a: 'u', b: 'x', w: 1 }, { a: 'u', b: 'w', w: 5 }, { a: 'v', b: 'x', w: 2 }, { a: 'v', b: 'w', w: 3 },
      { a: 'x', b: 'w', w: 3 }, { a: 'x', b: 'y', w: 1 }, { a: 'w', b: 'y', w: 1 }, { a: 'w', b: 'z', w: 5 }, { a: 'y', b: 'z', w: 2 },
    ],
  },
  five: {
    name: 'Five routers',
    nodes: [
      { id: 'A', x: 100, y: 120 }, { id: 'B', x: 340, y: 60 }, { id: 'C', x: 600, y: 120 },
      { id: 'D', x: 220, y: 320 }, { id: 'E', x: 500, y: 320 },
    ],
    edges: [
      { a: 'A', b: 'B', w: 4 }, { a: 'A', b: 'D', w: 1 }, { a: 'B', b: 'C', w: 3 }, { a: 'B', b: 'D', w: 2 },
      { a: 'B', b: 'E', w: 6 }, { a: 'D', b: 'E', w: 7 }, { a: 'C', b: 'E', w: 1 },
    ],
  },
}

const fmt = (n: number) => (n === Infinity ? '∞' : String(n))

function Graph({ nodes, edges, highlight, tree, onCost }: {
  nodes: GNode[]
  edges: GEdge[]
  highlight: Set<string>
  tree: Set<string>
  onCost: (i: number, d: number) => void
}) {
  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]))
  return (
    <svg class="graph" viewBox="0 0 730 400" role="img" aria-label="Network graph with link costs">
      {edges.map((e, i) => {
        const a = pos[e.a], b = pos[e.b]
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        const on = tree.has(`${e.a}-${e.b}`) || tree.has(`${e.b}-${e.a}`)
        return (
          <g key={i}>
            <line class={`gedge ${on ? 'on' : ''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <g class="gcost" transform={`translate(${mx} ${my})`}>
              <rect x={-26} y={-14} width={52} height={28} rx={14} />
              <text class="gminus" x={-15} y={5} text-anchor="middle" onClick={() => onCost(i, -1)}>−</text>
              <text class="gval" x={0} y={5} text-anchor="middle">{e.w}</text>
              <text class="gplus" x={15} y={5} text-anchor="middle" onClick={() => onCost(i, 1)}>+</text>
            </g>
          </g>
        )
      })}
      {nodes.map((n) => (
        <g key={n.id} class={`gnode ${highlight.has(n.id) ? 'on' : ''}`} transform={`translate(${n.x} ${n.y})`}>
          <circle r={24} />
          <text y={6} text-anchor="middle">{n.id}</text>
        </g>
      ))}
    </svg>
  )
}

export default function Routing() {
  const [presetId, setPresetId] = useState('six')
  const [edges, setEdges] = useState(PRESETS.six.edges)
  const [mode, setMode] = useState<'ls' | 'dv'>('ls')
  const [src, setSrc] = useState('u')
  const [k, setK] = useState(0)
  const nodes = PRESETS[presetId].nodes
  const ids = nodes.map((n) => n.id)

  const steps = useMemo(() => dijkstra(nodes, edges, src), [nodes, edges, src])
  const rounds = useMemo(() => distanceVector(nodes, edges), [nodes, edges])
  const maxK = mode === 'ls' ? steps.length - 1 : rounds.length - 1
  const kk = Math.min(k, maxK)

  const choosePreset = (id: string) => { setPresetId(id); setEdges(PRESETS[id].edges); setSrc(PRESETS[id].nodes[0].id); setK(0) }
  const cost = (i: number, d: number) => { setEdges(edges.map((e, j) => (j === i ? { ...e, w: Math.max(1, Math.min(20, e.w + d)) } : e))); setK(0) }

  const step = steps[kk]
  const tree = new Set<string>()
  if (mode === 'ls') for (const id of step.done) if (step.p[id]) tree.add(`${step.p[id]}-${id}`)
  const highlight = new Set(mode === 'ls' ? step.done : [])
  const others = ids.filter((id) => id !== src)
  const finalTable = forwarding(src, steps[steps.length - 1])

  return (
    <div class="lab-grid">
      <div class="card">
        <div class="lab-controls wrap">
          <Segmented label="Algorithm" value={mode} onChange={(m) => { setMode(m); setK(0) }} options={[{ value: 'ls', label: 'Link state (Dijkstra)' }, { value: 'dv', label: 'Distance vector (Bellman-Ford)' }]} />
          <label class="inline">Network
            <select value={presetId} onChange={(e) => choosePreset((e.currentTarget as HTMLSelectElement).value)}>
              {Object.entries(PRESETS).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
            </select>
          </label>
          {mode === 'ls' && (
            <label class="inline">Source
              <select value={src} onChange={(e) => { setSrc((e.currentTarget as HTMLSelectElement).value); setK(0) }}>
                {ids.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          )}
        </div>
        <Graph nodes={nodes} edges={edges} highlight={highlight} tree={tree} onCost={cost} />
        <div class="stepper">
          <button class="btn" onClick={() => setK(Math.max(0, kk - 1))} disabled={kk === 0}>← Back</button>
          <span>{mode === 'ls' ? `Step ${kk} of ${maxK}: added ${step.added} to N′` : `Round ${kk} of ${maxK}`}</span>
          <button class="btn primary" onClick={() => setK(Math.min(maxK, kk + 1))} disabled={kk === maxK}>Next →</button>
        </div>
        <p class="fine">Use − and + on a link to change its cost; the algorithm restarts.</p>
      </div>

      {mode === 'ls' ? (
        <div class="card">
          <h2>Dijkstra table from {src}</h2>
          <div class="table-wrap">
            <table class="lab-table dij">
              <thead><tr><th>Step</th><th>N′</th>{others.map((id) => <th key={id}>D({id}), p({id})</th>)}</tr></thead>
              <tbody>
                {steps.slice(0, kk + 1).map((s, i) => (
                  <tr key={i} class={i === kk ? 'cur' : ''}>
                    <td>{i}</td>
                    <td class="mono">{s.done.join('')}</td>
                    {others.map((id) => {
                      const settled = s.done.includes(id) && steps[i - 1]?.done.includes(id)
                      return <td key={id} class={`mono ${settled ? 'settled' : ''}`}>{settled ? '' : s.D[id] === Infinity ? '∞' : `${s.D[id]}, ${s.p[id]}`}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {kk === maxK && (
            <>
              <h3 class="mt">Forwarding table at {src}</h3>
              <div class="table-wrap">
                <table class="lab-table">
                  <thead><tr><th>Destination</th><th>Next hop</th><th>Cost</th><th>Path</th></tr></thead>
                  <tbody>{finalTable.map((r) => <tr key={r.dest}><td>{r.dest}</td><td class="mono">{r.next}</td><td class="mono">{fmt(r.cost)}</td><td class="mono">{r.path.join(' → ')}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
          <Note>Each step moves the closest not-yet-settled node into N′ and relaxes its neighbours: D(v) = min(D(v), D(w) + c(w, v)). Link-state protocols such as OSPF run exactly this on every router.</Note>
        </div>
      ) : (
        <div class="card">
          <h2>Distance vectors after round {kk}</h2>
          <div class="dv-grid">
            {ids.map((x) => (
              <div class="dv-card" key={x}>
                <div class="dv-title">Router {x}</div>
                <table class="lab-table">
                  <tbody>
                    {ids.map((y) => {
                      const changed = kk > 0 && rounds[kk][x][y] !== rounds[kk - 1][x][y]
                      return <tr key={y} class={changed ? 'changed' : ''}><td>to {y}</td><td class="mono">{fmt(rounds[kk][x][y])}</td></tr>
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p class="muted">{kk === maxK ? `Converged: no table changes after round ${maxK}.` : 'Highlighted cells changed in this round.'}</p>
          <Note>Each round, every router receives its neighbours’ vectors and applies Bellman-Ford: D<sub>x</sub>(y) = min over neighbours v of c(x, v) + D<sub>v</sub>(y). Good news spreads fast; a cost increase can cause “count to infinity”, which RIP limits by treating 16 as infinite.</Note>
        </div>
      )}
    </div>
  )
}
