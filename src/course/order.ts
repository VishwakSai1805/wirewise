import { lessonById } from './lessons'
import { labById, units, type Unit, type UnitItem } from './syllabus'

export interface CourseItem extends UnitItem {
  unit: Unit
  title: string
  short: string
  layer: string
  blurb: string
  href: string
}

export const courseOrder: CourseItem[] = units.flatMap((unit) =>
  unit.items.map((item) => {
    if (item.kind === 'lesson') {
      const l = lessonById(item.id)!
      return { ...item, unit, title: l.title, short: l.protocol, layer: l.layer, blurb: l.tagline, href: `/learn/${l.id}` }
    }
    const lab = labById(item.id)!
    return { ...item, unit, title: lab.title, short: lab.title, layer: lab.layer, blurb: lab.blurb, href: `/lab/${lab.id}` }
  }),
)

export function neighbours(kind: 'lesson' | 'lab', id: string) {
  const i = courseOrder.findIndex((c) => c.kind === kind && c.id === id)
  return { prev: i > 0 ? courseOrder[i - 1] : null, next: i >= 0 && i < courseOrder.length - 1 ? courseOrder[i + 1] : null, item: courseOrder[i] }
}
