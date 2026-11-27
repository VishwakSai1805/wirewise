import { dhcp, udpFrame } from '../../packets/layers'
import { IP, MAC } from '../net'
import { once, type Lesson } from '../types'

const XID = 0x3903f326
const LEASE = 86400
const toAll = { src: '0.0.0.0', dst: '255.255.255.255', ttl: 128 }
const fromServer = { src: IP.router, dst: '255.255.255.255', ttl: 64 }
const offerFields = { yiaddr: IP.client, siaddr: IP.router, serverId: IP.router, lease: LEASE, mask: '255.255.255.0', router: IP.router, dns: IP.resolver }

export const dhcpLesson: Lesson = {
  id: 'dhcp',
  title: 'Getting an IP address automatically',
  protocol: 'DHCP',
  layer: 'L7',
  tagline: 'Discover, Offer, Request, Acknowledge: how a new device joins a network with zero setup.',
  summary: 'A freshly connected laptop has no IP address, no gateway and no DNS server. Four broadcast-friendly messages hand it all three, on loan for a fixed time.',
  capture: 'Captured on the home LAN.',
  devices: [
    { id: 'laptop', label: 'New laptop', sub: 'no address yet', kind: 'laptop', x: 130, y: 230 },
    { id: 'switch', label: 'Switch', kind: 'switch', x: 460, y: 230 },
    { id: 'router', label: 'Router · DHCP server', sub: IP.router, kind: 'router', x: 820, y: 120 },
    { id: 'phone', label: 'Phone', sub: IP.phone, kind: 'phone', x: 820, y: 340 },
  ],
  links: [['laptop', 'switch'], ['switch', 'router'], ['switch', 'phone']],
  participants: ['laptop', 'router', 'phone'],
  packets: [
    {
      id: 'discover', label: 'DHCPDISCOVER', from: 'laptop', to: 'router', broadcast: true, t: 0,
      paths: [['laptop', 'switch', 'router'], ['laptop', 'switch', 'phone']],
      info: `DHCP Discover · transaction 0x${XID.toString(16)}`,
      build: once(() => udpFrame({ srcMac: MAC.client, dstMac: MAC.broadcast, ip: { ...toAll, id: 0x0001 } }, 68, 67,
        dhcp({ op: 1, xid: XID, mac: MAC.client, msgType: 1, broadcast: true, paramList: true }))),
    },
    {
      id: 'offer', label: 'DHCPOFFER', from: 'router', to: 'laptop', broadcast: true, t: 0.512,
      paths: [['router', 'switch', 'laptop'], ['router', 'switch', 'phone']],
      info: `DHCP Offer · ${IP.client}`,
      build: once(() => udpFrame({ srcMac: MAC.router, dstMac: MAC.broadcast, ip: { ...fromServer, id: 0x7a10 } }, 67, 68,
        dhcp({ op: 2, xid: XID, mac: MAC.client, msgType: 2, broadcast: true, ...offerFields }))),
    },
    {
      id: 'request', label: 'DHCPREQUEST', from: 'laptop', to: 'router', broadcast: true, t: 0.514,
      paths: [['laptop', 'switch', 'router'], ['laptop', 'switch', 'phone']],
      info: `DHCP Request · ${IP.client} from ${IP.router}`,
      build: once(() => udpFrame({ srcMac: MAC.client, dstMac: MAC.broadcast, ip: { ...toAll, id: 0x0002 } }, 68, 67,
        dhcp({ op: 1, xid: XID, mac: MAC.client, msgType: 3, broadcast: true, requestedIp: IP.client, serverId: IP.router, paramList: true }))),
    },
    {
      id: 'ack', label: 'DHCPACK', from: 'router', to: 'laptop', broadcast: true, t: 0.517,
      paths: [['router', 'switch', 'laptop'], ['router', 'switch', 'phone']],
      info: `DHCP ACK · ${IP.client} for 24 h`,
      build: once(() => udpFrame({ srcMac: MAC.router, dstMac: MAC.broadcast, ip: { ...fromServer, id: 0x7a11 } }, 67, 68,
        dhcp({ op: 2, xid: XID, mac: MAC.client, msgType: 5, broadcast: true, ...offerFields }))),
    },
  ],
  steps: [
    {
      title: 'Discover: “Is there a DHCP server?”',
      body: [
        'The laptop has no IP address and does not know where the server is, so it sends from 0.0.0.0 to 255.255.255.255 inside an Ethernet broadcast. UDP is used: client port 68, server port 67.',
        'A random transaction ID ties the next four messages together, even if several laptops join at once.',
      ],
      packets: ['discover'],
      facts: [['Source IP', '0.0.0.0'], ['Destination IP', '255.255.255.255'], ['Ports', 'UDP 68 → 67'], ['Transaction ID', `0x${XID.toString(16)}`]],
    },
    {
      title: 'Offer: “You can have .20”',
      body: [
        `The server picks a free address from its pool and offers ${IP.client}, plus the mask, default gateway, DNS server and lease time.`,
        'Many servers first ping the address to make sure nobody is already using it, which is why the offer can take half a second.',
      ],
      packets: ['offer'],
      facts: [['Offered IP', IP.client], ['Mask', '255.255.255.0'], ['Gateway', IP.router], ['DNS', IP.resolver], ['Lease', '86 400 s (24 h)']],
    },
    {
      title: 'Request: “I’ll take it”',
      body: [
        'The laptop formally requests the offered address and names the server it chose (option 54).',
        'It still broadcasts, even though it knows the server: any other DHCP servers that sent offers see the request and put their addresses back in the pool.',
      ],
      packets: ['request'],
      facts: [['Requested IP', IP.client], ['Chosen server', IP.router], ['Why broadcast?', 'to tell every server']],
    },
    {
      title: 'Acknowledge: the address is yours',
      body: [
        'The server confirms with an ACK. The laptop configures its interface and is now on the network.',
        'Before using the address, most clients send a gratuitous ARP to check that no one else has it. If someone answers, the client declines the address and starts over.',
      ],
      packets: ['ack'],
      facts: [['Laptop IP', `${IP.client}/24`], ['Default gateway', IP.router], ['Next step', 'gratuitous ARP check']],
    },
    {
      title: 'Leases expire, so clients renew',
      body: [
        'At 50% of the lease (T1, 12 h here) the client unicasts a Request directly to its server to renew. If that fails, at 87.5% (T2) it broadcasts to any server. If the lease runs out, the address must be dropped.',
        'On a large network the server usually sits on another subnet. A relay agent on the local router forwards the broadcasts and fills in the giaddr field so the server knows which pool to use.',
      ],
      packets: [],
      facts: [['T1 (renew)', '50% → 12 h'], ['T2 (rebind)', '87.5% → 21 h'], ['Across subnets', 'DHCP relay agent']],
    },
  ],
  takeaways: [
    'DHCP runs over UDP: clients use port 68, servers port 67.',
    'The four-message exchange is DORA: Discover, Offer, Request, ACK.',
    'Clients broadcast because they have no address and do not know the server yet.',
    'Addresses are leased, not owned; clients renew at T1 = 50% and rebind at T2 = 87.5%.',
  ],
  quiz: [
    {
      q: 'Which source IP address does a client use in DHCPDISCOVER?',
      options: ['127.0.0.1', '0.0.0.0', '255.255.255.255', 'Its last-used address'],
      answer: 1,
      why: '0.0.0.0 means “this host, no address yet”. The destination is the limited broadcast 255.255.255.255.',
    },
    {
      q: 'Why is the DHCPREQUEST broadcast even though the client knows the server?',
      options: ['Unicast is not allowed on UDP', 'So every server learns which offer was accepted', 'Switches require it', 'To reach the DNS server'],
      answer: 1,
      why: 'Servers whose offers were declined see the request and release the addresses they had reserved.',
    },
    {
      q: 'Which transport and ports does DHCP use?',
      options: ['TCP 67/68', 'UDP 53', 'UDP 68 (client) / 67 (server)', 'UDP 80'],
      answer: 2,
      why: 'DHCP inherited ports 67 and 68 from BOOTP and runs over UDP because the client cannot hold a TCP connection without an IP.',
    },
    {
      q: 'With a 24-hour lease, when does the client first try to renew?',
      options: ['After 6 hours', 'After 12 hours', 'After 21 hours', 'Only when the lease expires'],
      answer: 1,
      why: 'T1 defaults to 50% of the lease time.',
    },
  ],
  references: [
    { label: 'RFC 2131: Dynamic Host Configuration Protocol', url: 'https://www.rfc-editor.org/rfc/rfc2131' },
    { label: 'RFC 2132: DHCP options', url: 'https://www.rfc-editor.org/rfc/rfc2132' },
  ],
}
