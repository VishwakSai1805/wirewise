// Encoders for the protocols used in the lessons. Every encoder produces
// real, checksum-correct bytes and a field map for the inspector.
import { Seg, assemble, ascii, hex, inetChecksum, parseIp, parseMac, type Packet } from './build'

const ETHERTYPE: Record<number, string> = { 0x0800: 'IPv4', 0x0806: 'ARP', 0x86dd: 'IPv6' }
const IP_PROTO: Record<number, string> = { 1: 'ICMP', 6: 'TCP', 17: 'UDP' }
const PORTS: Record<number, string> = { 7: 'Echo', 53: 'DNS', 67: 'DHCP server', 68: 'DHCP client', 80: 'HTTP', 443: 'HTTPS' }
const BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff'

function portLabel(p: number) {
  return PORTS[p] ? `${p} (${PORTS[p]})` : `${p}`
}

function portNote(p: number) {
  if (p < 1024) return 'Well-known port: identifies the server application.'
  if (p >= 49152) return 'Ephemeral port picked by the client OS for this conversation. Replies come back to it.'
  return undefined
}

function ipNote(ip: string): string | undefined {
  const [a, b] = parseIp(ip)
  if (ip === '0.0.0.0') return 'The host has no address yet, so it uses 0.0.0.0 ("this host").'
  if (ip === '255.255.255.255') return 'Limited broadcast: delivered to every host on this link, never forwarded by routers.'
  if (a === 10 || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168)) {
    return 'Private (RFC 1918) address. A home router’s NAT swaps it for the public address before the packet reaches the internet.'
  }
  return undefined
}

// ---------------------------------------------------------------- Ethernet

export function ethernet(dst: string, src: string, type: number): Seg {
  const s = new Seg('eth', 'Ethernet II', 'Ethernet')
  s.raw('Destination', parseMac(dst), dst === BROADCAST_MAC ? `${dst} (broadcast)` : dst,
    dst === BROADCAST_MAC
      ? 'All ones = broadcast. Every device on the LAN accepts this frame.'
      : 'MAC address of the next device on this link (often the router), not necessarily the final destination. MACs change at every hop; IP addresses do not.')
  s.raw('Source', parseMac(src), src, 'MAC address of the network card that sent this frame.')
  s.u16('Type', type, `${hex(type, 4)} (${ETHERTYPE[type] ?? 'unknown'})`, 'EtherType: tells the receiver which protocol is inside the frame.')
  return s
}

// ---------------------------------------------------------------- ARP

export interface ArpOpts { op: 1 | 2; sha: string; spa: string; tha: string; tpa: string }

export function arp(o: ArpOpts): Seg {
  const s = new Seg('arp', 'Address Resolution Protocol', 'ARP')
  s.u16('Hardware type', 1, '1 (Ethernet)')
  s.u16('Protocol type', 0x0800, '0x0800 (IPv4)', 'ARP maps addresses of this protocol to hardware addresses.')
  s.u8('Hardware size', 6, '6 bytes')
  s.u8('Protocol size', 4, '4 bytes')
  s.u16('Opcode', o.op, o.op === 1 ? '1 (request)' : '2 (reply)')
  s.raw('Sender MAC', parseMac(o.sha), o.sha)
  s.raw('Sender IP', parseIp(o.spa), o.spa, 'Receivers may cache this sender’s IP→MAC pair right away.')
  s.raw('Target MAC', parseMac(o.tha), o.tha,
    o.op === 1 ? 'Unknown yet, so all zeros. This is the question being asked.' : undefined)
  s.raw('Target IP', parseIp(o.tpa), o.tpa)
  return s
}

// ---------------------------------------------------------------- IPv4

export interface IpOpts { src: string; dst: string; ttl?: number; id?: number; df?: boolean }

