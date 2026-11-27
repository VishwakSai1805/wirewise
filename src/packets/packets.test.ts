import { describe, expect, it } from 'vitest'
import { inetChecksum, parseIp } from './build'
import { arpFrame, data, dhcp, dns, http, icmpEcho, icmpFrame, ipv4, tcpFrame, udpFrame } from './layers'
import { lessons } from '../course/lessons'

const hop = {
  srcMac: '00:00:5e:00:53:14',
  dstMac: '00:00:5e:00:53:01',
  ip: { src: '192.168.0.20', dst: '198.51.100.80', ttl: 128, id: 0x1c46 },
}

/** Re-sum a transport segment with its pseudo-header: a correct checksum gives 0. */
function verifyTransport(bytes: Uint8Array, proto: number) {
  const ipStart = 14
  const ihl = (bytes[ipStart] & 0x0f) * 4
  const total = (bytes[ipStart + 2] << 8) | bytes[ipStart + 3]
  const seg = Array.from(bytes.slice(ipStart + ihl, ipStart + total))
  const src = Array.from(bytes.slice(ipStart + 12, ipStart + 16))
  const dst = Array.from(bytes.slice(ipStart + 16, ipStart + 20))
  return inetChecksum([...src, ...dst, 0, proto, seg.length >>> 8, seg.length & 0xff, ...seg])
}

describe('internet checksum', () => {
  it('matches the RFC 1071 worked example', () => {
    expect(inetChecksum([0x00, 0x01, 0xf2, 0x03, 0xf4, 0xf5, 0xf6, 0xf7])).toBe(0x220d)
  })

  it('reproduces a textbook IPv4 header checksum (0xb861)', () => {
    const h = ipv4({ src: '192.168.0.1', dst: '192.168.0.199', ttl: 64, id: 0 }, 17, 0x73 - 20)
    expect(h.bytes.slice(10, 12)).toEqual([0xb8, 0x61])
  })
})

describe('frames', () => {
  it('builds a TCP SYN with options and a valid checksum', () => {
    const p = tcpFrame(hop, { sport: 50123, dport: 80, seq: 1000, isn: 1000, flags: ['SYN'], win: 64240, synOptions: true })
    expect(p.bytes.length).toBe(14 + 20 + 32)
    expect(p.bytes[14 + 20 + 13]).toBe(0x02) // SYN bit
    expect(verifyTransport(p.bytes, 6)).toBe(0)
    expect(inetChecksum(p.bytes.slice(14, 34))).toBe(0)
  })

  it('builds TCP with a payload and a valid checksum', () => {
    const p = tcpFrame(hop, { sport: 50123, dport: 7, seq: 1001, isn: 1000, ack: 5001, peerIsn: 5000, flags: ['PSH', 'ACK'], win: 1026 }, data('hello'))
    expect(verifyTransport(p.bytes, 6)).toBe(0)
  })

  it('builds UDP/DNS with a valid checksum and name compression', () => {
    const p = udpFrame(hop, 53124, 53, dns({
      id: 0xbeef, response: true, rd: true, ra: true,
      question: { name: 'www.example.com', type: 'A' },
      answers: [{ name: 'www.example.com', type: 'A', ttl: 300, data: '198.51.100.80' }],
    }))
    expect(verifyTransport(p.bytes, 17)).toBe(0)
    const dnsLayer = p.layers.find((l) => l.id === 'dns')!
    const ptr = dnsLayer.fields.find((f) => f.name === 'Answer name')!
    expect(Array.from(p.bytes.slice(ptr.start, ptr.end))).toEqual([0xc0, 0x0c])
    // the pointer must land on the query name (offset 12 inside DNS)
    const q = dnsLayer.fields.find((f) => f.name === 'Query name')!
    expect(q.start - dnsLayer.start).toBe(12)
  })

  it('pads short Ethernet frames to 60 bytes', () => {
    const p = arpFrame('00:00:5e:00:53:14', 'ff:ff:ff:ff:ff:ff', {
      op: 1, sha: '00:00:5e:00:53:14', spa: '192.168.0.20', tha: '00:00:00:00:00:00', tpa: '192.168.0.30',
    })
    expect(p.bytes.length).toBe(60)
    expect(p.layers.at(-1)!.id).toBe('pad')
  })

  it('builds ICMP and DHCP with valid checksums', () => {
    const ping = icmpFrame(hop, icmpEcho(8, 1, 1, new Array(32).fill(0x61)))
    expect(inetChecksum(ping.bytes.slice(34))).toBe(0)
    const d = udpFrame({ srcMac: hop.srcMac, dstMac: 'ff:ff:ff:ff:ff:ff', ip: { src: '0.0.0.0', dst: '255.255.255.255' } }, 68, 67,
      dhcp({ op: 1, xid: 0x3903f326, mac: hop.srcMac, msgType: 1, broadcast: true, paramList: true }))
    expect(verifyTransport(d.bytes, 17)).toBe(0)
  })

  it('records field ranges that tile each layer without gaps', () => {
    const p = udpFrame(hop, 1234, 80, http('GET / HTTP/1.1\r\nHost: a\r\n\r\n'))
    for (const layer of p.layers) {
      const covered = new Set<number>()
      for (const f of layer.fields) for (let i = f.start; i < f.end; i++) covered.add(i)
      expect(covered.size).toBe(layer.end - layer.start)
    }
  })
})

describe('lesson packets', () => {
  it('every lesson packet builds and has valid IP/transport checksums', () => {
    for (const lesson of lessons) {
      for (const pk of lesson.packets) {
        const p = pk.build()
        expect(p.bytes.length, `${lesson.id}/${pk.id}`).toBeGreaterThanOrEqual(60)
        if (p.layers[1]?.id === 'ip') {
          expect(inetChecksum(p.bytes.slice(14, 34)), `${lesson.id}/${pk.id} ip`).toBe(0)
          const proto = p.bytes[14 + 9]
          if (proto === 6 || proto === 17) expect(verifyTransport(p.bytes, proto), `${lesson.id}/${pk.id}`).toBe(0)
        }
      }
    }
  })

  it('every step references packets that exist, and every packet path uses known devices', () => {
    for (const lesson of lessons) {
      const ids = new Set(lesson.packets.map((p) => p.id))
      const devices = new Set(lesson.devices.map((d) => d.id))
      for (const step of lesson.steps) for (const id of step.packets) expect(ids.has(id), `${lesson.id}: ${id}`).toBe(true)
      for (const pk of lesson.packets) {
        for (const path of pk.paths) for (const d of path) expect(devices.has(d), `${lesson.id}/${pk.id}: ${d}`).toBe(true)
        expect(lesson.participants).toContain(pk.from)
      }
    }
  })
})

it('parses IPs strictly', () => {
  expect(() => parseIp('300.1.1.1')).toThrow()
})
