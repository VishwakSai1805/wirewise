import { data, tcpFrame, type TcpFlag } from '../../packets/layers'
import { IP, MAC } from '../net'
import { once, type Lesson } from '../types'

const C = 1203982811 // client ISN
const S = 3528104477 // server ISN
const MSG = 'hello, network!'
const N = MSG.length // 15 bytes
const CP = 50612
const SP = 7

let ipId = 0x4d00
/** Client → server segment (relative seq/ack). */
const c2s = (flags: TcpFlag[], seq: number, ack: number, payload?: string, syn = false) =>
  once(() => tcpFrame(
    { srcMac: MAC.client, dstMac: MAC.router, ip: { src: IP.client, dst: IP.echo, ttl: 128, id: ipId++ } },
    { sport: CP, dport: SP, seq: C + seq, isn: C, ack: S + ack, peerIsn: S, flags, win: syn ? 64240 : 1026, synOptions: syn },
    payload ? data(payload) : null))
/** Server → client segment (relative seq/ack). */
const s2c = (flags: TcpFlag[], seq: number, ack: number, payload?: string, syn = false) =>
  once(() => tcpFrame(
    { srcMac: MAC.router, dstMac: MAC.client, ip: { src: IP.echo, dst: IP.client, ttl: 54, id: 0 } },
    { sport: SP, dport: CP, seq: S + seq, isn: S, ack: C + ack, peerIsn: C, flags, win: syn ? 65160 : 509, synOptions: syn },
    payload ? data(payload) : null))

const out = [['client', 'router', 'internet', 'server']]
const back = [['server', 'internet', 'router', 'client']]