export function ipv4(o: IpOpts, proto: number, payloadLen: number): Seg {
  const s = new Seg('ip', 'Internet Protocol version 4', 'IPv4')
  s.u8('Version / header length', 0x45, '4 / 20 bytes', 'Version 4. Header length is 5 × 32-bit words = 20 bytes (no options).')
  s.u8('DSCP / ECN', 0, '0 / 0', 'Quality-of-service marking. 0 = ordinary best-effort traffic.')
  const total = 20 + payloadLen
  s.u16('Total length', total, `${total} bytes`, 'IP header plus everything it carries.')
  const id = o.id ?? 0
  s.u16('Identification', id, hex(id, 4), 'Ties fragments of one datagram together if a router ever has to split it.')
  const df = o.df ?? true
  s.u16('Flags / fragment offset', df ? 0x4000 : 0, df ? 'DF (don’t fragment), offset 0' : 'none, offset 0',
    'DF tells routers to drop the packet instead of fragmenting it. Offset is the fragment’s position in 8-byte units.')
  const ttl = o.ttl ?? 64
  s.u8('Time to live', ttl, String(ttl), 'Every router subtracts 1. At 0 the packet is discarded and an ICMP Time Exceeded goes back to the sender.')
  s.u8('Protocol', proto, `${proto} (${IP_PROTO[proto] ?? '?'})`, 'Which protocol the payload belongs to.')
  const ck = s.u16('Header checksum', 0, '', 'Covers the header only. Routers recompute it at every hop because the TTL changes.')
  s.raw('Source address', parseIp(o.src), o.src, ipNote(o.src))
  s.raw('Destination address', parseIp(o.dst), o.dst, ipNote(o.dst))
  const c = inetChecksum(s.bytes)
  s.set16(ck, c)
  s.setValue(ck, `${hex(c, 4)} (correct)`)
  return s
}

function pseudoChecksum(src: string, dst: string, proto: number, segment: number[]): number {
  const len = segment.length
  return inetChecksum([...parseIp(src), ...parseIp(dst), 0, proto, len >>> 8, len & 0xff, ...segment])
}

// ---------------------------------------------------------------- UDP

export function udp(sport: number, dport: number, payload: Seg, ip: IpOpts): Seg {
  const s = new Seg('udp', 'User Datagram Protocol', 'UDP')
  s.u16('Source port', sport, portLabel(sport), portNote(sport))
  s.u16('Destination port', dport, portLabel(dport), portNote(dport))
  const len = 8 + payload.length
  s.u16('Length', len, `${len} bytes`, 'UDP header (always 8 bytes) plus data.')
  const ck = s.u16('Checksum', 0, '', 'Covers a pseudo-header (IP addresses, protocol, length), the UDP header and the data.')
  let c = pseudoChecksum(ip.src, ip.dst, 17, [...s.bytes, ...payload.bytes])
  if (c === 0) c = 0xffff
  s.set16(ck, c)
  s.setValue(ck, `${hex(c, 4)} (correct)`)
  return s
}

// ---------------------------------------------------------------- TCP

export type TcpFlag = 'FIN' | 'SYN' | 'RST' | 'PSH' | 'ACK'
const FLAG_BITS: Record<TcpFlag, number> = { FIN: 0x01, SYN: 0x02, RST: 0x04, PSH: 0x08, ACK: 0x10 }

export interface TcpOpts {
  sport: number
  dport: number
  /** raw sequence number and this side's initial sequence number */
  seq: number
  isn: number
  /** raw acknowledgment number and the peer's initial sequence number */
  ack?: number
  peerIsn?: number
  flags: TcpFlag[]
  win: number
  synOptions?: boolean
}

