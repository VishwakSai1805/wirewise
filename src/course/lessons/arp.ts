import { arpFrame, icmpEcho, icmpFrame } from '../../packets/layers'
import { IP, MAC } from '../net'
import { once, type Lesson } from '../types'

const pingData = Array.from('abcdefghijklmnopqrstuvwabcdefghi', (c) => c.charCodeAt(0))

export const arpLesson: Lesson = {
  id: 'arp',
  title: 'Finding a neighbour’s MAC address',
  protocol: 'ARP',
  layer: 'L2',
  tagline: 'How a host turns an IP address into a MAC address before it can send a single frame.',
  summary: 'Ethernet delivers frames by MAC address, but applications only know IP addresses. ARP bridges the two with one broadcast question and one unicast answer.',
  capture: 'Captured on Laptop A’s network card.',
  devices: [
    { id: 'hostA', label: 'Laptop A', sub: IP.client, kind: 'laptop', x: 130, y: 230 },
    { id: 'switch', label: 'Switch', sub: '4 ports', kind: 'switch', x: 460, y: 230 },
    { id: 'router', label: 'Router', sub: IP.router, kind: 'router', x: 460, y: 70 },
    { id: 'hostB', label: 'PC B', sub: IP.hostB, kind: 'pc', x: 820, y: 130 },
    { id: 'printer', label: 'Printer', sub: IP.printer, kind: 'printer', x: 820, y: 340 },
  ],
  links: [['hostA', 'switch'], ['switch', 'router'], ['switch', 'hostB'], ['switch', 'printer']],
  participants: ['hostA', 'hostB', 'printer', 'router'],
  packets: [
    {
      id: 'arp-req', label: 'ARP request', from: 'hostA', to: 'hostB', broadcast: true, t: 0,
      paths: [['hostA', 'switch', 'hostB'], ['hostA', 'switch', 'printer'], ['hostA', 'switch', 'router']],
      info: `Who has ${IP.hostB}? Tell ${IP.client}`,
      build: once(() => arpFrame(MAC.client, MAC.broadcast, { op: 1, sha: MAC.client, spa: IP.client, tha: MAC.none, tpa: IP.hostB })),
    },
    {
      id: 'arp-rep', label: 'ARP reply', from: 'hostB', to: 'hostA', t: 0.0011,
      paths: [['hostB', 'switch', 'hostA']],
      info: `${IP.hostB} is at ${MAC.hostB}`,
      build: once(() => arpFrame(MAC.hostB, MAC.client, { op: 2, sha: MAC.hostB, spa: IP.hostB, tha: MAC.client, tpa: IP.client })),
    },
    {
      id: 'ping-req', label: 'Ping request', from: 'hostA', to: 'hostB', t: 0.0013,
      paths: [['hostA', 'switch', 'hostB']],
      info: 'Echo (ping) request id=0x0001, seq=1',
      build: once(() => icmpFrame({ srcMac: MAC.client, dstMac: MAC.hostB, ip: { src: IP.client, dst: IP.hostB, ttl: 128, id: 0x2f01 } }, icmpEcho(8, 1, 1, pingData))),
    },
    {
      id: 'ping-rep', label: 'Ping reply', from: 'hostB', to: 'hostA', t: 0.0021,
      paths: [['hostB', 'switch', 'hostA']],
      info: 'Echo (ping) reply id=0x0001, seq=1',
      build: once(() => icmpFrame({ srcMac: MAC.hostB, dstMac: MAC.client, ip: { src: IP.hostB, dst: IP.client, ttl: 128, id: 0x6a12 } }, icmpEcho(0, 1, 1, pingData))),
    },
  ],
  steps: [
    {
      title: 'Is the target on my network?',
      body: [
        `Laptop A wants to ping ${IP.hostB}. First it ANDs both addresses with its subnet mask, 255.255.255.0. Both give 192.168.0.0, so the target is on the same LAN and can be reached directly, without the router.`,
        'Ethernet, however, needs the target’s MAC address, and A’s ARP cache has no entry for it. A must ask.',
      ],
      packets: [],
      facts: [['Laptop A', `${IP.client}/24`], ['Target', IP.hostB], ['Same network?', 'Yes: 192.168.0.0/24'], ['ARP cache', 'empty']],
    },
    {
      title: 'Ask everyone: “Who has .30?”',
      body: [
        'A broadcasts an ARP request to ff:ff:ff:ff:ff:ff. It includes its own IP and MAC, and leaves the target MAC as zeros: that is the unknown.',
        'A switch always floods broadcasts: it copies the frame out of every port except the one it arrived on. Along the way it learns that A’s MAC address lives on port 1.',
      ],
      packets: ['arp-req'],
      facts: [['Destination MAC', 'ff:ff:ff:ff:ff:ff'], ['Switch learns', `${MAC.client} → port 1`], ['Reaches', 'every device on the LAN']],
    },
    {
      title: 'Only the owner answers',
      body: [
        'Every device reads the request, but only PC B owns 192.168.0.30, so only B replies. The printer and router drop it.',
        'B already knows A’s MAC from the request, so the reply is a normal unicast frame. The switch learns B’s port and forwards the reply only to A.',
      ],
      packets: ['arp-rep'],
      facts: [['Reply type', 'unicast'], ['Switch learns', `${MAC.hostB} → port 3`], ['B caches', `${IP.client} → ${MAC.client}`]],
    },
    {
      title: 'Now the real packet can go',
      body: [
        'A stores the answer in its ARP cache (typically for a few minutes) and finally sends the ping, with B’s MAC as the frame’s destination.',
        'Later packets to B skip ARP entirely until the cache entry expires.',
      ],
      packets: ['ping-req', 'ping-rep'],
      facts: [['ARP cache', `${IP.hostB} → ${MAC.hostB}`], ['Ping round trip', '0.8 ms']],
    },
    {
      title: 'What if the target is on another network?',
      body: [
        'If the AND test shows a different network (say 8.8.8.8), A does not ARP for the remote host. It ARPs for its default gateway, 192.168.0.1, and sends the frame to the router’s MAC. The IP destination stays 8.8.8.8.',
        'ARP has no authentication: any device can send fake replies (“ARP spoofing”) to intercept traffic. Switches with Dynamic ARP Inspection defend against this.',
      ],
      packets: [],
      facts: [['Off-subnet target', 'ARP for the gateway'], ['Frame destination', 'router’s MAC'], ['IP destination', 'unchanged']],
    },
  ],
  takeaways: [
    'ARP maps a next-hop IP address to a MAC address on the local link.',
    'Requests are broadcast; replies are unicast.',
    'Hosts and switches both learn from what they see: hosts fill ARP caches, switches fill MAC tables.',
    'For destinations outside the subnet, a host ARPs for its default gateway, not the remote host.',
  ],
  quiz: [
    {
      q: 'What is the destination MAC address of an ARP request?',
      options: ['ff:ff:ff:ff:ff:ff', 'The target’s MAC address', '00:00:00:00:00:00', 'The default gateway’s MAC'],
      answer: 0,
      why: 'The sender does not know the target’s MAC yet, so it broadcasts. The zeros go in the ARP Target MAC field, not in the Ethernet header.',
    },
    {
      q: 'Host 192.168.0.20/24 wants to reach 8.8.8.8. Whose MAC does it ask for?',
      options: ['8.8.8.8’s', 'Its default gateway’s', 'The DNS server’s', 'Nobody’s: it broadcasts the IP packet'],
      answer: 1,
      why: '8.8.8.8 is outside 192.168.0.0/24, so the frame must go to the router. Only the router’s MAC is needed on this link.',
    },
    {
      q: 'A switch receives a frame for a MAC address that is not in its table. What does it do?',
      options: ['Drops it', 'Sends it back to the sender', 'Floods it out of every port except the incoming one', 'Sends an ARP request'],
      answer: 2,
      why: 'Unknown-unicast flooding guarantees delivery. The switch learns the right port as soon as the destination replies.',
    },
    {
      q: 'Why can the ARP reply be unicast?',
      options: ['Replies are always unicast in every protocol', 'The request already carried the sender’s MAC', 'The switch rewrites it', 'The router supplies the MAC'],
      answer: 1,
      why: 'The request contains the sender’s IP and MAC, so the target can reply straight to it.',
    },
  ],
  references: [
    { label: 'RFC 826: Address Resolution Protocol', url: 'https://www.rfc-editor.org/rfc/rfc826' },
  ],
}
