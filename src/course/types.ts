import type { Packet } from '../packets/build'

export type DeviceKind = 'laptop' | 'pc' | 'router' | 'switch' | 'server' | 'cloud' | 'dns' | 'printer' | 'phone'

export interface Device {
  id: string
  label: string
  sub?: string
  kind: DeviceKind
  /** position inside a 1000 × 420 canvas */
  x: number
  y: number
}

export interface LessonPacket {
  id: string
  /** short arrow label, e.g. "SYN" */
  label: string
  from: string
  to: string
  /** device-id paths the packet travels; more than one path = broadcast/flooding */
  paths: string[][]
  broadcast?: boolean
  /** seconds since the first packet */
  t: number
  /** one-line summary, like a capture tool's Info column */
  info: string
  build: () => Packet
}

export interface Step {
  title: string
  body: string[]
  packets: string[]
  facts?: [string, string][]
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
  why: string
}

export interface Lesson {
  id: string
  title: string
  protocol: string
  layer: string
  tagline: string
  summary: string
  capture: string
  devices: Device[]
  links: [string, string][]
  /** devices that appear as columns in the sequence diagram, left to right */
  participants: string[]
  packets: LessonPacket[]
  steps: Step[]
  takeaways: string[]
  quiz: QuizQuestion[]
  references: { label: string; url: string }[]
}

/** Cache a packet builder so bytes are only computed once. */
export function once(fn: () => Packet): () => Packet {
  let p: Packet | undefined
  return () => (p ??= fn())
}
