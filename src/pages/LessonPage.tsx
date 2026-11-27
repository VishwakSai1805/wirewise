import { useEffect, useMemo, useState } from 'preact/hooks'
import { lessonById } from '../course/lessons'
import { neighbours } from '../course/order'
import type { Lesson } from '../course/types'
import { CourseNav } from '../components/CourseNav'
import { Icon } from '../components/Icon'
import { Inspector } from '../components/Inspector'
import { PacketTable } from '../components/PacketTable'
import { Quiz } from '../components/Quiz'
import { Stage } from '../components/Stage'
import { markStep, useProgress } from '../lib/progress'
import { href, replaceUrl } from '../lib/router'
import { NotFound } from './NotFound'

/** Packet ids revealed when sitting at step `s` (optionally including that step's own packets). */
function upTo(lesson: Lesson, s: number, includeCurrent: boolean) {
  const ids = lesson.steps.slice(0, includeCurrent ? s + 1 : s).flatMap((st) => st.packets)
  return new Set(ids)
}

function lastPacket(lesson: Lesson, s: number): string | null {
  for (let i = s; i >= 0; i--) {
    const p = lesson.steps[i].packets
    if (p.length) return p[p.length - 1]
  }
  return null
}

export function LessonPage({ id, query }: { id: string; query: URLSearchParams }) {
  const lesson = lessonById(id)
  if (!lesson) return <NotFound />
  const raw = parseInt(query.get('step') ?? '1', 10)
  const initial = Math.min(lesson.steps.length - 1, Math.max(0, (Number.isFinite(raw) ? raw : 1) - 1))
  return <Player key={lesson.id} lesson={lesson} initial={initial} />
}

