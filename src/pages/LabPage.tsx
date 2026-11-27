import type { FunctionComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { neighbours } from '../course/order'
import { labById } from '../course/syllabus'
import { CourseNav } from '../components/CourseNav'
import { markLab } from '../lib/progress'
import { href } from '../lib/router'
import { NotFound } from './NotFound'

// Each lab is a separate chunk, downloaded only when opened.
const loaders: Record<string, () => Promise<{ default: FunctionComponent }>> = {
  encapsulation: () => import('../labs/Encapsulation'),
  encoding: () => import('../labs/LineCoding'),
  'error-detection': () => import('../labs/ErrorDetection'),
  'sliding-window': () => import('../labs/SlidingWindow'),
  subnetting: () => import('../labs/Subnetting'),
  routing: () => import('../labs/Routing'),
  congestion: () => import('../labs/Congestion'),
}

export function LabPage({ id }: { id: string }) {
  const meta = labById(id)
  const [Lab, setLab] = useState<FunctionComponent | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!meta || !loaders[id]) return
    let alive = true
    setLab(null)
    setFailed(false)
    loaders[id]()
      .then((m) => { if (alive) setLab(() => m.default) })
      .catch(() => { if (alive) setFailed(true) })
    markLab(id)
    return () => { alive = false }
  }, [id])

  if (!meta || !loaders[id]) return <NotFound />
  const { item } = neighbours('lab', id)

  return (
    <div class="page lab">
      <header class="page-head">
        <div class="kicker">
          <a href={href('/')}>Course</a><span>/</span><span>Unit {item?.unit.n} · {item?.unit.title}</span><span class="layer-tag">{meta.layer}</span>
        </div>
        <h1><span class="proto-name">Lab</span> {meta.title}</h1>
        <p class="lede">{meta.blurb}</p>
      </header>
      {Lab ? <Lab /> : <div class="card loading">{failed ? 'This lab could not be loaded. Check your connection and reload.' : 'Loading lab…'}</div>}
      <CourseNav kind="lab" id={id} />
    </div>
  )
}
