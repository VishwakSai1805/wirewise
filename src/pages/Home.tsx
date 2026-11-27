import { useRef, useState } from 'preact/hooks'
import { lessonById, lessons } from '../course/lessons'
import { courseOrder } from '../course/order'
import { labs, units } from '../course/syllabus'
import { Icon } from '../components/Icon'
import { completion, exportProgress, importProgress, resetProgress, useProgress } from '../lib/progress'
import { href } from '../lib/router'

/** The hero picture is itself a lesson: how one message is wrapped layer by layer. */
function EncapArt() {
  const rows = [
    { name: 'Application', parts: [['HTTP data', 'l7', 360]] },
    { name: 'Transport', parts: [['TCP', 'l4', 90], ['data', 'l7', 360]] },
    { name: 'Network', parts: [['IP', 'l3', 80], ['TCP', 'l4', 90], ['data', 'l7', 360]] },
    { name: 'Data link', parts: [['Eth', 'l2', 70], ['IP', 'l3', 80], ['TCP', 'l4', 90], ['data', 'l7', 360], ['FCS', 'l2', 50]] },
  ] as const
  return (
    <svg class="encap-art" viewBox="0 0 760 330" role="img" aria-label="Encapsulation: each layer adds a header around the data from the layer above">
      {rows.map((r, i) => {
        const total = r.parts.reduce((a, p) => a + p[2], 0)
        let x = 760 - total
        return (
          <g key={r.name} transform={`translate(0 ${10 + i * 80})`} style={{ animationDelay: `${i * 140}ms` }} class="encap-row">
            <text class="encap-name" x={0} y={33}>{r.name}</text>
            {r.parts.map(([label, layer, w]) => {
              const g = (
                <g key={label + x}>
                  <rect x={x} y={4} width={w - 4} height={46} rx={10} style={{ fill: `var(--l-${layer})` }} />
                  <text x={x + (w - 4) / 2} y={33} text-anchor="middle">{label}</text>
                </g>
              )
              x += w
              return g
            })}
          </g>
        )
      })}
    </svg>
  )
}

function Ring({ value }: { value: number }) {
  if (value >= 1) return <span class="ring done" title="Completed"><Icon name="check" size={13} /></span>
  const c = 2 * Math.PI * 8
  return (
    <span class="ring" title={value ? `${Math.round(value * 100)}% done` : 'Not started'}>
      <svg viewBox="0 0 20 20" width="20" height="20">
        <circle cx="10" cy="10" r="8" class="ring-bg" />
        {value > 0 && <circle cx="10" cy="10" r="8" class="ring-fg" stroke-dasharray={`${c * value} ${c}`} transform="rotate(-90 10 10)" />}
      </svg>
    </span>
  )
}

export function Home() {
  const progress = useProgress()
  const fileInput = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const stepsOf = (kind: string, id: string) => (kind === 'lesson' ? lessonById(id)!.steps.length : 1)
  const done = courseOrder.reduce((a, it) => a + completion(progress, it.kind, it.id, stepsOf(it.kind, it.id)), 0)
  const pct = Math.round((100 * done) / courseOrder.length)
  const resume = progress.last ? courseOrder.find((c) => c.href === progress.last) : undefined

  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wirewise-progress.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const upload = async (e: Event) => {
    const f = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!f) return
    setMsg(importProgress(await f.text()) ? 'Progress imported.' : 'That file is not a Wirewise progress file.')
    ;(e.currentTarget as HTMLInputElement).value = ''
  }

  return (
    <div class="page home">
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">Free forever · open source · no account</p>
          <h1>Computer networks, packet&nbsp;by&nbsp;packet.</h1>
          <p class="lede">
            Watch real packets cross a network, open every header down to the byte, and practise the algorithms
            from your syllabus in hands-on labs. Built as course material, free for everyone.
          </p>
          <div class="cta">
            <a class="btn primary lg" href={href(resume ? resume.href : courseOrder[0].href)}>
              {resume ? `Continue: ${resume.kind === 'lesson' ? resume.short : resume.title}` : 'Start the course'} <Icon name="arrow" />
            </a>
            <a class="btn lg" href={href('/learn/http')}>Watch a web request</a>
          </div>
          <ul class="stats">
            <li><strong>{lessons.length}</strong> animated lessons</li>
            <li><strong>{labs.length}</strong> interactive labs</li>
            <li><strong>{lessons.reduce((a, l) => a + l.quiz.length, 0)}</strong> quiz questions</li>
            <li><strong>0</strong> fees</li>
          </ul>
        </div>
        <EncapArt />
      </section>

      <section class="map" aria-labelledby="map-title">
        <div class="map-head">
          <h2 id="map-title">Course map</h2>
          <div class="overall" aria-label={`Overall progress ${pct}%`}>
            <div class="bar"><span style={{ width: `${pct}%` }} /></div>
            <span>{pct}% complete</span>
          </div>
        </div>
        <ol class="units">
          {units.map((u) => (
            <li class="unit" key={u.id}>
              <div class="unit-n" aria-hidden="true">{u.n}</div>
              <div class="unit-body">
                <h3>{u.title}</h3>
                <p class="muted">{u.blurb}</p>
                <div class="items">
                  {u.items.map((it) => {
                    const c = courseOrder.find((x) => x.kind === it.kind && x.id === it.id)!
                    return (
                      <a class={`item ${it.kind}`} key={it.id} href={href(c.href)}>
                        <span class="item-top">
                          <span class="kind"><Icon name={it.kind === 'lesson' ? 'book' : 'flask'} size={14} /> {it.kind === 'lesson' ? 'Lesson' : 'Lab'}</span>
                          <span class="layer-tag">{c.layer}</span>
                          <Ring value={completion(progress, it.kind, it.id, stepsOf(it.kind, it.id))} />
                        </span>
                        <span class="item-title">{it.kind === 'lesson' && <span class="proto-name">{c.short}</span>} {c.title}</span>
                        <span class="item-blurb">{c.blurb}</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section class="card tools">
        <div>
          <h2>Your progress stays on this device</h2>
          <p class="muted">Nothing is uploaded and there is no account. To continue on another computer, export your progress and import it there.</p>
        </div>
        <div class="tool-buttons">
          <button class="btn" onClick={download}><Icon name="download" size={16} /> Export</button>
          <button class="btn" onClick={() => fileInput.current?.click()}><Icon name="upload" size={16} /> Import</button>
          <button class="btn ghost" onClick={() => { if (confirm('Clear all progress on this device?')) { resetProgress(); setMsg('Progress cleared.') } }}>Reset</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={upload} />
        </div>
        {msg && <p class="hint" role="status">{msg}</p>}
      </section>
    </div>
  )
}
