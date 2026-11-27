import { useEffect, useRef, useState } from 'preact/hooks'
import { glossary } from '../course/glossary'
import { courseOrder } from '../course/order'
import { navigate } from '../lib/router'
import { Icon } from './Icon'

interface Hit { kind: string; title: string; sub: string; to: string; hay: string }

const index: Hit[] = [
  ...courseOrder.map((c) => ({
    kind: c.kind === 'lesson' ? 'Lesson' : 'Lab',
    title: c.kind === 'lesson' ? `${c.short}: ${c.title}` : c.title,
    sub: c.blurb,
    to: c.href,
    hay: `${c.short} ${c.title} ${c.blurb} ${c.unit.title}`.toLowerCase(),
  })),
  ...glossary.map((t) => ({ kind: 'Term', title: t.term, sub: t.def, to: t.link ?? '/glossary', hay: `${t.term} ${t.def}`.toLowerCase() })),
]

export function Search({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hits = (words.length ? index.filter((h) => words.every((w) => h.hay.includes(w))) : index.filter((h) => h.kind !== 'Term')).slice(0, 8)
  const go = (h?: Hit) => { if (h) { navigate(h.to); onClose() } }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(hits.length - 1, n + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)) }
    else if (e.key === 'Enter') go(hits[i])
  }

  return (
    <div class="overlay" onClick={onClose}>
      <div class="palette" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <div class="pal-input">
          <Icon name="search" />
          <input
            ref={input}
            value={q}
            placeholder="Search lessons, labs and terms…"
            onInput={(e) => { setQ((e.currentTarget as HTMLInputElement).value); setI(0) }}
            onKeyDown={onKey}
            aria-label="Search"
          />
          <kbd>Esc</kbd>
        </div>
        <ul class="pal-list" role="listbox">
          {hits.map((h, k) => (
            <li key={h.kind + h.title} role="option" aria-selected={k === i}>
              <button class={k === i ? 'on' : ''} onMouseEnter={() => setI(k)} onClick={() => go(h)}>
                <span class="pal-kind">{h.kind}</span>
                <span class="pal-title">{h.title}</span>
                <span class="pal-sub">{h.sub}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 && <li class="pal-empty">Nothing found for “{q}”.</li>}
        </ul>
      </div>
    </div>
  )
}
