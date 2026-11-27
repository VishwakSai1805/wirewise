import { dns, http, tcpFrame, udpFrame, type TcpFlag } from '../../packets/layers'
import { IP, MAC } from '../net'
import { once, type Lesson } from '../types'

const C = 2209135411
const S = 951172390
const CP = 50744
const BODY = '<!doctype html><title>Example</title><h1>Hello from the server</h1><p>One request, one response.</p>'
const REQUEST = [
  'GET / HTTP/1.1',
  'Host: www.example.com',
  'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept: text/html',
  'Connection: keep-alive',
].join('\r\n') + '\r\n\r\n'
const RESPONSE = [
  'HTTP/1.1 200 OK',
  'Date: Fri, 27 Nov 2026 10:15:00 GMT',
  'Server: nginx',
  'Content-Type: text/html; charset=UTF-8',
  `Content-Length: ${BODY.length}`,
  'Cache-Control: max-age=600',
].join('\r\n') + '\r\n\r\n' + BODY

const out = { srcMac: MAC.client, dstMac: MAC.router }
const inb = { srcMac: MAC.router, dstMac: MAC.client }
let id = 0x6100
const c2s = (flags: TcpFlag[], seq: number, ack: number, body?: string, syn = false) =>
  once(() => tcpFrame({ ...out, ip: { src: IP.client, dst: IP.web, ttl: 128, id: id++ } },
    { sport: CP, dport: 80, seq: C + seq, isn: C, ack: S + ack, peerIsn: S, flags, win: syn ? 64240 : 1026, synOptions: syn },
    body ? http(body) : null))
const s2c = (flags: TcpFlag[], seq: number, ack: number, body?: string, syn = false) =>
  once(() => tcpFrame({ ...inb, ip: { src: IP.web, dst: IP.client, ttl: 53, id: 0 } },
    { sport: 80, dport: CP, seq: S + seq, isn: S, ack: C + ack, peerIsn: C, flags, win: syn ? 65535 : 501, synOptions: syn },
    body ? http(body) : null))

const toWeb = [['client', 'router', 'internet', 'server']]
const fromWeb = [['server', 'internet', 'router', 'client']]
const REQ = REQUEST.length
const RES = RESPONSE.length
const question = { name: 'www.example.com', type: 'A' as const }

