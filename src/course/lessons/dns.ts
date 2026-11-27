import { dns, udpFrame, type DnsMsg } from '../../packets/layers'
import { IP, MAC } from '../net'
import { once, type Lesson } from '../types'

const NAME = 'www.example.com'
const question = { name: NAME, type: 'A' as const }

/** Frames seen on the laptop's LAN. */
const lan = (out: boolean, sport: number, dport: number, msg: DnsMsg, id: number) =>
  udpFrame(out
    ? { srcMac: MAC.client, dstMac: MAC.router, ip: { src: IP.client, dst: IP.resolver, ttl: 128, id } }
    : { srcMac: MAC.router, dstMac: MAC.client, ip: { src: IP.resolver, dst: IP.client, ttl: 58, id } },
  sport, dport, dns(msg))

/** Frames seen on the resolver's network card. */
const res = (out: boolean, server: string, sport: number, dport: number, msg: DnsMsg, id: number) =>
  udpFrame(out
    ? { srcMac: MAC.resolver, dstMac: MAC.resolverGw, ip: { src: IP.resolver, dst: server, ttl: 64, id } }
    : { srcMac: MAC.resolverGw, dstMac: MAC.resolver, ip: { src: server, dst: IP.resolver, ttl: 55, id } },
  sport, dport, dns(msg))

const answer = { name: NAME, type: 'A' as const, ttl: 3600, data: IP.web }

