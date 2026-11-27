import { describe, expect, it } from 'vitest'
import { grade } from '../../course/grade'
import { congestion } from './congestion'
import { crc, crcCheck, hammingDecode, hammingEncode, internetChecksum, parseWords } from './errors'
import { dijkstra, distanceVector, forwarding } from './routing'
import { intToIp, ipToInt, maskToPrefix, parseCidr, split, subnet } from './subnet'
import { simulate } from './window'

describe('subnetting', () => {
  it('computes a /26', () => {
    const s = subnet(ipToInt('192.168.10.77')!, 26)
    expect(intToIp(s.network)).toBe('192.168.10.64')
    expect(intToIp(s.broadcast)).toBe('192.168.10.127')
    expect(intToIp(s.first)).toBe('192.168.10.65')
    expect(intToIp(s.last)).toBe('192.168.10.126')
    expect(s.hosts).toBe(62)
    expect(intToIp(s.mask)).toBe('255.255.255.192')
  })
  it('handles /31, /32 and /0', () => {
    expect(subnet(ipToInt('10.0.0.1')!, 31).hosts).toBe(2)
    expect(subnet(ipToInt('10.0.0.1')!, 32).hosts).toBe(1)
    expect(intToIp(subnet(ipToInt('10.0.0.1')!, 0).broadcast)).toBe('255.255.255.255')
  })
  it('parses masks and rejects non-contiguous ones', () => {
    expect(parseCidr('172.16.5.4 255.255.240.0')).toEqual({ ip: ipToInt('172.16.5.4'), prefix: 20 })
    expect(maskToPrefix(ipToInt('255.0.255.0')!)).toBeNull()
    expect(parseCidr('1.2.3.4/33')).toBeNull()
    expect(ipToInt('1.2.3.256')).toBeNull()
  })
  it('splits a network', () => {
    const r = split(ipToInt('192.168.0.0')!, 24, 26)
    expect(r.count).toBe(4)
    expect(r.subnets.map((s) => intToIp(s.network))).toEqual(['192.168.0.0', '192.168.0.64', '192.168.0.128', '192.168.0.192'])
  })
})

describe('error detection', () => {
  it('CRC: textbook example 1101011111 / 10011 → transmitted 11010111110010', () => {
    const r = crc('1101011111', '10011')
    expect(r.remainder).toBe('0010')
    expect(r.codeword).toBe('11010111110010')
    expect(crcCheck(r.codeword, '10011').ok).toBe(true)
    const flipped = r.codeword.slice(0, 3) + (r.codeword[3] === '1' ? '0' : '1') + r.codeword.slice(4)
    expect(crcCheck(flipped, '10011').ok).toBe(false)
  })
  it('Hamming(7,4): encodes 1011 and corrects any single-bit error', () => {
    const { code } = hammingEncode('1011')
    expect(code).toBe('0110011')
    for (let i = 0; i < code.length; i++) {
      const bad = code.slice(0, i) + (code[i] === '1' ? '0' : '1') + code.slice(i + 1)
      const d = hammingDecode(bad)
      expect(d.syndrome).toBe(i + 1)
      expect(d.corrected).toBe(code)
    }
    expect(hammingDecode(code).syndrome).toBe(0)
  })
  it('Internet checksum matches the IPv4 header example (0xb861)', () => {
    const w = parseWords('4500 0073 0000 4000 4011 0000 c0a8 0001 c0a8 00c7')!
    expect(internetChecksum(w).checksum).toBe(0xb861)
  })
})

describe('sliding window', () => {
  const base = { frames: 6, window: 3, delay: 3, timeout: 9, lost: new Set<string>() }
  it('delivers everything with no loss, no retransmissions', () => {
    for (const protocol of ['sw', 'gbn', 'sr'] as const) {
      const r = simulate({ ...base, protocol })
      expect(r.completed).toBe(true)
      expect(r.retransmissions).toBe(0)
      expect(r.dataSent).toBe(6)
    }
  })
  it('Go-Back-N resends the lost frame and everything after it', () => {
    const r = simulate({ ...base, protocol: 'gbn', lost: new Set(['d:1:0']) })
    expect(r.completed).toBe(true)
    const re = r.txs.filter((x) => x.kind === 'data' && x.retx).map((x) => x.seq)
    expect(re.slice(0, 2)).toEqual([1, 2])
  })
  it('Selective Repeat resends only the lost frame', () => {
    const r = simulate({ ...base, protocol: 'sr', lost: new Set(['d:1:0']) })
    expect(r.completed).toBe(true)
    expect(r.txs.filter((x) => x.kind === 'data' && x.retx).map((x) => x.seq)).toEqual([1])
  })
  it('recovers from a lost ACK in stop-and-wait', () => {
    const r = simulate({ ...base, protocol: 'sw', lost: new Set(['a:1:0']) })
    expect(r.completed).toBe(true)
    expect(r.retransmissions).toBe(1)
    expect(r.txs.some((x) => x.note === 'duplicate, discarded')).toBe(true)
  })
})

describe('routing', () => {
  // the classic six-router example network
  const nodes = ['u', 'v', 'w', 'x', 'y', 'z'].map((id) => ({ id, x: 0, y: 0 }))
  const edges = [
    { a: 'u', b: 'v', w: 2 }, { a: 'u', b: 'x', w: 1 }, { a: 'u', b: 'w', w: 5 }, { a: 'v', b: 'x', w: 2 },
    { a: 'v', b: 'w', w: 3 }, { a: 'x', b: 'w', w: 3 }, { a: 'x', b: 'y', w: 1 }, { a: 'w', b: 'y', w: 1 },
    { a: 'w', b: 'z', w: 5 }, { a: 'y', b: 'z', w: 2 },
  ]
  it('Dijkstra finds the textbook shortest paths', () => {
    const steps = dijkstra(nodes, edges, 'u')
    const last = steps[steps.length - 1]
    expect(last.D).toEqual({ u: 0, v: 2, w: 3, x: 1, y: 2, z: 4 })
    const fw = Object.fromEntries(forwarding('u', last).map((r) => [r.dest, r.next]))
    expect(fw).toEqual({ v: 'v', w: 'x', x: 'x', y: 'x', z: 'x' })
  })
  it('distance vector converges to the same costs', () => {
    const rounds = distanceVector(nodes, edges)
    expect(rounds[rounds.length - 1].u).toEqual({ u: 0, v: 2, w: 3, x: 1, y: 2, z: 4 })
  })
})

describe('congestion control', () => {
  it('follows the textbook Tahoe/Reno curves', () => {
    const losses = { 8: 'dup3' as const }
    const reno = congestion('reno', 12, 8, losses).map((r) => r.cwnd)
    const tahoe = congestion('tahoe', 12, 8, losses).map((r) => r.cwnd)
    expect(reno).toEqual([1, 2, 4, 8, 9, 10, 11, 12, 9, 10, 11, 12])
    expect(tahoe).toEqual([1, 2, 4, 8, 9, 10, 11, 12, 1, 2, 4, 6])
  })
})

describe('exam grading', () => {
  const ref = [{ label: 'SYN', from: 'c', to: 's' }, { label: 'SYN, ACK', from: 's', to: 'c' }, { label: 'ACK', from: 'c', to: 's' }]
  it('gives 100 for a perfect answer', () => expect(grade(ref, ref).score).toBe(100))
  it('flags order and direction mistakes', () => {
    const g = grade(ref, [ref[1], ref[0], { label: 'ACK', from: 's', to: 'c' }])
    expect(g.inPlace).toBe(1)
    expect(g.ref).toContain('order')
    expect(g.ref[2]).toBe('direction')
  })
})
