import type { Layer, Packet } from '../packets/build'
import type { LessonPacket } from '../course/types'

/** Every layer gets a colour family used consistently across the site. */
const GROUP: Record<string, string> = {
  eth: 'l2', pad: 'pad', arp: 'arp', ip: 'l3', icmp: 'icmp', udp: 'l4', tcp: 'l4', dns: 'l7', dhcp: 'l7', http: 'l7', data: 'l7',
}

export const layerColor = (id: string) => `var(--l-${GROUP[id] ?? 'l7'})`

export function topLayer(p: Packet): Layer {
  const real = p.layers.filter((l) => l.id !== 'pad')
  const top = real[real.length - 1]
  // raw application data is shown under its transport protocol, like capture tools do
  return top.id === 'data' && real.length > 1 ? real[real.length - 2] : top
}

export function endpoints(p: Packet): [string, string] {
  const ip = p.layers.find((l) => l.id === 'ip')
  const layer = ip ?? p.layers[0]
  const src = layer.fields.find((f) => f.name === (ip ? 'Source address' : 'Source'))?.value ?? '?'
  const dst = layer.fields.find((f) => f.name === (ip ? 'Destination address' : 'Destination'))?.value ?? '?'
  return [src, dst.replace(' (broadcast)', '').replace('ff:ff:ff:ff:ff:ff', 'Broadcast')]
}

/** Animation time for one packet, in ms at 1× speed: longer paths take longer. */
export function durationFor(pk: LessonPacket): number {
  const hops = Math.max(...pk.paths.map((p) => p.length - 1))
  return 520 + 430 * hops
}

export function formatTime(t: number) {
  return t.toFixed(t >= 10 ? 3 : 4)
}
