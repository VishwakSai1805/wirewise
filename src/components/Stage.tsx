// The animated part of the lesson player. It owns the playback clock, so
// per-frame updates re-render only this component, not the whole page.
import { useEffect, useRef } from 'preact/hooks'
import type { Lesson, LessonPacket } from '../course/types'
import { NetworkView } from './NetworkView'
import { durationFor, formatTime, layerColor, topLayer } from './packetInfo'
import { SeqDiagram } from './SeqDiagram'
import { usePlayback } from './usePlayback'

interface Props {
  lesson: Lesson
  view: 'network' | 'sequence'
  step: number
  run: number
  playing: boolean
  speed: number
  revealed: Set<string>
  selected: LessonPacket | null
  onPacket: (id: string) => void
  onStepEnd: () => void
  onSelect: (id: string) => void
}

export function Stage(props: Props) {
  const { lesson, step, revealed, selected } = props
  const byId = useRef(new Map(lesson.packets.map((p) => [p.id, p]))).current
  const ids = lesson.steps[step].packets
  const pb = usePlayback({
    ids,
    stepKey: `${step}:${props.run}`,
    playing: props.playing,
    speed: props.speed,
    duration: (id) => durationFor(byId.get(id)!),
    onPacket: props.onPacket,
    onStepEnd: props.onStepEnd,
  })

  if (props.view === 'network') return <NetworkView lesson={lesson} pb={pb} selected={selected} />
  return <SequenceView {...props} active={pb.active} t={pb.t} stepIds={ids} revealed={revealed} />
}

function SequenceView(props: Props & { active: string | null; t: number; stepIds: string[] }) {
  const { lesson, revealed, active, t, selected, stepIds } = props
  const scroller = useRef<HTMLDivElement>(null)
  const names = Object.fromEntries(lesson.devices.map((d) => [d.id, d]))
  const participants = lesson.participants.map((id) => ({ id, label: names[id].label, sub: names[id].sub }))
  const current = new Set(stepIds)
  const rows = lesson.packets
    .filter((p) => revealed.has(p.id) || p.id === active)
    .map((p) => ({
      key: p.id,
      label: p.label,
      from: p.from,
      to: p.to,
      broadcast: p.broadcast,
      time: formatTime(p.t) + 's',
      color: layerColor(topLayer(p.build()).id),
      progress: p.id === active ? t : undefined,
      tone: current.has(p.id) ? ('current' as const) : ('past' as const),
      selected: selected?.id === p.id,
    }))

  const count = rows.length
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [count])

  return (
    <div class="seq-scroll" ref={scroller}>
      <SeqDiagram participants={participants} rows={rows} onSelect={props.onSelect} empty="Press play or use → to reveal the messages." />
    </div>
  )
}