export function tcp(o: TcpOpts, payload: Seg | null, ip: IpOpts): Seg {
  const s = new Seg('tcp', 'Transmission Control Protocol', 'TCP')
  s.u16('Source port', o.sport, portLabel(o.sport), portNote(o.sport))
  s.u16('Destination port', o.dport, portLabel(o.dport), portNote(o.dport))
  const rel = (o.seq - o.isn) >>> 0
  s.u32('Sequence number', o.seq, `${rel} (relative) · raw ${o.seq >>> 0}`,
    o.flags.includes('SYN')
      ? 'The initial sequence number (ISN) is random, to make spoofing hard. Tools show it as relative 0.'
      : 'Byte number of the first data byte in this segment, counted from the ISN.')
  const hasAck = o.flags.includes('ACK')
  const ack = hasAck ? (o.ack ?? 0) : 0
  s.u32('Acknowledgment number', ack,
    hasAck ? `${(ack - (o.peerIsn ?? 0)) >>> 0} (relative) · raw ${ack >>> 0}` : '0 (ACK flag not set)',
    hasAck ? 'The next byte this side expects from the peer. Everything before it has arrived.' : undefined)
  const hl = o.synOptions ? 32 : 20
  let bits = 0
  for (const f of o.flags) bits |= FLAG_BITS[f]
  const at = s.u16('Header length', ((hl / 4) << 12) | bits, `${hl} bytes`, 'Data offset in 32-bit words. Options make the header longer than 20 bytes.')
  s.also('Flags', at, at + 2, `${hex(bits, 3)} (${o.flags.join(', ')})`,
    'SYN opens, ACK acknowledges, PSH hands data to the app immediately, FIN closes, RST aborts.')
  s.u16('Window', o.win, String(o.win), 'How many more bytes this side can receive (flow control). Multiplied by the window-scale factor agreed in the handshake.')
  const ck = s.u16('Checksum', 0, '', 'Covers a pseudo-header (IP addresses, protocol, length), the TCP header and the data.')
  s.u16('Urgent pointer', 0, '0')
  if (o.synOptions) {
    s.raw('Option: maximum segment size', [2, 4, 0x05, 0xb4], '1460 bytes', 'Largest payload this side wants per segment: 1500 (Ethernet MTU) − 20 (IP) − 20 (TCP).')
    s.raw('Option: no-op', [1], 'padding')
    s.raw('Option: window scale', [3, 3, 8], 'shift 8 (× 256)', 'Lets the 16-bit window field describe windows larger than 64 KB.')
    s.raw('Option: no-op', [1], 'padding')
    s.raw('Option: no-op', [1], 'padding')
    s.raw('Option: SACK permitted', [4, 2], 'yes', 'Selective acknowledgment: the receiver may report out-of-order blocks it already holds.')
  }
  const c = pseudoChecksum(ip.src, ip.dst, 6, [...s.bytes, ...(payload?.bytes ?? [])])
  s.set16(ck, c)
  s.setValue(ck, `${hex(c, 4)} (correct)`)
  return s
}

// ---------------------------------------------------------------- ICMP

export function icmpEcho(type: 8 | 0, id: number, seq: number, data: number[]): Seg {
  const s = new Seg('icmp', 'Internet Control Message Protocol', 'ICMP')
  s.u8('Type', type, type === 8 ? '8 (echo request)' : '0 (echo reply)', type === 8 ? 'Ping asks the destination to echo this message back.' : undefined)
  s.u8('Code', 0, '0')
  const ck = s.u16('Checksum', 0, '', 'Covers the whole ICMP message.')
  s.u16('Identifier', id, hex(id, 4), 'Matches replies to the ping process that sent the request.')
  s.u16('Sequence number', seq, String(seq), 'Counts the pings, so lost replies can be spotted.')
  s.raw('Data', data, `${data.length} bytes`, 'Filler copied back unchanged in the reply.')
  const c = inetChecksum(s.bytes)
  s.set16(ck, c)
  s.setValue(ck, `${hex(c, 4)} (correct)`)
  return s
}

/** ICMP error (Time Exceeded / Destination Unreachable) quoting the original datagram. */
export function icmpError(type: 11 | 3, code: number, original: Uint8Array): Seg {
  const s = new Seg('icmp', 'Internet Control Message Protocol', 'ICMP')
  const label = type === 11 ? '11 (time exceeded)' : '3 (destination unreachable)'
  s.u8('Type', type, label, type === 11 ? 'A router dropped the packet because its TTL reached 0. Traceroute uses this to discover each hop.' : undefined)
  s.u8('Code', code, type === 11 ? `${code} (TTL expired in transit)` : `${code} (port unreachable)`)
  const ck = s.u16('Checksum', 0, '')
  s.u32('Unused', 0, '0')
  const quoted = Array.from(original.slice(0, 28))
  s.raw('Original IP header + 8 bytes', quoted, `${quoted.length} bytes`,
    'ICMP errors quote the start of the packet that failed, so the sender can tell which conversation it belongs to.')
  const c = inetChecksum(s.bytes)
  s.set16(ck, c)
  s.setValue(ck, `${hex(c, 4)} (correct)`)
  return s
}

