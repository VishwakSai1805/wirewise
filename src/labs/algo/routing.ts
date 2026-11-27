export interface GNode { id: string; x: number; y: number }
export interface GEdge { a: string; b: string; w: number }

const INF = Infinity

function neighbours(edges: GEdge[], id: string) {
  return edges.flatMap((e) => (e.a === id ? [{ v: e.b, w: e.w }] : e.b === id ? [{ v: e.a, w: e.w }] : []))
}

export interface DijkstraStep {
  added: string
  done: string[]
  D: Record<string, number>
  p: Record<string, string | null>
}

/** Dijkstra’s algorithm as in the link-state table: one row per node added to N′. */
export function dijkstra(nodes: GNode[], edges: GEdge[], src: string) {
  const D: Record<string, number> = {}
  const p: Record<string, string | null> = {}
  for (const n of nodes) { D[n.id] = INF; p[n.id] = null }
  D[src] = 0
  for (const { v, w } of neighbours(edges, src)) { D[v] = w; p[v] = src }
  const done = [src]
  const steps: DijkstraStep[] = [{ added: src, done: [...done], D: { ...D }, p: { ...p } }]
  while (done.length < nodes.length) {
    const rest = nodes.map((n) => n.id).filter((id) => !done.includes(id)).sort()
    const w = rest.reduce((best, id) => (D[id] < D[best] ? id : best), rest[0])
    if (D[w] === INF) break
    done.push(w)
    for (const { v, w: c } of neighbours(edges, w)) {
      if (done.includes(v)) continue
      if (D[w] + c < D[v]) { D[v] = D[w] + c; p[v] = w }
    }
    steps.push({ added: w, done: [...done], D: { ...D }, p: { ...p } })
  }
  return steps
}

/** Forwarding table from the predecessor map: first hop towards each destination. */
export function forwarding(src: string, final: DijkstraStep) {
  return Object.keys(final.D)
    .filter((d) => d !== src)
    .sort()
    .map((dest) => {
      let hop = dest
      const path = [dest]
      while (final.p[hop] && final.p[hop] !== src) { hop = final.p[hop]!; path.unshift(hop) }
      path.unshift(src)
      return { dest, next: final.D[dest] === INF ? '—' : hop, cost: final.D[dest], path }
    })
}

export type Vectors = Record<string, Record<string, number>>

/** Synchronous distance-vector rounds (Bellman-Ford) until nothing changes. */
export function distanceVector(nodes: GNode[], edges: GEdge[]) {
  const ids = nodes.map((n) => n.id)
  const cost = (x: string, y: string) => edges.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x))?.w ?? INF
  let cur: Vectors = {}
  for (const x of ids) {
    cur[x] = {}
    for (const y of ids) cur[x][y] = x === y ? 0 : cost(x, y)
  }
  const rounds: Vectors[] = [cur]
  for (let r = 0; r < 50; r++) {
    const nxt: Vectors = {}
    let changed = false
    for (const x of ids) {
      nxt[x] = {}
      for (const y of ids) {
        if (x === y) { nxt[x][y] = 0; continue }
        let best = INF
        for (const { v, w } of neighbours(edges, x)) best = Math.min(best, w + cur[v][y])
        nxt[x][y] = best
        if (best !== cur[x][y]) changed = true
      }
    }
    if (!changed) break
    rounds.push(nxt)
    cur = nxt
  }
  return rounds
}
