export function ipToInt(s: string): number | null {
  const parts = s.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n >>> 0
}

export const intToIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')

export const prefixToMask = (p: number) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0)

export function maskToPrefix(mask: number): number | null {
  const inv = ~mask >>> 0
  if ((inv & (inv + 1)) !== 0) return null // ones must be contiguous
  return 32 - Math.round(Math.log2(inv + 1))
}

export const toBinary = (n: number) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.')

export interface SubnetInfo {
  ip: number
  prefix: number
  mask: number
  wildcard: number
  network: number
  broadcast: number
  first: number
  last: number
  hosts: number
  size: number
  cls: string
  scope: string
}

function classify(ip: number): { cls: string; scope: string } {
  const a = ip >>> 24
  const b = (ip >>> 16) & 255
  const cls = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (multicast)' : 'E (reserved)'
  let scope = 'Public'
  if (a === 10 || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168)) scope = 'Private (RFC 1918)'
  else if (a === 127) scope = 'Loopback'
  else if (a === 169 && b === 254) scope = 'Link-local (APIPA)'
  else if (a === 100 && b >= 64 && b < 128) scope = 'Carrier-grade NAT (RFC 6598)'
  else if (a >= 224 && a < 240) scope = 'Multicast'
  else if (a === 0) scope = '“This network”'
  return { cls, scope }
}

export function subnet(ip: number, prefix: number): SubnetInfo {
  const mask = prefixToMask(prefix)
  const network = (ip & mask) >>> 0
  const broadcast = (network | ~mask) >>> 0
  const size = 2 ** (32 - prefix)
  const hosts = prefix >= 31 ? size : size - 2
  const first = prefix >= 31 ? network : network + 1
  const last = prefix >= 31 ? broadcast : broadcast - 1
  return { ip, prefix, mask, wildcard: ~mask >>> 0, network, broadcast, first, last, hosts, size, ...classify(ip) }
}

/** Accepts "192.168.1.10/26" or "192.168.1.10 255.255.255.192". */
export function parseCidr(input: string): { ip: number; prefix: number } | null {
  const m = input.trim().match(/^([\d.]+)\s*(?:\/\s*(\d{1,2})|\s+([\d.]+))$/)
  if (!m) return null
  const ip = ipToInt(m[1])
  if (ip === null) return null
  if (m[2] !== undefined) {
    const p = Number(m[2])
    return p <= 32 ? { ip, prefix: p } : null
  }
  const mask = ipToInt(m[3])
  if (mask === null) return null
  const p = maskToPrefix(mask)
  return p === null ? null : { ip, prefix: p }
}

/** Split a network into equal subnets of a longer prefix (capped for display). */
export function split(network: number, prefix: number, newPrefix: number, cap = 64) {
  const out: SubnetInfo[] = []
  const count = 2 ** (newPrefix - prefix)
  const step = 2 ** (32 - newPrefix)
  for (let i = 0; i < Math.min(count, cap); i++) out.push(subnet((network + i * step) >>> 0, newPrefix))
  return { subnets: out, count }
}

/** Random practice question: a private host address with a prefix between /16 and /30. */
export function randomQuestion(rand = Math.random) {
  const prefix = 16 + Math.floor(rand() * 15)
  const firstOctets = [10, 172, 192][Math.floor(rand() * 3)]
  const second = firstOctets === 172 ? 16 + Math.floor(rand() * 16) : firstOctets === 192 ? 168 : Math.floor(rand() * 256)
  const ip = ((firstOctets << 24) | (second << 16) | (Math.floor(rand() * 256) << 8) | Math.floor(rand() * 256)) >>> 0
  return { ip, prefix }
}
