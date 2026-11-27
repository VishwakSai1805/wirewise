import { useState } from 'preact/hooks'
import { grade, type Grade, type Msg } from '../course/grade'
import { lessonById } from '../course/lessons'
import type { Lesson } from '../course/types'
import { Icon } from '../components/Icon'
import { SeqDiagram, type SeqRow } from '../components/SeqDiagram'
import { recordExam, useProgress } from '../lib/progress'
import { href } from '../lib/router'
import { NotFound } from './NotFound'

export function ExamPage({ id }: { id: string }) {
  const lesson = lessonById(id)
  if (!lesson) return <NotFound />
  return <Exam key={lesson.id} lesson={lesson} />
}

const TONE = { ok: 'ok', order: 'warn', direction: 'warn', missing: 'bad', extra: 'bad' } as const

function Exam({ lesson }: { lesson: Lesson }) {
  const reference: Msg[] = lesson.packets.map((p) => ({ label: p.label, from: p.from, to: p.to }))
  const labels = [...new Set(reference.map((r) => r.label))].sort((a, b) => a.localeCompare(b))
  const names = Object.fromEntries(lesson.devices.map((d) => [d.id, d]))
  const participants = lesson.participants.map((pid) => ({ id: pid, label: names[pid].label, sub: names[pid].sub }))

  const [rows, setRows] = useState<Msg[]>([])
  const [label, setLabel] = useState(labels[0])
  const [from, setFrom] = useState(lesson.participants[0])
  const [to, setTo] = useState(lesson.participants[1])
  const [result, setResult] = useState<Grade | null>(null)
  const best = useProgress().exams[lesson.id]

  const add = () => {
    if (from === to) return
    setRows([...rows, { label, from, to }])
    setResult(null)
  }
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
    setResult(null)
  }
  const remove = (i: number) => { setRows(rows.filter((_, k) => k !== i)); setResult(null) }
  const submit = () => {
    const g = grade(reference, rows)
    setResult(g)
    recordExam(lesson.id, g.score)
  }
  const stepOf = (packetIndex: number) => lesson.steps.findIndex((s) => s.packets.includes(lesson.packets[packetIndex].id))
  const nameOf = (pid: string) => names[pid].label

  const yourRows: SeqRow[] = rows.map((r, i) => ({ key: String(i), ...r, tone: result ? TONE[result.ans[i]] : undefined }))
  const refRows: SeqRow[] = reference.map((r, i) => ({ key: String(i), ...r, broadcast: lesson.packets[i].broadcast, tone: result ? TONE[result.ref[i]] : undefined }))

  return (
    <div class="page exam">
      <header class="page-head">
        <div class="kicker">
          <a href={href('/')}>Course</a><span>/</span><a href={href(`/learn/${lesson.id}`)}>{lesson.protocol} lesson</a><span>/</span><span>Rebuild</span>
        </div>
        <div class="title-row">
          <div>
            <h1>Rebuild the {lesson.protocol} exchange</h1>
            <p class="lede">From memory, add the {reference.length} messages of the lesson in order: what is sent, by whom, to whom. Then check your answer.</p>
          </div>
          {best !== undefined && <div class="best">Best score <strong>{best}%</strong></div>}
        </div>
      </header>

      <section class="exam-grid">
        <div class="card builder">
          <h2>Add a message</h2>
          <div class="addrow">
            <label>Message
              <select value={label} onChange={(e) => setLabel((e.currentTarget as HTMLSelectElement).value)}>
                {labels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label>From
              <select value={from} onChange={(e) => setFrom((e.currentTarget as HTMLSelectElement).value)}>
                {lesson.participants.map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
              </select>
            </label>
            <label>To
              <select value={to} onChange={(e) => setTo((e.currentTarget as HTMLSelectElement).value)}>
                {lesson.participants.map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
              </select>
            </label>
            <button class="btn primary" onClick={add} disabled={from === to}>Add</button>
          </div>
          {from === to && <p class="hint bad">Sender and receiver must be different.</p>}

          <h2 class="mt">Your sequence <span class="muted">{rows.length} / {reference.length}</span></h2>
          {rows.length === 0 ? (
            <p class="muted">No messages yet. Start with whatever opens the conversation.</p>
          ) : (
            <ol class="msglist">
              {rows.map((r, i) => (
                <li key={i} class={result ? `st-${result.ans[i]}` : ''}>
                  <span class="mn">{i + 1}</span>
                  <span class="mlabel">{r.label}</span>
                  <span class="mdir">{nameOf(r.from)} → {nameOf(r.to)}</span>
                  <span class="mact">
                    <button class="btn icon sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="up" size={15} /></button>
                    <button class="btn icon sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down"><Icon name="down" size={15} /></button>
                    <button class="btn icon sm" onClick={() => remove(i)} aria-label="Remove"><Icon name="x" size={15} /></button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div class="exam-actions">
            <button class="btn primary" onClick={submit} disabled={rows.length === 0}>Check my answer</button>
            {rows.length > 0 && <button class="btn ghost" onClick={() => { setRows([]); setResult(null) }}>Start over</button>}
          </div>
        </div>

        <div class="card">
          <h2>Your diagram</h2>
          <div class="seq-scroll tall">
            <SeqDiagram participants={participants} rows={yourRows} compact empty="Your messages will be drawn here." />
          </div>
        </div>
      </section>

      {result && (
        <section class="card result">
          <div class="result-head">
            <div class={`bigscore ${result.score >= 80 ? 'good' : result.score >= 50 ? 'mid' : 'low'}`}>{result.score}%</div>
            <div>
              <h2>{result.score === 100 ? 'Perfect: every message, in order.' : `${result.inPlace} of ${reference.length} messages in the right place`}</h2>
              <p class="muted">Green = correct and in order · amber = right message but wrong place or direction · red = missing or extra.</p>
            </div>
          </div>
          {result.score < 100 && (
            <ul class="feedback">
              {result.ref.map((s, i) => s === 'ok' ? null : (
                <li key={i} class={`st-${s}`}>
                  <strong>#{i + 1} {reference[i].label}</strong> ({nameOf(reference[i].from)} → {nameOf(reference[i].to)}):{' '}
                  {s === 'missing' ? 'missing.' : s === 'order' ? 'present, but out of order.' : 'right message, wrong sender or receiver.'}{' '}
                  <a href={href(`/learn/${lesson.id}?step=${stepOf(i) + 1}`)}>Review step {stepOf(i) + 1}</a>
                </li>
              ))}
              {result.ans.map((s, i) => s === 'extra' ? <li key={'x' + i} class="st-extra"><strong>Your #{i + 1} {rows[i].label}</strong> is not part of this exchange.</li> : null)}
            </ul>
          )}
          <h3>Reference exchange</h3>
          <div class="seq-scroll tall">
            <SeqDiagram participants={participants} rows={refRows} compact />
          </div>
        </section>
      )}
    </div>
  )
}