export const dnsLesson: Lesson = {
  id: 'dns',
  title: 'Turning a name into an address',
  protocol: 'DNS',
  layer: 'L7',
  tagline: 'Follow one lookup from the root servers down to the authoritative answer, then watch the cache take over.',
  summary: 'Computers route by IP address, people remember names. DNS is a distributed database: no single server knows everything, but each one knows who to ask next.',
  capture: 'Laptop messages captured on the home LAN; resolver messages captured on the resolver.',
  devices: [
    { id: 'laptop', label: 'Laptop', sub: IP.client, kind: 'laptop', x: 100, y: 330 },
    { id: 'router', label: 'Home router', sub: IP.router, kind: 'router', x: 270, y: 330 },
    { id: 'internet', label: 'Internet', kind: 'cloud', x: 500, y: 220 },
    { id: 'resolver', label: 'Recursive resolver', sub: IP.resolver, kind: 'dns', x: 270, y: 90 },
    { id: 'root', label: 'Root server', sub: IP.root, kind: 'dns', x: 740, y: 70 },
    { id: 'tld', label: '.com TLD server', sub: IP.tld, kind: 'dns', x: 880, y: 220 },
    { id: 'auth', label: 'ns1.example.com', sub: IP.auth, kind: 'dns', x: 740, y: 370 },
  ],
  links: [['laptop', 'router'], ['router', 'internet'], ['internet', 'resolver'], ['internet', 'root'], ['internet', 'tld'], ['internet', 'auth']],
  participants: ['laptop', 'resolver', 'root', 'tld', 'auth'],
  packets: [
    {
      id: 'q1', label: 'Query A www.example.com', from: 'laptop', to: 'resolver', t: 0,
      paths: [['laptop', 'router', 'internet', 'resolver']], info: `Standard query 0x4a1c A ${NAME}`,
      build: once(() => lan(true, 51515, 53, { id: 0x4a1c, rd: true, question }, 0x3101)),
    },
    {
      id: 'q2', label: 'Query (iterative)', from: 'resolver', to: 'root', t: 0.002,
      paths: [['resolver', 'internet', 'root']], info: `Standard query 0x9e01 A ${NAME}`,
      build: once(() => res(true, IP.root, 40112, 53, { id: 0x9e01, question }, 0x5a01)),
    },
    {
      id: 'r2', label: 'Referral: ask .com', from: 'root', to: 'resolver', t: 0.021,
      paths: [['root', 'internet', 'resolver']], info: 'Response 0x9e01 · NS a.gtld-servers.net',
      build: once(() => res(false, IP.root, 53, 40112, {
        id: 0x9e01, response: true, question,
        authority: [{ name: 'com', type: 'NS', ttl: 172800, data: 'a.gtld-servers.net' }],
        additional: [{ name: 'a.gtld-servers.net', type: 'A', ttl: 172800, data: IP.tld }],
      }, 0xc211)),
    },
    {
      id: 'q3', label: 'Query (iterative)', from: 'resolver', to: 'tld', t: 0.022,
      paths: [['resolver', 'internet', 'tld']], info: `Standard query 0x51c7 A ${NAME}`,
      build: once(() => res(true, IP.tld, 40987, 53, { id: 0x51c7, question }, 0x5a02)),
    },
    {
      id: 'r3', label: 'Referral: ask ns1', from: 'tld', to: 'resolver', t: 0.048,
      paths: [['tld', 'internet', 'resolver']], info: 'Response 0x51c7 · NS ns1.example.com',
      build: once(() => res(false, IP.tld, 53, 40987, {
        id: 0x51c7, response: true, question,
        authority: [{ name: 'example.com', type: 'NS', ttl: 172800, data: 'ns1.example.com' }],
        additional: [{ name: 'ns1.example.com', type: 'A', ttl: 172800, data: IP.auth }],
      }, 0x8e40)),
    },
    {
      id: 'q4', label: 'Query (iterative)', from: 'resolver', to: 'auth', t: 0.049,
      paths: [['resolver', 'internet', 'auth']], info: `Standard query 0x0d42 A ${NAME}`,
      build: once(() => res(true, IP.auth, 41733, 53, { id: 0x0d42, question }, 0x5a03)),
    },
    {
      id: 'r4', label: 'Answer (authoritative)', from: 'auth', to: 'resolver', t: 0.071,
      paths: [['auth', 'internet', 'resolver']], info: `Response 0x0d42 A ${IP.web} (authoritative)`,
      build: once(() => res(false, IP.auth, 53, 41733, { id: 0x0d42, response: true, aa: true, question, answers: [answer] }, 0x1b77)),
    },
    {
      id: 'r1', label: 'Answer', from: 'resolver', to: 'laptop', t: 0.073,
      paths: [['resolver', 'internet', 'router', 'laptop']], info: `Response 0x4a1c A ${IP.web}`,
      build: once(() => lan(false, 53, 51515, { id: 0x4a1c, response: true, rd: true, ra: true, question, answers: [answer] }, 0x9d02)),
    },
    {
      id: 'q5', label: 'Query again', from: 'laptop', to: 'resolver', t: 61.0,
      paths: [['laptop', 'router', 'internet', 'resolver']], info: `Standard query 0x77e3 A ${NAME}`,
      build: once(() => lan(true, 52230, 53, { id: 0x77e3, rd: true, question }, 0x3102)),
    },
    {
      id: 'r5', label: 'Answer from cache', from: 'resolver', to: 'laptop', t: 61.012,
      paths: [['resolver', 'internet', 'router', 'laptop']], info: `Response 0x77e3 A ${IP.web} (TTL 3540)`,
      build: once(() => lan(false, 53, 52230, { id: 0x77e3, response: true, rd: true, ra: true, question, answers: [{ ...answer, ttl: 3540 }] }, 0x9d03)),
    },
  ],
  steps: [
    {
      title: 'Ask the recursive resolver',
      body: [
        `The browser needs an address for ${NAME}. The operating system’s stub resolver checks its own cache and hosts file, finds nothing, and sends one UDP query to the resolver it learned from DHCP.`,
        'The RD (recursion desired) flag means: “do the whole lookup for me and come back with the final answer.”',
      ],
      packets: ['q1'],
      facts: [['Transport', 'UDP port 53'], ['Flag', 'RD = 1 (recursive)'], ['Question', `${NAME}, type A`]],
    },
    {
      title: 'Start at the root',
      body: [
        'The resolver’s cache is empty, so it starts at the top of the hierarchy. There are 13 named root servers, each copied to hundreds of sites using anycast.',
        'The root does not know the answer, but it knows who runs .com. It replies with a referral: an NS record, plus a “glue” A record so the resolver can reach that server immediately.',
      ],
      packets: ['q2', 'r2'],
      facts: [['Query type', 'iterative (RD = 0)'], ['Root says', 'ask a.gtld-servers.net'], ['Glue', `a.gtld-servers.net → ${IP.tld}`]],
    },
    {
      title: 'Ask the .com servers',
      body: [
        'The resolver repeats the same question to a .com top-level-domain server. It still does not have the final answer, but it knows which servers are responsible for example.com.',
        'Each referral moves one label down the name: root → com → example.com.',
      ],
      packets: ['q3', 'r3'],
      facts: [['TLD says', 'ask ns1.example.com'], ['Glue', `ns1.example.com → ${IP.auth}`]],
    },
    {
      title: 'Get the authoritative answer',
      body: [
        'ns1.example.com holds the zone file for example.com, so it answers with the A record and sets the AA (authoritative answer) flag.',
        'The resolver caches the record for its TTL (3600 s) and returns it to the laptop. The full lookup took about 73 ms and four round trips.',
      ],
      packets: ['q4', 'r4', 'r1'],
      facts: [['Answer', `${NAME} → ${IP.web}`], ['TTL', '3600 s'], ['Flags to laptop', 'RD, RA'], ['Total time', '≈ 73 ms']],
    },
    {
      title: 'Ask again: a cache hit',
      body: [
        'A minute later another device on the network asks for the same name. The resolver answers straight from its cache, in one round trip and no extra queries.',
        'Notice the TTL in the answer: 3540, not 3600. Cached records count down, so every cache forgets them at the same moment.',
      ],
      packets: ['q5', 'r5'],
      facts: [['Answered from', 'resolver cache'], ['TTL now', '3540 s'], ['Time', '≈ 12 ms']],
    },
  ],
  takeaways: [
    'The laptop sends one recursive query; the resolver performs the iterative queries.',
    'The hierarchy is root → TLD → authoritative, and each level answers with a referral.',
    'Glue records give the address of a referred name server in the same response.',
    'Caching with TTLs keeps most lookups to a single round trip.',
    'DNS normally uses UDP port 53; it switches to TCP for large responses and zone transfers.',
  ],
  quiz: [
    {
      q: 'Which server sets the AA (authoritative answer) flag?',
      options: ['The root server', 'The .com TLD server', 'ns1.example.com', 'The recursive resolver'],
      answer: 2,
      why: 'Only the server that holds the example.com zone is authoritative for www.example.com.',
    },
    {
      q: 'The laptop’s query to the resolver is…',
      options: ['iterative', 'recursive', 'authoritative', 'a zone transfer'],
      answer: 1,
      why: 'It sets RD = 1 and expects a final answer. The resolver’s queries to root, TLD and authoritative servers are iterative.',
    },
    {
      q: 'What is a glue record?',
      options: ['A record that joins two zones', 'The A record of a referred name server, sent in the additional section', 'A cached negative answer', 'A CNAME alias'],
      answer: 1,
      why: 'Without glue, the resolver would need a separate lookup to find ns1.example.com, which itself lives inside example.com.',
    },
    {
      q: 'Why did the TTL drop from 3600 to 3540 in the second answer?',
      options: ['The server changed it', 'The record had been cached for 60 seconds', 'Packet loss', 'The laptop asked for a shorter TTL'],
      answer: 1,
      why: 'Caches return the remaining lifetime, so downstream caches expire the record at the same moment.',
    },
  ],
  references: [
    { label: 'RFC 1034: DNS concepts', url: 'https://www.rfc-editor.org/rfc/rfc1034' },
    { label: 'RFC 1035: DNS implementation', url: 'https://www.rfc-editor.org/rfc/rfc1035' },
    { label: 'Root server list (root-servers.org)', url: 'https://root-servers.org/' },
  ],
}
