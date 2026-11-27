import { icmpEcho, icmpError, icmpFrame, ipDatagram, type IpOpts } from '../../packets/layers'
import { IP, MAC } from '../net'
import { once, type Lesson } from '../types'

const DATA = Array.from('abcdefghijklmnopqrstuvwabcdefghi', (c) => c.charCodeAt(0))
const BACKBONE = '198.51.100.1'

const probeIp = (ttl: number, id: number): IpOpts => ({ src: IP.client, dst: IP.web, ttl, id })
const probe = (ttl: number, seq: number, id: number) =>
  once(() => icmpFrame({ srcMac: MAC.client, dstMac: MAC.router, ip: probeIp(ttl, id) }, icmpEcho(8, 1, seq, DATA)))
const reply = (seq: number) =>
  once(() => icmpFrame({ srcMac: MAC.router, dstMac: MAC.client, ip: { src: IP.web, dst: IP.client, ttl: 61, id: 0 } }, icmpEcho(0, 1, seq, DATA)))
/** Time Exceeded from a router, quoting the probe it dropped (TTL shown as it arrived). */
const expired = (router: string, ttlLeft: number, seq: number, id: number) =>
  once(() => icmpFrame({ srcMac: MAC.router, dstMac: MAC.client, ip: { src: router, dst: IP.client, ttl: ttlLeft, id: 0x0a00 + seq } },
    icmpError(11, 0, ipDatagram({ ...probeIp(1, id) }, 1, icmpEcho(8, 1, seq, DATA)))))

