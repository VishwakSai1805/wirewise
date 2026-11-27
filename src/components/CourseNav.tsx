import { neighbours } from '../course/order'
import { href } from '../lib/router'
import { Icon } from './Icon'

/** Previous / next links following the syllabus order. */
export function CourseNav({ kind, id }: { kind: 'lesson' | 'lab'; id: string }) {
  const { prev, next } = neighbours(kind, id)
  return (
    <nav class="coursenav" aria-label="Course navigation">
      {prev ? (
        <a class="cn prev" href={href(prev.href)}>
          <span class="cn-dir"><Icon name="prev" size={16} /> Previous</span>
          <span class="cn-title">{prev.kind === 'lesson' ? `${prev.short}: ` : 'Lab: '}{prev.title}</span>
        </a>
      ) : <span />}
      {next ? (
        <a class="cn next" href={href(next.href)}>
          <span class="cn-dir">Next <Icon name="next" size={16} /></span>
          <span class="cn-title">{next.kind === 'lesson' ? `${next.short}: ` : 'Lab: '}{next.title}</span>
        </a>
      ) : <span />}
    </nav>
  )
}