// ---------------------------------------------------------------- DNS

type RRType = 'A' | 'NS' | 'AAAA'
const RRTYPE: Record<RRType, number> = { A: 1, NS: 2, AAAA: 28 }

export interface DnsRR { name: string; type: 'A' | 'NS'; ttl: number; data: string }
export interface DnsMsg {
  id: number
  response?: boolean
  rd?: boolean
  ra?: boolean
  aa?: boolean
  question: { name: string; type: RRType }
  answers?: DnsRR[]
  authority?: DnsRR[]
  additional?: DnsRR[]
}

function labels(name: string): number[] {
  const out: number[] = []
  for (const part of name.split('.').filter(Boolean)) out.push(part.length, ...ascii(part))
  out.push(0)
  return out
}

export function dns(m: DnsMsg): Seg {
  const s = new Seg('dns', 'Domain Name System', 'DNS')
  s.u16('Transaction ID', m.id, hex(m.id, 4), 'Random ID copied into the reply, so the client can match answers to questions.')
  let flags = 0
  const desc: string[] = []
  if (m.response) { flags |= 0x8000; desc.push('response') } else desc.push('query')
  if (m.aa) { flags |= 0x0400; desc.push('authoritative') }
  if (m.rd) { flags |= 0x0100; desc.push('recursion desired') }
  if (m.ra) { flags |= 0x0080; desc.push('recursion available') }
  if (m.response) desc.push('no error')
  s.u16('Flags', flags, `${hex(flags, 4)} (${desc.join(', ')})`,
    'QR = query/response, AA = answer from the zone’s own server, RD = “please do the whole lookup for me”, RA = server supports that.')
  const an = m.answers ?? [], ns = m.authority ?? [], ar = m.additional ?? []
  s.u16('Questions', 1)
  s.u16('Answer RRs', an.length)
  s.u16('Authority RRs', ns.length, String(ns.length), ns.length ? 'Referral: “I don’t know, but these servers are responsible for that zone.”' : undefined)
  s.u16('Additional RRs', ar.length, String(ar.length), ar.length ? 'Glue records: addresses of the referred servers, saving an extra lookup.' : undefined)
  s.raw('Query name', labels(m.question.name), m.question.name, 'Encoded as length-prefixed labels: 3www7example3com0.')
  s.u16('Query type', RRTYPE[m.question.type], `${m.question.type} (${RRTYPE[m.question.type]})`, m.question.type === 'A' ? 'A = IPv4 address.' : undefined)
  s.u16('Query class', 1, 'IN (internet)')
  const writeRR = (rr: DnsRR, section: string) => {
    if (rr.name === m.question.name) {
      s.raw(`${section} name`, [0xc0, 0x0c], `${rr.name} (pointer → offset 12)`, 'Name compression: a 2-byte pointer back to the name in the question instead of repeating it.')
    } else {
      s.raw(`${section} name`, labels(rr.name), rr.name)
    }
    s.u16(`${section} type`, RRTYPE[rr.type], rr.type)
    s.u16(`${section} class`, 1, 'IN')
    s.u32(`${section} TTL`, rr.ttl, `${rr.ttl} s`, 'How long resolvers may cache this record.')
    const rdata = rr.type === 'A' ? parseIp(rr.data) : labels(rr.data)
    s.u16(`${section} data length`, rdata.length, `${rdata.length} bytes`)
    s.raw(rr.type === 'A' ? `${section} address` : `${section} name server`, rdata, rr.data)
  }
  an.forEach((rr) => writeRR(rr, 'Answer'))
  ns.forEach((rr) => writeRR(rr, 'Authority'))
  ar.forEach((rr) => writeRR(rr, 'Additional'))
  return s
}

// ---------------------------------------------------------------- DHCP