export const icmpLesson: Lesson = {
  id: 'icmp',
  title: 'Ping and traceroute',
  protocol: 'ICMP',
  layer: 'L3',
  tagline: 'Test reachability with echo requests, then map every router on the path by playing with the TTL.',
  summary: 'ICMP is IP’s messenger: it reports errors and answers diagnostics. Two everyday tools, ping and traceroute, are built entirely on it.',
  capture: 'Captured on the laptop. Traceroute here works like Windows tracert (ICMP echo probes).',
  devices: [
    { id: 'client', label: 'Laptop', sub: IP.client, kind: 'laptop', x: 90, y: 230 },
    { id: 'r1', label: 'Home router', sub: IP.router, kind: 'router', x: 320, y: 230 },
    { id: 'r2', label: 'ISP router', sub: IP.isp, kind: 'router', x: 540, y: 230 },
    { id: 'r3', label: 'Backbone router', sub: BACKBONE, kind: 'router', x: 740, y: 230 },
    { id: 'server', label: 'Server', sub: IP.web, kind: 'server', x: 920, y: 230 },
  ],
  links: [['client', 'r1'], ['r1', 'r2'], ['r2', 'r3'], ['r3', 'server']],
  participants: ['client', 'r1', 'r2', 'r3', 'server'],
  packets: [
    { id: 'ping', label: 'Echo request', from: 'client', to: 'server', t: 0, paths: [['client', 'r1', 'r2', 'r3', 'server']], info: 'Echo (ping) request seq=1, ttl=128', build: probe(128, 1, 0x7101) },
    { id: 'pong', label: 'Echo reply', from: 'server', to: 'client', t: 0.024, paths: [['server', 'r3', 'r2', 'r1', 'client']], info: 'Echo (ping) reply seq=1, ttl=61', build: reply(1) },
    { id: 'p1', label: 'Echo, TTL 1', from: 'client', to: 'server', t: 1.0, paths: [['client', 'r1']], info: 'Echo request seq=2, ttl=1', build: probe(1, 2, 0x7102) },
    { id: 'e1', label: 'Time exceeded', from: 'r1', to: 'client', t: 1.001, paths: [['r1', 'client']], info: `Time-to-live exceeded from ${IP.router}`, build: expired(IP.router, 64, 2, 0x7102) },
    { id: 'p2', label: 'Echo, TTL 2', from: 'client', to: 'server', t: 1.01, paths: [['client', 'r1', 'r2']], info: 'Echo request seq=3, ttl=2', build: probe(2, 3, 0x7103) },
    { id: 'e2', label: 'Time exceeded', from: 'r2', to: 'client', t: 1.019, paths: [['r2', 'r1', 'client']], info: `Time-to-live exceeded from ${IP.isp}`, build: expired(IP.isp, 254, 3, 0x7103) },
    { id: 'p3', label: 'Echo, TTL 3', from: 'client', to: 'server', t: 1.03, paths: [['client', 'r1', 'r2', 'r3']], info: 'Echo request seq=4, ttl=3', build: probe(3, 4, 0x7104) },
    { id: 'e3', label: 'Time exceeded', from: 'r3', to: 'client', t: 1.051, paths: [['r3', 'r2', 'r1', 'client']], info: `Time-to-live exceeded from ${BACKBONE}`, build: expired(BACKBONE, 253, 4, 0x7104) },
    { id: 'p4', label: 'Echo, TTL 4', from: 'client', to: 'server', t: 1.06, paths: [['client', 'r1', 'r2', 'r3', 'server']], info: 'Echo request seq=5, ttl=4', build: probe(4, 5, 0x7105) },
    { id: 'r4', label: 'Echo reply', from: 'server', to: 'client', t: 1.084, paths: [['server', 'r3', 'r2', 'r1', 'client']], info: 'Echo (ping) reply seq=5', build: reply(5) },
  ],
  steps: [
    {
      title: 'Ping: are you there?',
      body: [
        'Ping sends an ICMP Echo Request (type 8) and waits for an Echo Reply (type 0). The time between them is the round-trip time: 24 ms here.',
        'ICMP has no ports. It rides directly inside IP with protocol number 1. The reply’s TTL is a clue: it arrived with 61, so it probably started at 64 and crossed 3 routers.',
      ],
      packets: ['ping', 'pong'],
      facts: [['Request', 'type 8, code 0'], ['Reply', 'type 0, code 0'], ['RTT', '24 ms'], ['Reply TTL', '61 → 3 routers crossed']],
    },
    {
      title: 'Traceroute, TTL = 1',
      body: [
        'Traceroute deliberately sends a probe with TTL 1. The first router decrements it to 0, must drop the packet, and sends back ICMP Time Exceeded (type 11) from its own address.',
        'That error reveals the first hop’s IP and how long it took to reach it. The error quotes the start of the dropped probe so the laptop can match it up.',
      ],
      packets: ['p1', 'e1'],
      facts: [['Hop 1', `${IP.router}  1 ms`], ['Error', 'type 11, code 0']],
    },
    {
      title: 'TTL = 2, TTL = 3',
      body: [
        'Each new probe gets one more hop before it expires, so each Time Exceeded comes from one router further away.',
        'Real traceroute sends three probes per hop and prints three times. A “*” means no reply arrived in time: the router may filter or rate-limit ICMP.',
      ],
      packets: ['p2', 'e2', 'p3', 'e3'],
      facts: [['Hop 2', `${IP.isp}  9 ms`], ['Hop 3', `${BACKBONE}  21 ms`]],
    },
    {
      title: 'TTL = 4 reaches the server',
      body: [
        'With TTL 4 the probe survives all three routers and reaches the server, which answers with a normal Echo Reply. The trace is complete.',
        'Linux and macOS traceroute send UDP probes to unlikely high ports instead; the destination then answers with Destination Unreachable (port unreachable), which ends the trace the same way.',
      ],
      packets: ['p4', 'r4'],
      facts: [['Hop 4', `${IP.web}  24 ms`], ['Hops to server', '4 (3 routers + server)']],
    },
    {
      title: 'Reading the output',
      body: [
        'The tool prints one line per hop. RTT usually grows with each hop, but not always: routers answer ICMP with low priority, so a middle hop can look slower than later ones.',
        'Paths can change between probes, and the route back may differ from the route out. Traceroute shows the forward path only.',
      ],
      packets: [],
      facts: [['1', `${IP.router}   1 ms`], ['2', `${IP.isp}   9 ms`], ['3', `${BACKBONE}   21 ms`], ['4', `${IP.web}   24 ms`]],
    },
  ],
  takeaways: [
    'ICMP is carried directly in IP (protocol 1) and has types and codes instead of ports.',
    'Ping = Echo Request (8) / Echo Reply (0); it measures reachability and RTT.',
    'Routers send Time Exceeded (11) when TTL reaches 0. Traceroute raises the TTL one hop at a time to exploit this.',
    '“*” in traceroute means no reply, which is often filtering, not necessarily a broken path.',
  ],
  quiz: [
    {
      q: 'Which ICMP message does a router send when a packet’s TTL reaches 0?',
      options: ['Echo reply', 'Destination unreachable', 'Time exceeded', 'Redirect'],
      answer: 2,
      why: 'Type 11, code 0: TTL expired in transit. Traceroute is built on it.',
    },
    {
      q: 'Which port does ping use?',
      options: ['7', '53', '1', 'None: ICMP has no ports'],
      answer: 3,
      why: 'ICMP sits directly on IP. Its identifier and sequence fields do the matching that ports would do.',
    },
    {
      q: 'Why might a traceroute hop show “* * *” even though later hops respond?',
      options: ['The router is down', 'The router does not send or rate-limits ICMP Time Exceeded', 'TTL was too high', 'DNS failed'],
      answer: 1,
      why: 'If later hops answer, packets are clearly being forwarded; that router just stays silent.',
    },
    {
      q: 'An echo reply arrives with TTL 57. Most likely, how many routers did it cross?',
      options: ['57', '7', '64', '3'],
      answer: 1,
      why: 'Common initial TTLs are 64, 128 and 255. 64 − 57 = 7.',
    },
  ],
  references: [
    { label: 'RFC 792: Internet Control Message Protocol', url: 'https://www.rfc-editor.org/rfc/rfc792' },
  ],
}
