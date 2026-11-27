import { useState } from 'preact/hooks'
import { glossary } from '../course/glossary'
import { href } from '../lib/router'

export function Glossary() {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const terms = glossary.filter((t) => !needle || t.term.toLowerCase().includes(needle) || t.def.toLowerCase().includes(needle))
  return (
    <div class="page narrow glossary">
      <header class="page-head">
        <div class="kicker"><a href={href('/')}>Course</a><span>/</span><span>Glossary</span></div>
        <h1>Glossary</h1>
        <p class="lede">Short definitions of the terms used in the course. Most link to the lesson or lab where you can see them in action.</p>
      </header>
      <input class="filter" type="search" placeholder="Filter terms…" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} aria-label="Filter terms" />
      <dl class="terms">
        {terms.map((t) => (
          <div key={t.term} class="term">
            <dt>{t.term}</dt>
            <dd>
              {t.def}
              {t.link && <> <a href={href(t.link)}>See it →</a></>}
            </dd>
          </div>
        ))}
        {terms.length === 0 && <p class="muted">No terms match “{q}”.</p>}
      </dl>
    </div>
  )
}