const DHCP_TYPES: Record<number, string> = { 1: 'Discover', 2: 'Offer', 3: 'Request', 5: 'ACK' }

export interface DhcpOpts {
  op: 1 | 2
  xid: number
  mac: string
  msgType: 1 | 2 | 3 | 5
  yiaddr?: string
  siaddr?: string
  broadcast?: boolean
  requestedIp?: string
  serverId?: string
  lease?: number
  mask?: string
  router?: string
  dns?: string
  paramList?: boolean
}

export function dhcp(o: DhcpOpts): Seg {
  const s = new Seg('dhcp', 'Dynamic Host Configuration Protocol', 'DHCP')
  s.u8('Message op', o.op, o.op === 1 ? '1 (boot request)' : '2 (boot reply)', 'DHCP reuses the older BOOTP format: clients send requests, servers send replies.')
  s.u8('Hardware type', 1, '1 (Ethernet)')
  s.u8('Hardware address length', 6, '6')
  s.u8('Hops', 0, '0', 'Incremented by relay agents that forward DHCP between subnets.')
  s.u32('Transaction ID', o.xid, hex(o.xid, 8), 'Random number chosen by the client; every message in this exchange carries it.')
  s.u16('Seconds elapsed', 0, '0')
  s.u16('Flags', o.broadcast ? 0x8000 : 0, o.broadcast ? '0x8000 (broadcast)' : '0x0000 (unicast)',
    'The broadcast bit asks the server to broadcast its reply, because the client cannot receive unicast IP yet.')
  s.raw('Client IP (ciaddr)', [0, 0, 0, 0], '0.0.0.0', 'Only filled in when renewing an existing lease.')
  s.raw('Your IP (yiaddr)', parseIp(o.yiaddr ?? '0.0.0.0'), o.yiaddr ?? '0.0.0.0', o.yiaddr ? 'The address the server is giving to the client.' : undefined)
  s.raw('Server IP (siaddr)', parseIp(o.siaddr ?? '0.0.0.0'), o.siaddr ?? '0.0.0.0')
  s.raw('Relay agent IP (giaddr)', [0, 0, 0, 0], '0.0.0.0', 'Set by a relay agent when the server sits on another subnet.')
  s.raw('Client MAC (chaddr)', parseMac(o.mac), o.mac, 'Identifies the client. Servers often reserve addresses by MAC.')
  s.raw('Client hardware padding', new Array(10).fill(0), '10 zero bytes')
  s.raw('Server host name', new Array(64).fill(0), 'not given', 'Legacy BOOTP field (64 bytes).')
  s.raw('Boot file name', new Array(128).fill(0), 'not given', 'Legacy BOOTP field used for network booting (128 bytes).')
  s.raw('Magic cookie', [0x63, 0x82, 0x53, 0x63], '0x63825363 (DHCP)', 'Marks the start of DHCP options.')
  s.raw('Option 53: message type', [53, 1, o.msgType], DHCP_TYPES[o.msgType], 'Discover → Offer → Request → ACK (“DORA”).')
  if (o.op === 1) s.raw('Option 61: client identifier', [61, 7, 1, ...parseMac(o.mac)], `Ethernet ${o.mac}`)
  if (o.requestedIp) s.raw('Option 50: requested IP', [50, 4, ...parseIp(o.requestedIp)], o.requestedIp, 'The client formally asks for the address it was offered.')
  if (o.serverId) s.raw('Option 54: server identifier', [54, 4, ...parseIp(o.serverId)], o.serverId,
    o.op === 1 ? 'Names the server whose offer was accepted; other servers withdraw their offers.' : 'Which DHCP server is talking.')
  if (o.lease) s.raw('Option 51: lease time', [51, 4, o.lease >>> 24, o.lease >>> 16, o.lease >>> 8, o.lease], `${o.lease} s (${o.lease / 3600} h)`,
    'The address is borrowed, not owned. The client renews at 50% of the lease (T1).')
  if (o.mask) s.raw('Option 1: subnet mask', [1, 4, ...parseIp(o.mask)], o.mask)
  if (o.router) s.raw('Option 3: router', [3, 4, ...parseIp(o.router)], o.router, 'Default gateway for traffic leaving the subnet.')
  if (o.dns) s.raw('Option 6: DNS server', [6, 4, ...parseIp(o.dns)], o.dns)
  if (o.paramList) s.raw('Option 55: parameter request list', [55, 4, 1, 3, 6, 15], 'mask, router, DNS, domain name', 'Settings the client would like the server to include.')
  s.u8('Option 255: end', 255, 'end')
  return s
}

