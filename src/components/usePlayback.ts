// Drives the step animation with requestAnimationFrame. Only the view that
// uses this hook re-renders every frame; the rest of the page stays still.
import { useEffect, useRef, useState } from 'preact/hooks'

export interface PlaybackOptions {
  ids: string[]
  /** changes whenever the step changes or a replay starts */
  stepKey: string
  playing: boolean
  speed: number
  duration: (id: string) => number
  onPacket: (id: string) => void
  onStepEnd: () => void
}

export interface PlaybackState {
  /** packet currently in flight, or null when the step is settled */
  active: string | null
  /** 0..1 progress of the active packet */
  t: number
  /** packets of this step that have finished */
  done: string[]
}

const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function usePlayback(opts: PlaybackOptions): PlaybackState {
  const cb = useRef(opts)
  cb.current = opts
  const pos = useRef({ i: opts.ids.length, t: 0 })
  const lastStep = useRef(opts.stepKey)
  const [, force] = useState(0)

  if (lastStep.current !== opts.stepKey) {
    lastStep.current = opts.stepKey
    pos.current = { i: opts.playing ? 0 : opts.ids.length, t: 0 }
  }

  useEffect(() => {
    if (!opts.playing) return
    if (pos.current.i >= cb.current.ids.length) pos.current = { i: 0, t: 0 }
    let raf = 0
    let last = performance.now()
    let hold = 0
    const tick = (now: number) => {
      // cap the step so a background tab doesn't jump ahead, but keep slow devices at real speed
      const dt = Math.min(400, now - last) * cb.current.speed
      last = now
      const p = pos.current
      const { ids } = cb.current
      if (p.i < ids.length) {
        p.t += REDUCED ? 1 : dt / cb.current.duration(ids[p.i])
        if (p.t >= 1) {
          cb.current.onPacket(ids[p.i])
          p.i += 1
          p.t = 0
        }
        force((n) => n + 1)
      } else {
        hold += dt
        if (hold >= (ids.length ? 1100 : 2600)) {
          cb.current.onStepEnd()
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [opts.playing, opts.stepKey])

  const { i, t } = pos.current
  return { active: i < opts.ids.length ? opts.ids[i] : null, t, done: opts.ids.slice(0, i) }
}