function Player({ lesson, initial }: { lesson: Lesson; initial: number }) {
  const last = lesson.steps.length - 1
  const [step, setStep] = useState(initial)
  const [run, setRun] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [view, setView] = useState<'network' | 'sequence'>('network')
  const [speed, setSpeed] = useState(1)
  const [revealed, setRevealed] = useState(() => upTo(lesson, initial, true))
  const [selectedId, setSelectedId] = useState<string | null>(() => lastPacket(lesson, initial))
  const progress = useProgress()
  const { item } = neighbours('lesson', lesson.id)

  const cur = lesson.steps[step]
  const currentIds = useMemo(() => new Set(cur.packets), [cur])
  const selected = selectedId ? lesson.packets.find((p) => p.id === selectedId) ?? null : null
  const selectedNo = selected ? lesson.packets.indexOf(selected) + 1 : 0

  useEffect(() => {
    markStep(lesson.id, step, lesson.steps.length)
    replaceUrl(`/learn/${lesson.id}?step=${step + 1}`)
  }, [step])

  const goto = (s: number) => {
    const n = Math.min(last, Math.max(0, s))
    setPlaying(false)
    setStep(n)
    setRevealed(upTo(lesson, n, true))
    setSelectedId(lastPacket(lesson, n))
  }

  const togglePlay = () => {
    if (playing) return setPlaying(false)
    const stepDone = cur.packets.every((p) => revealed.has(p))
    if (step === last && stepDone) {
      setStep(0)
      setRevealed(upTo(lesson, 0, false))
      setRun((r) => r + 1)
    } else if (stepDone) {
      setRevealed(upTo(lesson, step, false))
    }
    setPlaying(true)
  }

  const replay = () => {
    setStep(0)
    setRevealed(upTo(lesson, 0, false))
    setSelectedId(null)
    setRun((r) => r + 1)
    setPlaying(true)
  }

  const onPacket = (pid: string) => {
    setRevealed((r) => new Set(r).add(pid))
    setSelectedId(pid)
  }

  const onStepEnd = () => {
    if (step < last) {
      setStep(step + 1)
      setRevealed(upTo(lesson, step + 1, false))
    } else {
      setPlaying(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
      if (e.key === ' ' && t.tagName !== 'BUTTON' && t.tagName !== 'A') { e.preventDefault(); togglePlay() }
      else if (e.key === 'ArrowRight') goto(step + 1)
      else if (e.key === 'ArrowLeft') goto(step - 1)
      else if (e.key === 'n') setView('network')
      else if (e.key === 's') setView('sequence')
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const quizBest = progress.quizzes[lesson.id]
  const examBest = progress.exams[lesson.id]

  return (
    <div class="page lesson">
      <header class="page-head">
        <div class="kicker">
          <a href={href('/')}>Course</a>
          <span>/</span>
          <span>Unit {item?.unit.n} · {item?.unit.title}</span>
          <span class="layer-tag">{lesson.layer}</span>
        </div>
        <div class="title-row">
          <div>
            <h1><span class="proto-name">{lesson.protocol}</span> {lesson.title}</h1>
            <p class="lede">{lesson.tagline}</p>
          </div>
          <div class="head-actions">
            <a class="btn" href="#quiz" onClick={(e) => { e.preventDefault(); document.getElementById('quiz')?.scrollIntoView({ behavior: 'smooth' }) }}>
              Quiz{quizBest !== undefined && <span class="score">{quizBest}%</span>}
            </a>
            <a class="btn primary" href={href(`/exam/${lesson.id}`)}>
              <Icon name="pen" size={16} /> Rebuild it{examBest !== undefined && <span class="score">{examBest}%</span>}
            </a>
          </div>
        </div>
      </header>

      <section class="player">
        <div class="stage card">
          <div class="stage-bar">
            <div class="seg" role="tablist" aria-label="View">
              <button role="tab" aria-selected={view === 'network'} class={view === 'network' ? 'on' : ''} onClick={() => setView('network')}>Network</button>
              <button role="tab" aria-selected={view === 'sequence'} class={view === 'sequence' ? 'on' : ''} onClick={() => setView('sequence')}>Sequence</button>
            </div>
            <span class="stepcount">Step {step + 1} / {lesson.steps.length}</span>
          </div>
          <div class="stage-body">
            <Stage
              lesson={lesson}
              view={view}
              step={step}
              run={run}
              playing={playing}
              speed={speed}
              revealed={revealed}
              selected={selected}
              onPacket={onPacket}
              onStepEnd={onStepEnd}
              onSelect={(pid) => setSelectedId(pid)}
            />
          </div>
          <div class="controls">
            <button class="btn icon primary play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
              <Icon name={playing ? 'pause' : 'play'} size={20} />
            </button>
            <button class="btn icon" onClick={() => goto(step - 1)} disabled={step === 0} aria-label="Previous step" title="Previous step (←)"><Icon name="prev" /></button>
            <button class="btn icon" onClick={() => goto(step + 1)} disabled={step === last} aria-label="Next step" title="Next step (→)"><Icon name="next" /></button>
            <div class="dots">
              {lesson.steps.map((s, i) => (
                <button key={i} class={i === step ? 'on' : i < step ? 'past' : ''} onClick={() => goto(i)} aria-label={`Step ${i + 1}: ${s.title}`} />
              ))}
            </div>
            <label class="speed">
              <span class="sr-only">Playback speed</span>
              <select value={speed} onChange={(e) => setSpeed(Number((e.currentTarget as HTMLSelectElement).value))}>
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
            </label>
            <button class="btn icon" onClick={replay} aria-label="Replay from the start" title="Replay from the start"><Icon name="replay" /></button>
          </div>
        </div>

        <aside class="steppanel card" aria-live="polite">
          <div class="step-kicker">Step {step + 1} of {lesson.steps.length}</div>
          <h2>{cur.title}</h2>
          {cur.body.map((p, i) => <p key={i}>{p}</p>)}
          {cur.facts && (
            <dl class="facts">
              {cur.facts.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
          <ol class="steplist">
            {lesson.steps.map((s, i) => (
              <li key={i}>
                <button class={i === step ? 'on' : i < step ? 'past' : ''} onClick={() => goto(i)}>
                  <span class="n">{i + 1}</span>
                  <span>{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <p class="kbd-hint">Keys: <kbd>Space</kbd> play · <kbd>←</kbd><kbd>→</kbd> steps · <kbd>N</kbd>/<kbd>S</kbd> views</p>
        </aside>
      </section>

      <section class="capture card">
        <div class="section-head">
          <h2>Packets</h2>
          <span class="muted">{lesson.capture}</span>
        </div>
        <PacketTable lesson={lesson} revealed={revealed} current={currentIds} selectedId={selectedId} onSelect={setSelectedId} />
        <Inspector
          key={selectedId ?? 'none'}
          packet={selected ? selected.build() : null}
          title={selected ? `#${selectedNo} · ${selected.label} · ${selected.build().bytes.length} bytes` : undefined}
        />
      </section>

      <section class="study">
        <div class="card takeaways">
          <h2>Key takeaways</h2>
          <ul>{lesson.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
          <p class="summary">{lesson.summary}</p>
          {lesson.references.length > 0 && (
            <>
              <h3>Further reading</h3>
              <ul class="refs">
                {lesson.references.map((r) => (
                  <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label} <Icon name="external" size={13} /></a></li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div class="card" id="quiz">
          <h2>Check yourself</h2>
          <Quiz id={lesson.id} questions={lesson.quiz} />
          <a class="btn primary wide" href={href(`/exam/${lesson.id}`)}><Icon name="pen" size={16} /> Now rebuild the whole exchange from memory</a>
        </div>
      </section>

      <section class="print-notes" aria-hidden="true">
        <h2>Lesson notes</h2>
        {lesson.steps.map((s, i) => (
          <div key={i}>
            <h3>{i + 1}. {s.title}</h3>
            {s.body.map((p, k) => <p key={k}>{p}</p>)}
          </div>
        ))}
      </section>

      <CourseNav kind="lesson" id={lesson.id} />
    </div>
  )
}
