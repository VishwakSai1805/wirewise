// Low-level helpers for building real packet bytes while recording
// which byte range each header field occupies (for the inspector).

export interface Field {
  name: string
  value: string
  start: number
  end: number
  note?: string
}

export interface Layer {
  id: string
  name: string
  short: string
  start: number
  end: number
  fields: Field[]
}

export interface Packet {
  bytes: Uint8Array
  layers: Layer[]
}

/** One protocol header (or payload) under construction. Offsets are relative to the segment. */
export class Seg {
  bytes: number[] = []
  fields: Field[] = []

  constructor(
    public id: string,
    public name: string,
    public short: string,
  ) {}

  get length() {
    return this.bytes.length
  }

  raw(name: string, data: ArrayLike<number>, value: string, note?: string): number {
    const start = this.bytes.length
    for (let i = 0; i < data.length; i++) this.bytes.push(data[i] & 0xff)
    this.fields.push({ name, value, start, end: this.bytes.length, note })
    return start
  }

  u8(name: string, v: number, value = String(v), note?: string) {
    return this.raw(name, [v], value, note)
  }

  u16(name: string, v: number, value = String(v), note?: string) {
    return this.raw(name, [v >>> 8, v], value, note)
  }

  u32(name: string, v: number, value = String(v >>> 0), note?: string) {
    return this.raw(name, [v >>> 24, v >>> 16, v >>> 8, v], value, note)
  }

  /** Describe a second field over bytes already written (used for bit fields). */
  also(name: string, start: number, end: number, value: string, note?: string) {
    this.fields.push({ name, value, start, end, note })
  }

  set16(offset: number, v: number) {
    this.bytes[offset] = (v >>> 8) & 0xff
    this.bytes[offset + 1] = v & 0xff
  }

  setValue(start: number, value: string) {
    const f = this.fields.find((x) => x.start === start)
    if (f) f.value = value
  }
}

/** Concatenate segments into a frame. Frames shorter than 60 bytes get Ethernet padding. */
export function assemble(...segs: Seg[]): Packet {
  const all: number[] = []
  const layers: Layer[] = []
  for (const s of segs) {
    const off = all.length
    layers.push({
      id: s.id,
      name: s.name,
      short: s.short,
      start: off,
      end: off + s.length,
      fields: s.fields.map((f) => ({ ...f, start: f.start + off, end: f.end + off })),
    })
    all.push(...s.bytes)
  }
  if (segs[0]?.id === 'eth' && all.length < 60) {
    const pad = new Seg('pad', 'Ethernet padding', 'Padding')
    const n = 60 - all.length
    pad.raw('Padding', new Array(n).fill(0), `${n} zero bytes`,
      'Ethernet frames must be at least 64 bytes on the wire (60 here + 4-byte FCS), so short frames are padded. This lets collisions be detected before a sender finishes transmitting.')
    const off = all.length
    layers.push({ id: 'pad', name: pad.name, short: pad.short, start: off, end: off + n,
      fields: pad.fields.map((f) => ({ ...f, start: f.start + off, end: f.end + off })) })
    all.push(...pad.bytes)
  }
  return { bytes: Uint8Array.from(all), layers }
}

/** RFC 1071 Internet checksum (ones' complement of the ones' complement sum). */
export function inetChecksum(data: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < data.length; i += 2) {
    sum += (data[i] << 8) + (i + 1 < data.length ? data[i + 1] : 0)
  }
  while (sum >>> 16) sum = (sum & 0xffff) + (sum >>> 16)
  return ~sum & 0xffff
}

export const hex = (v: number, digits: number) => '0x' + (v >>> 0).toString(16).padStart(digits, '0')

export function parseIp(ip: string): number[] {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`Bad IPv4 address: ${ip}`)
  }
  return parts
}

export function parseMac(mac: string): number[] {
  const parts = mac.split(':').map((p) => parseInt(p, 16))
  if (parts.length !== 6 || parts.some((p) => Number.isNaN(p))) throw new Error(`Bad MAC: ${mac}`)
  return parts
}

export const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0) & 0xff)

/** Find a field by name in a layer (first match). */
export function fieldValue(p: Packet, layerId: string, name: string): string | undefined {
  return p.layers.find((l) => l.id === layerId)?.fields.find((f) => f.name === name)?.value
}