export const httpLesson: Lesson = {
  id: 'http',
  title: 'What happens when you open a web page',
  protocol: 'HTTP',
  layer: 'L7',
  tagline: 'DNS, then TCP, then one GET and one 200 OK: every layer working together for a single page.',
  summary: 'Loading http://www.example.com/ needs an address (DNS), a reliable connection (TCP) and finally the HTTP request and response themselves.',
  capture: 'Captured on the laptop’s home network.',
  devices: [
    { id: 'client', label: 'Browser', sub: IP.client, kind: 'laptop', x: 110, y: 300 },
    { id: 'router', label: 'Home router', sub: IP.router, kind: 'router', x: 330, y: 300 },
    { id: 'internet', label: 'Internet', kind: 'cloud', x: 580, y: 220 },
    { id: 'resolver', label: 'DNS resolver', sub: IP.resolver, kind: 'dns', x: 580, y: 60 },
    { id: 'server', label: 'Web server', sub: IP.web, kind: 'server', x: 870, y: 300 },
  ],
  links: [['client', 'router'], ['router', 'internet'], ['internet', 'resolver'], ['internet', 'server']],
  participants: ['client', 'resolver', 'server'],
  packets: [
    {
      id: 'dnsq', label: 'DNS query', from: 'client', to: 'resolver', t: 0, paths: [['client', 'router', 'internet', 'resolver']],
      info: 'Standard query 0x2b7e A www.example.com',
      build: once(() => udpFrame({ ...out, ip: { src: IP.client, dst: IP.resolver, ttl: 128, id: 0x60ff } }, 55021, 53, dns({ id: 0x2b7e, rd: true, question }))),
    },
    {
      id: 'dnsr', label: 'DNS answer', from: 'resolver', to: 'client', t: 0.012, paths: [['resolver', 'internet', 'router', 'client']],
      info: `Standard query response 0x2b7e A ${IP.web}`,
      build: once(() => udpFrame({ ...inb, ip: { src: IP.resolver, dst: IP.client, ttl: 58, id: 0x1f20 } }, 53, 55021,
        dns({ id: 0x2b7e, response: true, rd: true, ra: true, question, answers: [{ name: 'www.example.com', type: 'A', ttl: 2914, data: IP.web }] }))),
    },
    { id: 'syn', label: 'SYN', from: 'client', to: 'server', t: 0.013, paths: toWeb, info: `${CP} → 80 [SYN] Seq=0`, build: c2s(['SYN'], 0, 0, undefined, true) },
    { id: 'synack', label: 'SYN, ACK', from: 'server', to: 'client', t: 0.031, paths: fromWeb, info: `80 → ${CP} [SYN, ACK] Seq=0 Ack=1`, build: s2c(['SYN', 'ACK'], 0, 1, undefined, true) },
    { id: 'ack', label: 'ACK', from: 'client', to: 'server', t: 0.0312, paths: toWeb, info: `${CP} → 80 [ACK] Seq=1 Ack=1`, build: c2s(['ACK'], 1, 1) },
    { id: 'get', label: 'GET /', from: 'client', to: 'server', t: 0.0315, paths: toWeb, info: 'GET / HTTP/1.1', build: c2s(['PSH', 'ACK'], 1, 1, REQUEST) },
    { id: 'ok', label: '200 OK', from: 'server', to: 'client', t: 0.052, paths: fromWeb, info: 'HTTP/1.1 200 OK (text/html)', build: s2c(['PSH', 'ACK'], 1, 1 + REQ, RESPONSE) },
    { id: 'ackok', label: 'ACK', from: 'client', to: 'server', t: 0.0522, paths: toWeb, info: `${CP} → 80 [ACK] Seq=${1 + REQ} Ack=${1 + RES}`, build: c2s(['ACK'], 1 + REQ, 1 + RES) },
  ],
  steps: [
    {
      title: 'Read the URL',
      body: [
        'You type http://www.example.com/. The browser splits it into a scheme (http), a host (www.example.com), a port (80, the default for http) and a path (/).',
        'Nothing has been sent yet. The browser checks its own cache first; if it already has a fresh copy of the page, no packets are needed at all.',
      ],
      packets: [],
      facts: [['Scheme', 'http'], ['Host', 'www.example.com'], ['Port', '80 (default)'], ['Path', '/']],
    },
    {
      title: 'Find the server (DNS)',
      body: [
        'The host name has to become an IP address. One UDP query to the resolver, one answer, 12 ms. The resolver had this name cached, so it answered straight away.',
        'The DNS lesson shows the full lookup a resolver does when its cache is empty.',
      ],
      packets: ['dnsq', 'dnsr'],
      facts: [['Answer', `www.example.com → ${IP.web}`], ['Time', '12 ms']],
    },
    {
      title: 'Open a TCP connection',
      body: [
        'HTTP needs a reliable byte stream, so the browser opens a TCP connection to port 80 with the three-way handshake.',
        'This costs one round trip (18 ms here) before the request can even be sent. With HTTPS, a TLS handshake would follow before any HTTP.',
      ],
      packets: ['syn', 'synack', 'ack'],
      facts: [['Destination', `${IP.web}:80`], ['Client port', `${CP} (ephemeral)`], ['Cost', '1 RTT']],
    },
    {
      title: 'Send the request',
      body: [
        'HTTP/1.1 is plain text: a request line (method, path, version), header lines, and an empty line. A GET has no body.',
        'The Host header is required: one IP address can serve thousands of websites, and this header says which one you want.',
      ],
      packets: ['get'],
      facts: [['Method', 'GET'], ['Request size', `${REQ} bytes`], ['Key header', 'Host: www.example.com']],
    },
    {
      title: 'Receive the response',
      body: [
        'The server answers with a status line (200 OK), headers describing the content, an empty line and the HTML body. Its TCP segment also acknowledges the request.',
        'The browser now parses the HTML. Each image, stylesheet or script it references needs another request; keep-alive lets them reuse this same connection instead of opening new ones.',
      ],
      packets: ['ok', 'ackok'],
      facts: [['Status', '200 OK'], ['Body', `text/html, ${BODY.length} bytes`], ['Time to first byte', '≈ 52 ms'], ['Connection', 'kept open']],
    },
  ],
  takeaways: [
    'A page load stacks protocols: DNS (UDP) → TCP handshake → HTTP request/response.',
    'Without caching, the first byte arrives after about three round trips: DNS, TCP, HTTP.',
    'HTTP/1.1 messages are text: start line, headers, blank line, optional body.',
    'Status classes: 2xx success, 3xx redirect, 4xx client error, 5xx server error.',
    'Persistent (keep-alive) connections avoid repeating the TCP handshake for every resource.',
  ],
  quiz: [
    {
      q: 'Ignoring DNS, how many round trips pass before the first byte of the page arrives over plain HTTP?',
      options: ['1', '2', '3', '4'],
      answer: 1,
      why: 'One for the TCP handshake and one for the request and response.',
    },
    {
      q: 'What does the Host header make possible?',
      options: ['Encryption', 'Many websites on one IP address', 'Compression', 'Caching'],
      answer: 1,
      why: 'The server reads Host to choose which site to serve. This is called virtual hosting.',
    },
    {
      q: 'Which status code means the resource was not found?',
      options: ['200', '301', '404', '500'],
      answer: 2,
      why: '4xx codes are client errors; 404 means the path does not exist on the server.',
    },
    {
      q: 'Which transport protocol and port does plain HTTP/1.1 use by default?',
      options: ['UDP 53', 'TCP 80', 'TCP 443', 'UDP 80'],
      answer: 1,
      why: 'HTTP/1.1 runs over TCP; port 80 is the default for http:// and 443 for https://.',
    },
  ],
  references: [
    { label: 'RFC 9110: HTTP semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { label: 'RFC 9112: HTTP/1.1', url: 'https://www.rfc-editor.org/rfc/rfc9112' },
  ],
}