export const tcpLesson: Lesson = {
  id: 'tcp',
  title: 'Open, use and close a reliable connection',
  protocol: 'TCP',
  layer: 'L4',
  tagline: 'The three-way handshake, sequence and acknowledgment numbers, and the four-way close.',
  summary: 'IP can lose, duplicate and reorder packets. TCP builds a reliable, ordered byte stream on top by numbering every byte and acknowledging what arrives.',
  capture: 'Captured on the client’s home network. The client talks to an echo server on port 7.',
  devices: [
    { id: 'client', label: 'Client', sub: IP.client, kind: 'laptop', x: 120, y: 230 },
    { id: 'router', label: 'Home router', sub: IP.router, kind: 'router', x: 340, y: 230 },
    { id: 'internet', label: 'Internet', kind: 'cloud', x: 600, y: 230 },
    { id: 'server', label: 'Echo server', sub: IP.echo, kind: 'server', x: 870, y: 230 },
  ],
  links: [['client', 'router'], ['router', 'internet'], ['internet', 'server']],
  participants: ['client', 'server'],
  packets: [
    { id: 'syn', label: 'SYN', from: 'client', to: 'server', t: 0, paths: out, info: `${CP} → ${SP} [SYN] Seq=0 Win=64240 MSS=1460`, build: c2s(['SYN'], 0, 0, undefined, true) },
    { id: 'synack', label: 'SYN, ACK', from: 'server', to: 'client', t: 0.018, paths: back, info: `${SP} → ${CP} [SYN, ACK] Seq=0 Ack=1 Win=65160`, build: s2c(['SYN', 'ACK'], 0, 1, undefined, true) },
    { id: 'ack', label: 'ACK', from: 'client', to: 'server', t: 0.0182, paths: out, info: `${CP} → ${SP} [ACK] Seq=1 Ack=1`, build: c2s(['ACK'], 1, 1) },
    { id: 'data', label: `Data (${N} B)`, from: 'client', to: 'server', t: 0.019, paths: out, info: `${CP} → ${SP} [PSH, ACK] Seq=1 Ack=1 Len=${N}`, build: c2s(['PSH', 'ACK'], 1, 1, MSG) },
    { id: 'echo', label: `Data + ACK`, from: 'server', to: 'client', t: 0.037, paths: back, info: `${SP} → ${CP} [PSH, ACK] Seq=1 Ack=${1 + N} Len=${N}`, build: s2c(['PSH', 'ACK'], 1, 1 + N, MSG) },
    { id: 'ack2', label: 'ACK', from: 'client', to: 'server', t: 0.0372, paths: out, info: `${CP} → ${SP} [ACK] Seq=${1 + N} Ack=${1 + N}`, build: c2s(['ACK'], 1 + N, 1 + N) },
    { id: 'fin1', label: 'FIN', from: 'client', to: 'server', t: 0.040, paths: out, info: `${CP} → ${SP} [FIN, ACK] Seq=${1 + N} Ack=${1 + N}`, build: c2s(['FIN', 'ACK'], 1 + N, 1 + N) },
    { id: 'finack1', label: 'ACK', from: 'server', to: 'client', t: 0.058, paths: back, info: `${SP} → ${CP} [ACK] Seq=${1 + N} Ack=${2 + N}`, build: s2c(['ACK'], 1 + N, 2 + N) },
    { id: 'fin2', label: 'FIN', from: 'server', to: 'client', t: 0.0581, paths: back, info: `${SP} → ${CP} [FIN, ACK] Seq=${1 + N} Ack=${2 + N}`, build: s2c(['FIN', 'ACK'], 1 + N, 2 + N) },
    { id: 'finack2', label: 'ACK', from: 'client', to: 'server', t: 0.0582, paths: out, info: `${CP} → ${SP} [ACK] Seq=${2 + N} Ack=${2 + N}`, build: c2s(['ACK'], 2 + N, 2 + N) },
  ],
  steps: [
    {
      title: 'SYN: “Can we talk?”',
      body: [
        'The client picks a random initial sequence number (ISN) and sends a segment with only the SYN flag set. Tools show the ISN as relative 0 to keep the arithmetic readable.',
        'Options in the SYN advertise what the client supports: a maximum segment size of 1460 bytes, window scaling and selective acknowledgments.',
      ],
      packets: ['syn'],
      facts: [['Client state', 'CLOSED → SYN_SENT'], ['Server state', 'LISTEN'], ['Client ISN', `${C} (relative 0)`], ['MSS', '1460 bytes']],
    },
    {
      title: 'SYN-ACK: “Yes, and here’s my number”',
      body: [
        'The server answers with SYN and ACK set. It picks its own random ISN and acknowledges the client’s: Ack = client ISN + 1.',
        'Why +1? A SYN carries no data but still uses up one sequence number, so it can be acknowledged and retransmitted like data.',
      ],
      packets: ['synack'],
      facts: [['Server state', 'LISTEN → SYN_RCVD'], ['Ack', `${C + 1} (relative 1)`], ['Round-trip time', '18 ms']],
    },
    {
      title: 'ACK: connection established',
      body: [
        'The client acknowledges the server’s SYN. Both sides now know both ISNs and both are ESTABLISHED. The handshake cost one full round trip before any data moved.',
        'Three messages, not two: each side must confirm the other’s starting number. A stray, old SYN from a previous connection gets rejected at this step instead of opening a ghost connection.',
      ],
      packets: ['ack'],
      facts: [['Client state', 'ESTABLISHED'], ['Server state', 'ESTABLISHED'], ['Handshake cost', '1 RTT']],
    },
    {
      title: 'Send data and acknowledge it',
      body: [
        `The client sends ${N} bytes (“${MSG}”) starting at Seq = 1. The server replies with Ack = ${1 + N}: “I have everything up to byte ${N}, send byte ${1 + N} next.”`,
        'The server echoes the text back and puts its acknowledgment in the same segment (piggybacking). If an ACK never arrives, the sender retransmits after a timeout; ACKs are cumulative, so one ACK covers all earlier bytes.',
      ],
      packets: ['data', 'echo', 'ack2'],
      facts: [['Client sends', `Seq 1, ${N} bytes`], ['Server ACKs', `Ack ${1 + N}`], ['Rule', 'next Ack = Seq + length'], ['Window', 'free receive buffer (flow control)']],
    },
    {
      title: 'Close: FIN, ACK, FIN, ACK',
      body: [
        'Each direction closes on its own. The client sends FIN (it has nothing more to send); the server ACKs it, may finish sending, then sends its own FIN, which the client ACKs. Servers often merge the middle two into one FIN-ACK.',
        'The side that closed first waits in TIME_WAIT for 2 × MSL (up to a few minutes) so that a lost final ACK can be resent and late segments die out before the port is reused.',
      ],
      packets: ['fin1', 'finack1', 'fin2', 'finack2'],
      facts: [['Client states', 'FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT'], ['Server states', 'CLOSE_WAIT → LAST_ACK → CLOSED'], ['FIN uses', '1 sequence number']],
    },
  ],
  takeaways: [
    'Handshake: SYN → SYN-ACK → ACK, costing one round trip.',
    'Sequence numbers count bytes, starting from a random ISN; SYN and FIN each consume one.',
    'Ack = the next byte expected. ACKs are cumulative and can ride on data segments.',
    'The window field advertises free receive buffer (flow control).',
    'Closing takes four segments; the active closer waits in TIME_WAIT.',
  ],
  quiz: [
    {
      q: 'A client’s SYN has Seq = 1000 (raw). What Ack does the SYN-ACK carry?',
      options: ['1000', '1001', '0', 'The server’s ISN + 1'],
      answer: 1,
      why: 'The SYN consumes one sequence number, so the server expects byte 1001 next.',
    },
    {
      q: 'The client sends 15 bytes with relative Seq = 1. What Ack will the server send?',
      options: ['15', '16', '2', '1'],
      answer: 1,
      why: 'Ack = Seq + length = 1 + 15 = 16, the next byte the server expects.',
    },
    {
      q: 'Which side enters TIME_WAIT?',
      options: ['The server, always', 'The side that sends the first FIN', 'The side that sends the last FIN', 'Both sides'],
      answer: 1,
      why: 'The active closer waits 2 × MSL so a lost final ACK can be retransmitted.',
    },
    {
      q: 'Why is the initial sequence number random?',
      options: ['To compress headers', 'So segments from old connections and spoofed packets are unlikely to be accepted', 'Because counting starts at a random byte of the file', 'For encryption'],
      answer: 1,
      why: 'A predictable ISN would let attackers inject segments or confuse a new connection with an old one.',
    },
    {
      q: 'What does the TCP window field tell the other side?',
      options: ['The congestion window', 'How many more bytes the receiver can accept', 'The maximum segment size', 'The number of hops'],
      answer: 1,
      why: 'This is flow control: the receiver advertises free buffer space. Congestion control uses a separate, sender-side window (see the congestion lab).',
    },
  ],
  references: [
    { label: 'RFC 9293: Transmission Control Protocol', url: 'https://www.rfc-editor.org/rfc/rfc9293' },
  ],
}