// ---------------------------------------------------------------- HTTP / raw data

const HEADER_NOTES: Record<string, string> = {
  host: 'Required in HTTP/1.1. Lets one IP address host many websites (virtual hosting).',
  'user-agent': 'Identifies the browser or client software.',
  accept: 'Media types the client can handle.',
  connection: 'keep-alive reuses this TCP connection for further requests (default in HTTP/1.1).',
  'content-type': 'What the body is, so the browser knows how to render it.',
  'content-length': 'Body size in bytes, so the receiver knows where the message ends.',
  'cache-control': 'How long browsers and proxies may reuse the response without asking again.',
  date: 'When the server generated the response.',
  server: 'Server software. Optional.',
}

export function http(text: string): Seg {
  const s = new Seg('http', 'Hypertext Transfer Protocol', 'HTTP')
  const head = text.indexOf('\r\n\r\n')
  const headers = text.slice(0, head).split('\r\n')
  headers.forEach((line, i) => {
    if (i === 0) {
      const isResponse = line.startsWith('HTTP/')
      s.raw(isResponse ? 'Status line' : 'Request line', ascii(line + '\r\n'), line,
        isResponse ? 'Version, status code and reason. 2xx = success, 3xx = redirect, 4xx = client error, 5xx = server error.'
          : 'Method, path and version. GET asks for a resource without changing it.')
    } else {
      const c = line.indexOf(':')
      const name = line.slice(0, c)
      s.raw(name, ascii(line + '\r\n'), line.slice(c + 1).trim(), HEADER_NOTES[name.toLowerCase()])
    }
  })
  s.raw('End of headers', ascii('\r\n'), '\\r\\n', 'An empty line separates headers from the body.')
  const body = text.slice(head + 4)
  if (body.length) s.raw('Body', ascii(body), `${body.length} bytes`, body.length > 60 ? body.slice(0, 60) + '…' : body)
  return s
}

export function data(text: string): Seg {
  const s = new Seg('data', 'Application data', 'Data')
  s.raw('Data', ascii(text), `"${text}"`, `${text.length} bytes handed down by the application.`)
  return s
}

// ---------------------------------------------------------------- frame helpers

export interface Hop { srcMac: string; dstMac: string; ip: IpOpts }

export function udpFrame(h: Hop, sport: number, dport: number, app: Seg): Packet {
  const u = udp(sport, dport, app, h.ip)
  return assemble(ethernet(h.dstMac, h.srcMac, 0x0800), ipv4(h.ip, 17, u.length + app.length), u, app)
}

export function tcpFrame(h: Hop, t: TcpOpts, app: Seg | null = null): Packet {
  const seg = tcp(t, app, h.ip)
  const len = seg.length + (app?.length ?? 0)
  return app
    ? assemble(ethernet(h.dstMac, h.srcMac, 0x0800), ipv4(h.ip, 6, len), seg, app)
    : assemble(ethernet(h.dstMac, h.srcMac, 0x0800), ipv4(h.ip, 6, len), seg)
}

export function icmpFrame(h: Hop, msg: Seg): Packet {
  return assemble(ethernet(h.dstMac, h.srcMac, 0x0800), ipv4(h.ip, 1, msg.length), msg)
}

export function arpFrame(srcMac: string, dstMac: string, a: ArpOpts): Packet {
  return assemble(ethernet(dstMac, srcMac, 0x0806), arp(a))
}

/** Bytes of an IP datagram (no Ethernet) — used when ICMP errors quote the original packet. */
export function ipDatagram(ip: IpOpts, proto: number, inner: Seg): Uint8Array {
  return assemble(ipv4(ip, proto, inner.length), inner).bytes
}
