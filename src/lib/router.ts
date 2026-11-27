// A tiny hash router: #/learn/tcp?step=2 → { parts: ['learn','tcp'], query }.
// Hash URLs work on GitHub Pages without any server configuration.
import { useEffect, useState } from 'preact/hooks'

export interface Route {
  path: string
  parts: string[]
  query: URLSearchParams
}

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/'
  const [p, q = ''] = h.split('?')
  const path = p.startsWith('/') ? p : '/' + p
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(q) }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export const href = (to: string) => '#' + to

export function navigate(to: string) {
  location.hash = to
}

/** Update the URL without adding a history entry or re-rendering (for shareable step links). */
export function replaceUrl(to: string) {
  history.replaceState(history.state, '', '#' + to)
}
